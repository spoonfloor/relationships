import { getEditPassword } from "./auth.js";
import { getSupabase } from "./supabaseClient.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";
import { isPublishedShell } from "./puzzleComposeTemplate.js";
import { hydratePuzzleFromRow } from "./puzzleNormalize.js";

export { hydratePuzzleFromRow } from "./puzzleNormalize.js";

export const DEBUG_PUZZLE_ID = "debug";

/**
 * @typedef {{ num: number, id: string, hasDraft?: boolean }} PuzzleEntry
 * @typedef {{ defaultId: string | null, puzzles: PuzzleEntry[], rows: PuzzleRow[] }} PuzzleCatalog
 * @typedef {{ id: string, num: number, title: string, published_data: object, draft_data?: object | null, draft_updated_at?: string | null }} PuzzleRow
 */

/** True when draft_data exists and the puzzle has never been published. */
export function isUnpublishedDraftRow(row) {
  return Boolean(row.draft_data != null && isPublishedShell(row.published_data));
}

/** True when the row belongs in the play picker (published at least once). */
export function isListableRow(row) {
  return Boolean(row.published_data && !isUnpublishedDraftRow(row));
}

export const DRAFT_TITLE_SUFFIX = " [Draft]";

/** @param {string} title */
export function formatDraftDisplayTitle(title) {
  const trimmed = (title ?? "").trim();
  const base = trimmed || "Untitled";
  if (base.endsWith(DRAFT_TITLE_SUFFIX)) return base;
  return `${base}${DRAFT_TITLE_SUFFIX}`;
}

/** @param {PuzzleRow} row */
export function draftTitleFromRow(row) {
  const fromDraft =
    typeof row.draft_data?.title === "string" ? row.draft_data.title.trim() : "";
  if (fromDraft) return formatDraftDisplayTitle(fromDraft);
  const fromRow = typeof row.title === "string" ? row.title.trim() : "";
  return formatDraftDisplayTitle(fromRow || row.id);
}

/** @param {PuzzleRow} row */
function rowToEntry(row) {
  return {
    num: row.num,
    id: row.id,
    hasDraft: row.draft_data != null,
  };
}

/** @param {{ num?: number }} a @param {{ num?: number }} b */
export function compareCatalogEntriesNewestFirst(a, b) {
  return (b.num ?? 0) - (a.num ?? 0);
}

/** @template T @param {T[]} entries @returns {T[]} */
export function sortCatalogEntriesNewestFirst(entries) {
  entries.sort(compareCatalogEntriesNewestFirst);
  return entries;
}

/**
 * Neighbor in the play catalog (newest-first).
 * delta +1 = older (toward end); delta -1 = newer (toward start).
 * @param {{ id: string }[]} puzzles
 * @param {string | null | undefined} currentId
 * @param {1 | -1} delta
 * @returns {string | null}
 */
export function getAdjacentPuzzleId(puzzles, currentId, delta) {
  if (!Array.isArray(puzzles) || puzzles.length < 2) return null;
  if (delta !== 1 && delta !== -1) return null;
  if (!currentId || currentId === DEBUG_PUZZLE_ID) return null;
  const index = puzzles.findIndex((entry) => entry.id === currentId);
  if (index < 0) return null;
  const nextIndex = index + delta;
  if (nextIndex < 0 || nextIndex >= puzzles.length) return null;
  const nextId = puzzles[nextIndex]?.id;
  return nextId && nextId !== DEBUG_PUZZLE_ID ? nextId : null;
}

/** @param {string} id */
export async function fetchPuzzleRow(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("puzzles")
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Puzzle "${id}" not found`);
  return data;
}

export async function fetchPuzzleCatalog() {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Puzzles are loaded from Supabase only.");
  }

  const { data, error } = await supabase
    .from("puzzles")
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .order("num");

  if (error) throw error;

  if (!data?.length) {
    return { defaultId: null, puzzles: [], rows: [] };
  }

  const allRows = data.filter((row) => row.id !== DEBUG_PUZZLE_ID);
  const puzzles = sortCatalogEntriesNewestFirst(
    allRows.filter(isListableRow).map(rowToEntry)
  );

  return {
    defaultId: puzzles[0]?.id ?? null,
    puzzles,
    rows: allRows,
  };
}

/**
 * @param {PuzzleCatalog} catalog
 * @param {string} id
 * @param {{ variant?: 'published' | 'draft' }} [options]
 */
export async function fetchPuzzle(catalog, id, { variant = "published" } = {}) {
  const row = catalog.rows.find((entry) => entry.id === id);
  if (!row) {
    throw new Error(`Puzzle "${id}" not found`);
  }
  return hydratePuzzleFromRow(row, variant);
}

/** @returns {Promise<{ puzzle: object, row: PuzzleRow }>} */
export async function fetchDebugPuzzle() {
  const row = await fetchPuzzleRow(DEBUG_PUZZLE_ID);
  return {
    puzzle: hydratePuzzleFromRow(row, "published"),
    row,
  };
}

/**
 * Run a password-checked write function in the database (see supabase/schema.sql).
 * @param {string} fn
 * @param {Record<string, unknown>} args
 */
async function editorWrite(fn, args) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data, error } = await supabase.rpc(fn, {
    p_password: getEditPassword(),
    ...args,
  });
  if (error) throw error;
  return data;
}

/**
 * @param {object} puzzle Draft puzzle payload (must include id, title).
 * @param {object} publishedShell Minimal published_data for the new row.
 * @param {number} num Catalog sort order.
 */
export async function createPuzzleRow(puzzle, publishedShell, num) {
  return editorWrite("create_puzzle", {
    p_id: puzzle.id,
    p_num: num,
    p_title: puzzle.title,
    p_published_data: publishedShell,
    p_draft_data: puzzle,
  });
}

export async function savePuzzleDraft(puzzle) {
  return editorWrite("save_puzzle_draft", {
    p_id: puzzle.id,
    p_draft_data: puzzle,
  });
}

/** @param {string} id */
export async function deletePuzzleRow(id) {
  await editorWrite("delete_puzzle", { p_id: id });
}

/**
 * Insert a row that is live on publish (no draft_data).
 * @param {object} puzzle Published puzzle payload (must include id, title).
 * @param {number} num Catalog sort order.
 */
export async function insertPublishedPuzzleRow(puzzle, num) {
  return editorWrite("create_puzzle", {
    p_id: puzzle.id,
    p_num: num,
    p_title: puzzle.title,
    p_published_data: puzzle,
    p_draft_data: null,
  });
}

/** Publish working content to an existing row; clears any stored draft. */
export async function updatePublishedPuzzle(puzzle) {
  return editorWrite("publish_puzzle", {
    p_id: puzzle.id,
    p_published_data: puzzle,
  });
}

/** Remove stored draft only; published_data is unchanged. */
export async function clearPuzzleDraft(id) {
  return editorWrite("clear_puzzle_draft", { p_id: id });
}

/** Promote stored draft (or republish published) when no working copy is supplied. */
export async function promoteStoredDraft(id) {
  return editorWrite("promote_puzzle_draft", { p_id: id });
}
