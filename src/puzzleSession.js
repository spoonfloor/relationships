import {
  createPuzzleRow,
  deletePuzzleRow,
  draftTitleFromRow,
  fetchPuzzleRow,
  hydratePuzzleFromRow,
  isListableRow,
  isUnpublishedDraftRow,
  publishPuzzle,
  savePuzzleDraft,
} from "./puzzleRepository.js";
import { createPublishedShell } from "./puzzleComposeTemplate.js";
import { normalizePuzzle } from "./puzzleNormalize.js";
import { slugFromTitle, uniqueSlug } from "./puzzleSlug.js";

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
  function addToCatalog(id) {
    if (isInCatalog(id)) return false;
    const rec = records.get(id);
    if (!rec || !isListable(id)) return false;
    catalog.puzzles.push({ id, num: rec.num, hasDraft: rec.hasDraft });
    catalog.puzzles.sort((a, b) => a.num - b.num);
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

  /** @returns {{ id: string, title: string }[]} */
  function getUnpublishedDraftOptions() {
    if (!catalog.rows?.length) return [];

    return catalog.rows
      .filter(isUnpublishedDraftRow)
      .sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
      .map((row) => ({
        id: row.id,
        title: draftTitleFromRow(row),
      }));
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

    const drafts = getUnpublishedDraftOptions();
    if (drafts.length > 0) {
      sections.push({ heading: "DRAFTS", puzzles: drafts });
    }

    return sections;
  }

  /** @param {string} id */
  function getDeletableTitle(id) {
    for (const section of getDeletablePuzzleSections()) {
      const match = section.puzzles.find((puzzle) => puzzle.id === id);
      if (match) return match.title;
    }
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
   * @param {string} id
   * @param {object | null} working
   * @returns {Promise<{ ok: true, published: object, newlyListed: boolean } | { ok: false, error: string }>}
   */
  async function publish(id, working = null) {
    if (!isPersistable(id)) {
      return { ok: false, error: "Publish is not available for this puzzle." };
    }
    if (working) {
      const saved = await saveDraft(id, working);
      if (!saved.ok) return saved;
    }

    const wasListed = isInCatalog(id);
    try {
      const row = await publishPuzzle(id);
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
   * Persist a compose working copy when it has no session row yet.
   * @param {object} working
   * @returns {Promise<{ ok: true, id: string, draft: object, created: boolean, row?: PuzzleRow } | { ok: false, error: string }>}
   */
  async function ensurePersisted(working) {
    normalizePuzzle(working);
    const id = typeof working.id === "string" ? working.id.trim() : "";
    if (id && records.has(id) && isPersistable(id)) {
      return { ok: true, id, draft: structuredClone(working), created: false };
    }
    const created = await createDraft(working);
    if (!created.ok) return created;
    return {
      ok: true,
      id: created.id,
      draft: created.draft,
      created: true,
      row: created.row,
    };
  }

  /**
   * @param {string} id
   * @returns {Promise<{ ok: true, nextId: string | null, wasListed: boolean } | { ok: false, error: string }>}
   */
  async function remove(id) {
    if (!isPersistable(id)) {
      return { ok: false, error: "This puzzle cannot be deleted." };
    }
    if (!records.has(id)) {
      return { ok: false, error: `Puzzle "${id}" not found.` };
    }
    if (isInCatalog(id) && catalog.puzzles.length <= 1) {
      return { ok: false, error: "Cannot delete the last puzzle." };
    }

    const wasListed = isInCatalog(id);

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
    getUnpublishedDraftOptions,
    getDeletablePuzzleSections,
    getDeletableTitle,
    enterEdit,
    exitEdit,
    saveDraft,
    createDraft,
    ensurePersisted,
    publish,
    remove,
  };
}
