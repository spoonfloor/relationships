export function createInitialState(puzzle) {
  return {
    activePuzzle: puzzle,

    // boardWords: [{ word, lockedGroupIndex: null|number }]
    boardWords: [],

    // selectedWords: string[] — tap order defines multi-set chunks
    selectedWords: [],

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

