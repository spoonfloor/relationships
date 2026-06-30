export function createInitialState(puzzle) {
  return {
    activePuzzle: puzzle,

    // boardWords: [{ word, lockedGroupIndex: null|number }]
    boardWords: [],

    // selected: Set<string>
    selected: new Set(),

    // revealedWords: Set<string>
    revealedWords: new Set(),

    // wordToGroupMap: Map<string, group>
    wordToGroupMap: new Map(),

    // foundGroups: array of group objects
    foundGroups: [],

    // revealedCategories: Set<number> (indices into puzzle.groups)
    revealedCategories: new Set(),

    // guesses: array of guess objects
    guesses: [],

    // glossaryEnabled: boolean
    glossaryEnabled: false,
  };
}

