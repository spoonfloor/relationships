import { validatePuzzle, validatePuzzleIndex } from "./validation.js";

export { validatePuzzle, validatePuzzleIndex };

function themeUrlFromPuzzleUrl(puzzleUrl, themeId) {
  return puzzleUrl.replace(/[^/]+$/, "") + `themes/${themeId}.json`;
}

async function applyTheme(puzzle, puzzleUrl) {
  const themeUrl = themeUrlFromPuzzleUrl(puzzleUrl, puzzle.theme);
  const res = await fetch(themeUrl, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load theme "${puzzle.theme}" from ${themeUrl}: ${res.status} ${res.statusText}`);
  }
  const theme = await res.json();
  if (!Array.isArray(theme.groups) || theme.groups.length !== 4) {
    throw new Error(`Theme "${puzzle.theme}" must define exactly 4 group color sets`);
  }
  puzzle.groups.forEach((group, index) => {
    group.colors = { ...theme.groups[index].colors };
  });
}

export async function loadPuzzle(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  const puzzle = await res.json();
  if (typeof puzzle.theme === "string" && puzzle.theme.trim()) {
    await applyTheme(puzzle, url);
  }
  validatePuzzle(puzzle, url);
  return puzzle;
}

export async function loadPuzzleIndex(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  const index = await res.json();
  validatePuzzleIndex(index, url);
  return index;
}
