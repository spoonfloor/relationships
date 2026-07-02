const STORAGE_KEY = "relationships.puzzleEdits";

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(edits) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edits));
  } catch {
    // ignore quota errors or private browsing
  }
}

export function getPuzzleEdits(puzzleId) {
  const edits = readAll()[puzzleId];
  return edits && typeof edits === "object" ? edits : {};
}

export function savePuzzleEdits(puzzleId, patch) {
  const all = readAll();
  all[puzzleId] = { ...all[puzzleId], ...patch };
  writeAll(all);
}

export function savePuzzleTitle(puzzleId, title) {
  savePuzzleEdits(puzzleId, { title });
}

/** Merge stored client edits onto a puzzle loaded from disk. */
export function applyStoredEdits(puzzle, puzzleId) {
  const { title } = getPuzzleEdits(puzzleId);
  if (typeof title === "string" && title.trim()) {
    puzzle.title = title;
  }
  return puzzle;
}
