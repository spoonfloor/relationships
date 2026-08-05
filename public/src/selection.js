export const CHUNK_SIZE = 4;
export const MAX_CHUNKS = 4;
export const MAX_SELECTION = CHUNK_SIZE * MAX_CHUNKS;

/** @returns {string[][]} */
export function createEmptySelectionSets() {
  return Array.from({ length: MAX_CHUNKS }, () => []);
}

export function clearSelection(state) {
  state.selectionSets = createEmptySelectionSets();
}

export function getSelectionCount(state) {
  return state.selectionSets.reduce((sum, set) => sum + set.length, 0);
}

export function isSelected(state, word) {
  return state.selectionSets.some((set) => set.includes(word));
}

/** @returns {0 | 1 | 2 | 3 | null} */
export function getSelectionBand(state, word) {
  const setIndex = state.selectionSets.findIndex((set) => set.includes(word));
  if (setIndex === -1) return null;
  return /** @type {0 | 1 | 2 | 3} */ (setIndex);
}

function findFirstSetWithVacancy(state) {
  return state.selectionSets.findIndex((set) => set.length < CHUNK_SIZE);
}

export function toggleSelection(state, word) {
  for (const set of state.selectionSets) {
    const index = set.indexOf(word);
    if (index !== -1) {
      set.splice(index, 1);
      return { ok: true };
    }
  }

  if (getSelectionCount(state) >= MAX_SELECTION) {
    return { ok: false, message: "You can only select 16 at a time." };
  }

  const vacancySet = findFirstSetWithVacancy(state);
  if (vacancySet === -1) {
    return { ok: false, message: "You can only select 16 at a time." };
  }

  state.selectionSets[vacancySet].push(word);
  return { ok: true };
}

/**
 * Complete sets of four in set order; partial sets omitted.
 * @returns {{ setIndex: 0 | 1 | 2 | 3, words: string[] }[]}
 */
export function chunkSelection(state) {
  /** @type {{ setIndex: 0 | 1 | 2 | 3, words: string[] }[]} */
  const chunks = [];
  state.selectionSets.forEach((set, setIndex) => {
    if (set.length === CHUNK_SIZE) {
      chunks.push({
        setIndex: /** @type {0 | 1 | 2 | 3} */ (setIndex),
        words: set.slice(),
      });
    }
  });
  return chunks;
}
