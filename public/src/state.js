export function createInitialState(puzzle) {
  return {
    activePuzzle: puzzle,

    // boardWords: [{ word, lockedPalette:null|color }]
    boardWords: [],

    // selected: Set<string>
    selected: new Set(),

    // foundGroups: array of group objects
    foundGroups: [],

    // revealedCategories: Set<number> (indices into puzzle.groups)
    revealedCategories: new Set(),
  };
}

