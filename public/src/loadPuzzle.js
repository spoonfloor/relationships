/**
 * @fileoverview Copyright 2025 Ed Korthof and Cristie Henry
 */

import { validatePuzzle, validatePuzzleIndex } from "./validation.js";

export { validatePuzzle, validatePuzzleIndex };

export async function loadPuzzle(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  const puzzle = await res.json();
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
