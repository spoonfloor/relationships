import { getSupabase } from "./supabaseClient.js";
import { isSupabaseConfigured } from "./supabaseConfig.js";
import { isPublishedShell } from "./puzzleComposeTemplate.js";
import { loadPuzzleIndex as loadStaticIndex, hydratePuzzle } from "./loadPuzzle.js";

export const DEBUG_PUZZLE_ID = "debug";

/**
 * @typedef {{ num: number, id: string, hasDraft?: boolean, file?: string }} PuzzleEntry
 * @typedef {{ defaultId: string, puzzles: PuzzleEntry[], source: 'supabase' | 'static' }} PuzzleCatalog
 * @typedef {{ id: string, num: number, title: string, published_data: object, draft_data?: object | null, draft_updated_at?: string | null }} PuzzleRow
 */

/** @param {{ puzzles: PuzzleEntry[], defaultId?: string }} index */
function catalogFromIndex(index) {
  const puzzles = index.puzzles.filter((entry) => entry.id !== DEBUG_PUZZLE_ID);
  const defaultId =
    index.defaultId &&
    index.defaultId !== DEBUG_PUZZLE_ID &&
    puzzles.some((entry) => entry.id === index.defaultId)
      ? index.defaultId
      : puzzles[0]?.id;

  return { ...index, puzzles, defaultId };
}

/** True when published_data is playable and belongs in the Choose puzzle list. */
export function isListableRow(row) {
  return Boolean(row.published_data && !isPublishedShell(row.published_data));
}

/** True when draft_data exists and the puzzle has never been published. */
export function isUnpublishedDraftRow(row) {
  return Boolean(row.draft_data != null && isPublishedShell(row.published_data));
}

/** @param {PuzzleRow} row */
export function draftTitleFromRow(row) {
  const fromDraft =
    typeof row.draft_data?.title === "string" ? row.draft_data.title.trim() : "";
  if (fromDraft) return fromDraft;
  const fromRow = typeof row.title === "string" ? row.title.trim() : "";
  return fromRow || row.id;
}

/** @param {PuzzleRow} row */
function rowToEntry(row) {
  return {
    num: row.num,
    id: row.id,
    hasDraft: row.draft_data != null,
  };
}

/** @param {PuzzleRow} row @param {'published' | 'draft'} variant */
export async function hydratePuzzleFromRow(row, variant = "published") {
  const raw =
    variant === "draft"
      ? row.draft_data ?? row.published_data
      : row.published_data;
  if (!raw) {
    throw new Error(`Puzzle "${row.id}" has no ${variant} data`);
  }
  const puzzle = structuredClone(raw);
  const label = `supabase:${row.id}`;

  // Never-published rows store real content in draft_data; published_data is a shell.
  if (variant === "published" && row.draft_data != null && isPublishedShell(puzzle)) {
    return puzzle;
  }

  return hydratePuzzle(puzzle, label);
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
    const index = catalogFromIndex(await loadStaticIndex("./puzzles/index.json"));
    return { ...index, source: "static" };
  }

  try {
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
      const index = catalogFromIndex(await loadStaticIndex("./puzzles/index.json"));
      return { ...index, source: "static" };
    }

    const allRows = data.filter((row) => row.id !== DEBUG_PUZZLE_ID);
    const listableRows = allRows.filter(isListableRow);
    const configuredDefault = configRows?.[0]?.value;
    const defaultId =
      configuredDefault &&
      configuredDefault !== DEBUG_PUZZLE_ID &&
      listableRows.some((row) => row.id === configuredDefault)
        ? configuredDefault
        : listableRows[0]?.id;

    return {
      defaultId,
      puzzles: listableRows.map(rowToEntry),
      source: "supabase",
      rows: allRows,
    };
  } catch (err) {
    console.warn("Supabase catalog unavailable, using static puzzles:", err);
    const index = catalogFromIndex(await loadStaticIndex("./puzzles/index.json"));
    return { ...index, source: "static" };
  }
}

/**
 * @param {PuzzleCatalog} catalog
 * @param {string} id
 * @param {{ variant?: 'published' | 'draft' }} [options]
 */
export async function fetchPuzzle(catalog, id, { variant = "published" } = {}) {
  if (catalog.source === "supabase" && catalog.rows) {
    const row = catalog.rows.find((entry) => entry.id === id);
    if (row) {
      return await hydratePuzzleFromRow(row, variant);
    }
  }

  const entry = catalog.puzzles.find((p) => p.id === id);
  if (!entry?.file) {
    throw new Error(`Puzzle "${id}" not found`);
  }
  return hydratePuzzle(await loadStaticPuzzleJson(entry.file), `./puzzles/${entry.file}`);
}

async function loadStaticPuzzleJson(file) {
  const res = await fetch(`./puzzles/${file}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load ./puzzles/${file}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** @returns {Promise<{ puzzle: object, row: PuzzleRow | null }>} */
export async function fetchDebugPuzzle() {
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const row = await fetchPuzzleRow(DEBUG_PUZZLE_ID);
      return {
        puzzle: await hydratePuzzleFromRow(row, "published"),
        row,
      };
    } catch (err) {
      console.warn("Debug puzzle unavailable in Supabase, using static file:", err);
    }
  }

  const raw = await loadStaticPuzzleJson("debug.json");
  return {
    puzzle: await hydratePuzzle(raw, "./puzzles/debug.json"),
    row: null,
  };
}

/**
 * @param {object} puzzle
 */
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

export async function publishPuzzle(id) {
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
