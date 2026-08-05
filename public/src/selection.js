export const CHUNK_SIZE = 4;
export const MAX_CHUNKS = 4;
export const MAX_SELECTION = CHUNK_SIZE * MAX_CHUNKS;

/**
 * selectionSets is mutated only by toggleSelection, clearSelection, and game init/reset.
 * Submit and other game actions read selection; they never write it.
 */

/** @returns {string[][]} */
export function createEmptySelectionSets() {
  return Array.from({ length: MAX_CHUNKS }, () => []);
}

export function clearSelection(state) {
  state.selectionSets = createEmptySelectionSets();
}

function isUnlockedOnBoard(state, word) {
  const item = state.boardWords.find((boardItem) => boardItem.word === word);
  return item != null && item.lockedGroupIndex == null;
}

function getSetBoardSelectionCount(state, set) {
  return set.filter((word) => isUnlockedOnBoard(state, word)).length;
}

/** Count of selected tiles still on the board (ignores solved/locked ghosts in sets). */
export function getSelectionCount(state) {
  return state.selectionSets.reduce(
    (sum, set) => sum + getSetBoardSelectionCount(state, set),
    0,
  );
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
  return state.selectionSets.findIndex(
    (set) => getSetBoardSelectionCount(state, set) < CHUNK_SIZE,
  );
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
 * Complete sets of four unlocked board tiles in set order; partial sets omitted.
 * @returns {{ setIndex: 0 | 1 | 2 | 3, words: string[] }[]}
 */
export function chunkSelection(state) {
  /** @type {{ setIndex: 0 | 1 | 2 | 3, words: string[] }[]} */
  const chunks = [];
  state.selectionSets.forEach((set, setIndex) => {
    const words = set.filter((word) => isUnlockedOnBoard(state, word));
    if (words.length === CHUNK_SIZE) {
      chunks.push({
        setIndex: /** @type {0 | 1 | 2 | 3} */ (setIndex),
        words: words.slice(),
      });
    }
  });
  return chunks;
}
