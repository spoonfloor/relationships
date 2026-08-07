import {
  clearPuzzleDraft,
  createPuzzleRow,
  deletePuzzleRow,
  draftTitleFromRow,
  fetchPuzzleRow,
  hydratePuzzleFromRow,
  insertPublishedPuzzleRow,
  isListableRow,
  isUnpublishedDraftRow,
  promoteStoredDraft,
  savePuzzleDraft,
  sortCatalogEntriesNewestFirst,
  updatePublishedPuzzle,
} from "./puzzleRepository.js";
import { createPublishedShell } from "./puzzleComposeTemplate.js";
import { normalizePuzzle } from "./puzzleNormalize.js";
import { slugFromTitle, uniqueSlug } from "./puzzleSlug.js";

/** Prefix for delete-picker ids that target a saved draft overlay, not the published puzzle. */
export const DRAFT_DELETE_PREFIX = "draft:";

/**
 * @typedef {import("./puzzleRepository.js").PuzzleRow} PuzzleRow
 * @typedef {{ published: object, row: PuzzleRow | null, num: number, hasDraft: boolean }} PuzzleRecord
 */

/**
 * @param {{ catalog: { puzzles: { id: string, num: number }[], rows: PuzzleRow[] } }} options
 */
export function createPuzzleSession({ catalog }) {
  /** @type {Map<string, PuzzleRecord>} */
  const records = new Map();

  /** @param {string} id */
  function isPersistable(id) {
    return Boolean(typeof id === "string" && id.trim());
  }

  function canAuthorOnline() {
    return true;
  }

  /** @returns {string[]} */
  function getExistingIds() {
    if (catalog.rows?.length) {
      return catalog.rows.map((row) => row.id);
    }
    return catalog.puzzles.map((entry) => entry.id);
  }

  /** @returns {number} */
  function getNextNum() {
    const entries = catalog.rows?.length ? catalog.rows : catalog.puzzles;
    const nums = entries.map((entry) => entry.num ?? 0);
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  /** @param {string} id */
  function isInCatalog(id) {
    return catalog.puzzles.some((entry) => entry.id === id);
  }

  /** @param {string} id */
  function isListable(id) {
    const rec = records.get(id);
    if (!rec) return false;
    if (rec.row) return isListableRow(rec.row);
    return Boolean(rec.published);
  }

  /** @param {string} id */
  function isDraftOnlyId(id) {
    const row = catalog.rows?.find((entry) => entry.id === id);
    return Boolean(row && isUnpublishedDraftRow(row));
  }

  /** @param {string} pickerId */
  function resolveDeleteTarget(pickerId) {
    if (pickerId.startsWith(DRAFT_DELETE_PREFIX)) {
      return { kind: "draft", id: pickerId.slice(DRAFT_DELETE_PREFIX.length) };
    }
    if (isDraftOnlyId(pickerId)) {
      return { kind: "draft", id: pickerId };
    }
    return { kind: "published", id: pickerId };
  }

  /** @param {string} id */
  function addToCatalog(id) {
    if (isInCatalog(id)) return false;
    const rec = records.get(id);
    if (!rec || !isListable(id)) return false;
    catalog.puzzles.push({ id, num: rec.num, hasDraft: rec.hasDraft });
    sortCatalogEntriesNewestFirst(catalog.puzzles);
    catalog.defaultId = catalog.puzzles[0]?.id ?? null;
    return true;
  }

  /**
   * @param {string} id
   * @param {{ published: object, row?: PuzzleRow | null, num?: number }} data
   */
  function init(id, { published, row = null, num = 0 }) {
    records.set(id, {
      published: structuredClone(published),
      row,
      num,
      hasDraft: row?.draft_data != null,
    });
  }

  /** @param {string} id */
  function getRecord(id) {
    return records.get(id);
  }

  /** @param {string} id */
  function getPublished(id) {
    const rec = records.get(id);
    if (!rec) return null;
    return structuredClone(rec.published);
  }

  /** Published puzzle for play; drafts are edit-only and never shown in the picker. */
  function getPlayable(id) {
    const rec = records.get(id);
    if (!rec) return null;
    return structuredClone(rec.published);
  }

  /** @param {string} id */
  function getPublishedTitle(id) {
    return records.get(id)?.published?.title ?? id;
  }

  /** @param {string} id */
  function hasDraft(id) {
    return records.get(id)?.hasDraft ?? false;
  }

  /** @returns {{ id: string, title: string, isOverlay: boolean }[]} */
  function getDraftRowOptions() {
    if (!catalog.rows?.length) return [];

    return catalog.rows
      .filter((row) => row.draft_data != null)
      .map((row) => ({
        id: row.id,
        title: draftTitleFromRow(row),
        isOverlay: isListableRow(row),
      }));
  }

  /** Saved drafts: draft-only rows and overlays on published puzzles. */
  function getSavedDraftOptions() {
    return getDraftRowOptions()
      .map(({ id, title }) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  /** @returns {{ id: string, title: string }[]} */
  function getDeletableDraftOptions() {
    return getDraftRowOptions()
      .map(({ id, title, isOverlay }) => ({
        id: isOverlay ? `${DRAFT_DELETE_PREFIX}${id}` : id,
        title,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }

  /** @returns {{ heading?: string, puzzles: { id: string, title: string }[] }[]} */
  function getDeletablePuzzleSections() {
    /** @type {{ heading?: string, puzzles: { id: string, title: string }[] }[]} */
    const sections = [];

    const published = catalog.puzzles.map((entry) => ({
      id: entry.id,
      title: getPickerLabel(entry.id),
    }));
    if (published.length > 0) {
      sections.push({ puzzles: published });
    }

    const drafts = getDeletableDraftOptions();
    if (drafts.length > 0) {
      sections.push({ heading: "DRAFTS", puzzles: drafts });
    }

    return sections;
  }

  /** @param {string} pickerId */
  function getDeletableTitle(pickerId) {
    for (const section of getDeletablePuzzleSections()) {
      const match = section.puzzles.find((puzzle) => puzzle.id === pickerId);
      if (match) return match.title;
    }
    const { id } = resolveDeleteTarget(pickerId);
    return getPublishedTitle(id);
  }

  /** @param {string} id */
  function getPickerLabel(id) {
    return getPublishedTitle(id);
  }

  /** @param {string} id @param {PuzzleRow} row */
  async function applyRow(id, row) {
    const rec = records.get(id);
    if (!rec) return;
    rec.row = row;
    rec.hasDraft = row.draft_data != null;
    rec.num = row.num ?? rec.num;
    rec.published = hydratePuzzleFromRow(row, "published");

    const catalogEntry = catalog.puzzles.find((entry) => entry.id === id);
    if (catalogEntry) {
      catalogEntry.hasDraft = rec.hasDraft;
    }

    const catalogRow = catalog.rows?.find((entry) => entry.id === id);
    if (catalogRow) {
      Object.assign(catalogRow, row);
    }
  }

  /** @param {string} id */
  async function refreshRow(id) {
    const row = await fetchPuzzleRow(id);
    await applyRow(id, row);
    return row;
  }

  /** @param {string} id */
  async function enterEdit(id) {
    if (!isPersistable(id)) {
      throw new Error("This puzzle cannot be edited.");
    }
    await refreshRow(id);
    const rec = records.get(id);
    if (!rec?.row) throw new Error(`Puzzle "${id}" not found`);
    return hydratePuzzleFromRow(rec.row, "draft");
  }

  /** @param {string} id */
  function exitEdit(id) {
    return getPublished(id);
  }

  /**
   * @param {string} id
   * @param {object} working
   * @returns {Promise<{ ok: true, row: PuzzleRow } | { ok: false, error: string }>}
   */
  async function saveDraft(id, working) {
    if (!isPersistable(id)) {
      return { ok: false, error: "Save draft is not available for this puzzle." };
    }
    const rec = records.get(id);
    if (!rec) {
      return { ok: false, error: `Puzzle "${id}" not found.` };
    }

    normalizePuzzle(working);
    const payload = { ...working, id, num: rec.num };
    try {
      const row = await savePuzzleDraft(payload);
      await applyRow(id, row);
      return { ok: true, row };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save draft.";
      return { ok: false, error: message };
    }
  }

  /**
   * Publish working content directly to published_data (never writes draft_data).
   * @param {object} working
   * @param {string} [existingId]
   * @returns {Promise<{ ok: true, id: string, row: PuzzleRow, newlyListed: boolean } | { ok: false, error: string }>}
   */
  async function publishWorkingCopy(working, existingId = "") {
    normalizePuzzle(working);

    const persistableId =
      typeof existingId === "string" && existingId.trim() ? existingId.trim() : "";
    const rec = persistableId ? records.get(persistableId) : null;

    /** @type {string} */
    let targetId;
    /** @type {object} */
    let payload;
    /** @type {PuzzleRow} */
    let row;

    try {
      if (rec) {
        targetId = persistableId;
        payload = { ...working, id: targetId, num: rec.num };
        row = await updatePublishedPuzzle(payload);
      } else {
        const resolvedTitle = (working.title ?? "").trim();
        targetId = uniqueSlug(slugFromTitle(resolvedTitle), getExistingIds());
        const num = getNextNum();
        payload = structuredClone(working);
        payload.id = targetId;
        payload.title = resolvedTitle;
        payload.num = num;
        row = await insertPublishedPuzzleRow(payload, num);
        init(targetId, {
          published: structuredClone(payload),
          row,
          num,
        });
        if (catalog.rows) catalog.rows.push(row);
      }

      await applyRow(targetId, row);
      const wasListed = isInCatalog(targetId);
      const newlyListed = !wasListed && addToCatalog(targetId);
      return { ok: true, id: targetId, row, newlyListed };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not publish puzzle.";
      return { ok: false, error: message };
    }
  }

  /**
   * @param {string} id
   * @param {object | null} [working]
   * @returns {Promise<{ ok: true, published: object, newlyListed: boolean } | { ok: false, error: string }>}
   */
  async function publish(id, working = null) {
    if (working) {
      const result = await publishWorkingCopy(working, id);
      if (!result.ok) return result;
      return {
        ok: true,
        published: getPublished(result.id),
        newlyListed: result.newlyListed,
      };
    }

    if (!isPersistable(id)) {
      return { ok: false, error: "Publish is not available for this puzzle." };
    }

    const wasListed = isInCatalog(id);
    try {
      const row = await promoteStoredDraft(id);
      await applyRow(id, row);
      const newlyListed = !wasListed && addToCatalog(id);
      return { ok: true, published: getPublished(id), newlyListed };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not publish puzzle.";
      return { ok: false, error: message };
    }
  }

  /**
   * @param {object} working
   * @returns {Promise<{ ok: true, id: string, row: PuzzleRow, draft: object, created: true } | { ok: false, error: string }>}
   */
  async function createDraft(working) {
    normalizePuzzle(working);

    const resolvedTitle = (working.title ?? "").trim();
    const id = uniqueSlug(slugFromTitle(resolvedTitle), getExistingIds());
    const num = getNextNum();
    const payload = structuredClone(working);
    payload.id = id;
    payload.title = resolvedTitle;
    payload.num = num;

    try {
      const publishedShell = normalizePuzzle(createPublishedShell(id, resolvedTitle));
      const row = await createPuzzleRow(payload, publishedShell, num);
      init(id, {
        published: structuredClone(publishedShell),
        row,
        num,
      });
      if (catalog.rows) catalog.rows.push(row);
      return { ok: true, id, row, draft: structuredClone(payload), created: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create puzzle.";
      return { ok: false, error: message };
    }
  }

  /**
   * Delete a draft document only. Never removes a published puzzle.
   * @param {string} id
   * @returns {Promise<{ ok: true, wasListed: boolean, nextId: string | null, draftOnly: boolean } | { ok: false, error: string }>}
   */
  async function removeDraft(id) {
    if (!isPersistable(id)) {
      return { ok: false, error: "This draft cannot be deleted." };
    }
    if (!records.has(id)) {
      return { ok: false, error: `Puzzle "${id}" not found.` };
    }

    const draftOnly = isDraftOnlyId(id);

    try {
      if (draftOnly) {
        await deletePuzzleRow(id);
        records.delete(id);
        if (catalog.rows) {
          catalog.rows = catalog.rows.filter((row) => row.id !== id);
        }
        return { ok: true, wasListed: false, nextId: catalog.puzzles[0]?.id ?? null, draftOnly: true };
      }

      if (!hasDraft(id)) {
        return { ok: false, error: "This puzzle has no saved draft." };
      }

      const row = await clearPuzzleDraft(id);
      await applyRow(id, row);
      return {
        ok: true,
        wasListed: isInCatalog(id),
        nextId: id,
        draftOnly: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete draft.";
      return { ok: false, error: message };
    }
  }

  /**
   * Delete a published puzzle (and any draft on the same row).
   * @param {string} id
   * @returns {Promise<{ ok: true, nextId: string | null, wasListed: boolean } | { ok: false, error: string }>}
   */
  async function removePublished(id) {
    if (!isPersistable(id)) {
      return { ok: false, error: "This puzzle cannot be deleted." };
    }
    if (!records.has(id)) {
      return { ok: false, error: `Puzzle "${id}" not found.` };
    }
    if (!isInCatalog(id)) {
      return { ok: false, error: "Only published puzzles can be deleted here." };
    }
    if (catalog.puzzles.length <= 1) {
      return { ok: false, error: "Cannot delete the last puzzle." };
    }

    const wasListed = true;

    try {
      await deletePuzzleRow(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete puzzle.";
      return { ok: false, error: message };
    }

    records.delete(id);
    catalog.puzzles = catalog.puzzles.filter((entry) => entry.id !== id);
    if (catalog.rows) {
      catalog.rows = catalog.rows.filter((row) => row.id !== id);
    }
    if (catalog.defaultId === id) {
      catalog.defaultId = catalog.puzzles[0]?.id ?? null;
    }

    return { ok: true, nextId: catalog.puzzles[0]?.id ?? null, wasListed };
  }

  return {
    isPersistable,
    canAuthorOnline,
    getExistingIds,
    getNextNum,
    init,
    getRecord,
    getPublished,
    getPlayable,
    getPublishedTitle,
    getPickerLabel,
    hasDraft,
    isDraftOnlyId,
    resolveDeleteTarget,
    getSavedDraftOptions,
    getDeletablePuzzleSections,
    getDeletableTitle,
    enterEdit,
    exitEdit,
    saveDraft,
    createDraft,
    publish,
    removeDraft,
    removePublished,
  };
}
