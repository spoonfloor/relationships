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

  const { data: configRows, error: configError } = await supabase
    .from("app_config")
    .select("key, value")
    .eq("key", "default_puzzle_id");

  if (configError) throw configError;

  const { data, error } = await supabase
    .from("puzzles")
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .order("num");

  if (error) throw error;

  if (!data?.length) {
    return { defaultId: null, puzzles: [], rows: [] };
  }

  const allRows = data.filter((row) => row.id !== DEBUG_PUZZLE_ID);
  const listableRows = allRows.filter(isListableRow);
  const configuredDefault = configRows?.[0]?.value;
  const defaultId =
    configuredDefault &&
    configuredDefault !== DEBUG_PUZZLE_ID &&
    listableRows.some((row) => row.id === configuredDefault)
      ? configuredDefault
      : listableRows[0]?.id ?? null;

  return {
    defaultId,
    puzzles: sortCatalogEntriesNewestFirst(listableRows.map(rowToEntry)),
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
 * @param {object} puzzle Draft puzzle payload (must include id, title).
 * @param {object} publishedShell Minimal published_data for the new row.
 * @param {number} num Catalog sort order.
 */
export async function createPuzzleRow(puzzle, publishedShell, num) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("puzzles")
    .insert({
      id: puzzle.id,
      num,
      title: puzzle.title,
      published_data: publishedShell,
      draft_data: puzzle,
      draft_updated_at: now,
      updated_at: now,
    })
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Could not create puzzle "${puzzle.id}"`);
  return data;
}

export async function savePuzzleDraft(puzzle) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("puzzles")
    .update({
      draft_data: puzzle,
      draft_updated_at: now,
      updated_at: now,
    })
    .eq("id", puzzle.id)
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Puzzle "${puzzle.id}" not found`);
  return data;
}

/** @param {string} id */
export async function deletePuzzleRow(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { error } = await supabase.from("puzzles").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Insert a row that is live on publish (no draft_data).
 * @param {object} puzzle Published puzzle payload (must include id, title).
 * @param {number} num Catalog sort order.
 */
export async function insertPublishedPuzzleRow(puzzle, num) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("puzzles")
    .insert({
      id: puzzle.id,
      num,
      title: puzzle.title,
      published_data: puzzle,
      draft_data: null,
      draft_updated_at: null,
      updated_at: now,
    })
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Could not create puzzle "${puzzle.id}"`);
  return data;
}

/** Publish working content to an existing row; clears any stored draft. */
export async function updatePublishedPuzzle(puzzle) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("puzzles")
    .update({
      published_data: puzzle,
      title: puzzle.title,
      draft_data: null,
      draft_updated_at: null,
      updated_at: now,
    })
    .eq("id", puzzle.id)
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Puzzle "${puzzle.id}" not found`);
  return data;
}

/** Remove stored draft only; published_data is unchanged. */
export async function clearPuzzleDraft(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("puzzles")
    .update({
      draft_data: null,
      draft_updated_at: null,
      updated_at: now,
    })
    .eq("id", id)
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Puzzle "${id}" not found`);
  return data;
}

/** Promote stored draft (or republish published) when no working copy is supplied. */
export async function promoteStoredDraft(id) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase is not configured");

  const { data: row, error: fetchError } = await supabase
    .from("puzzles")
    .select("published_data, draft_data, title")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!row) throw new Error(`Puzzle "${id}" not found`);

  const nextPublished = row.draft_data ?? row.published_data;
  if (!nextPublished) throw new Error(`Puzzle "${id}" has nothing to publish`);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("puzzles")
    .update({
      published_data: nextPublished,
      title: nextPublished.title ?? row.title,
      draft_data: null,
      draft_updated_at: null,
      updated_at: now,
    })
    .eq("id", id)
    .select("id, num, title, published_data, draft_data, draft_updated_at")
    .maybeSingle();

  if (error) throw error;
  return data;
}
