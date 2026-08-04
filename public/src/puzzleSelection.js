import { DEBUG_PUZZLE_ID } from "./puzzleRepository.js";

const STORAGE_KEY = "relationships.selectedPuzzleId";

export function getSavedPuzzleId() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveSelectedPuzzleId(id) {
  if (id === DEBUG_PUZZLE_ID) return;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore quota errors or private browsing
  }
}
