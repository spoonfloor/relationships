export const CHUNK_SIZE = 4;
export const MAX_CHUNKS = 4;
export const MAX_SELECTION = CHUNK_SIZE * MAX_CHUNKS;

export function clearSelection(state) {
  state.selectedWords.length = 0;
}

export function getSelectionCount(state) {
  return state.selectedWords.length;
}

export function isSelected(state, word) {
  return state.selectedWords.includes(word);
}

/** @returns {0 | 1 | 2 | 3 | null} */
export function getSelectionBand(state, word) {
  const index = state.selectedWords.indexOf(word);
  if (index === -1) return null;
  return /** @type {0 | 1 | 2 | 3} */ (Math.floor(index / CHUNK_SIZE));
}

export function toggleSelection(state, word) {
  const index = state.selectedWords.indexOf(word);
  if (index !== -1) {
    state.selectedWords.splice(index, 1);
    return { ok: true };
  }
  if (state.selectedWords.length >= MAX_SELECTION) {
    return { ok: false, message: "You can only select 16 at a time." };
  }
  state.selectedWords.push(word);
  return { ok: true };
}

/** Complete groups of four in tap order; trailing partial chunk omitted. */
export function chunkSelection(state) {
  const words = state.selectedWords;
  const chunks = [];
  for (let i = 0; i + CHUNK_SIZE <= words.length; i += CHUNK_SIZE) {
    chunks.push(words.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

/** Drop words that were part of submitted complete chunks. */
export function removeEvaluatedChunks(state) {
  const evaluatedCount =
    Math.floor(state.selectedWords.length / CHUNK_SIZE) * CHUNK_SIZE;
  state.selectedWords.splice(0, evaluatedCount);
}

export function purgeLockedFromSelection(state) {
  const locked = new Set(
    state.boardWords
      .filter((item) => item.lockedGroupIndex != null)
      .map((item) => item.word),
  );
  if (locked.size === 0) return;
  state.selectedWords = state.selectedWords.filter((word) => !locked.has(word));
}
