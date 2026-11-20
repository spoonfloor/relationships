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

    // secret: { title, emoji, canonicalWords } | null — the playable secret set, if any
    secret: null,

    // revealedCategories: Set<number> (indices into puzzle.groups)
    revealedCategories: new Set(),

    // guesses: array of guess objects
    guesses: [],

    // solveEmoji: string | null — picked once on solve so the win modal and
    // every share of that solve show the same emoji
    solveEmoji: null,

    // repeatMessages: rotation for the repeat-guess line; see nextRepeatGuessMessage
    repeatMessages: { queue: [], last: null },

    // glossaryEnabled: boolean
    glossaryEnabled: false,
  };
}

