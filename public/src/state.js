export function createInitialState(puzzle) {
  return {
    activePuzzle: puzzle,

    // boardWords: [{ word, lockedGroupIndex: null|number }]
    boardWords: [],

    // selectionSets: string[][] — four fixed guess slots; band color follows set index
    selectionSets: Array.from({ length: 4 }, () => []),

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

