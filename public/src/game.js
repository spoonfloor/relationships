import { shuffle } from "./utils.js";
import { groupWordTexts, findGroupIndex } from "./puzzleSchema.js";
import {
  CHUNK_SIZE,
  clearSelection,
  chunkSelection,
  getSelectionCount,
} from "./selection.js";

function pickPuzzleWords(puzzle) {
  return shuffle(puzzle.groups.flatMap(groupWordTexts));
}

export function initGameState(state) {
  state.foundGroups = [];
  state.revealedCategories.clear();
  state.revealedWords.clear();
  state.guesses = [];
  clearSelection(state);
  state.wordToGroupMap.clear();

  for (const group of state.activePuzzle.groups) {
    for (const word of groupWordTexts(group)) {
      state.wordToGroupMap.set(word, group);
    }
  }

  state.boardWords = pickPuzzleWords(state.activePuzzle)
    .map((word) => ({ word, lockedGroupIndex: null }));
}

export function clearSelectionAndReveals(state) {
  clearSelection(state);
  state.revealedWords.clear();
}

export function resetGameProgress(state) {
  state.foundGroups = [];
  state.revealedCategories.clear();
  state.revealedWords.clear();
  state.guesses = [];
  clearSelection(state);
  for (const item of state.boardWords) {
    item.lockedGroupIndex = null;
  }
}

function getGroupBySelection(puzzle, wordsArr) {
  const sel = new Set(wordsArr);
  return puzzle.groups.find((g) => groupWordTexts(g).every((w) => sel.has(w)));
}

function isGroupFound(state, group) {
  const found = state.foundGroups.find((g) => g.title === group.title);
  return found && found.words.length > 0;
}

function lockWords(state, wordsArr, groupIndex) {
  for (const item of state.boardWords) {
    if (wordsArr.includes(item.word)) item.lockedGroupIndex = groupIndex;
  }
}

function getGroupOverlapPattern(words, wordToGroupMap) {
  const groupCounts = new Map();
  for (const word of words) {
    const group = wordToGroupMap.get(word);
    const key = group?.title ?? word;
    groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
  }
  const sizes = [...groupCounts.values()].sort((a, b) => b - a);
  return sizes.map((n, i) => String.fromCharCode(65 + i).repeat(n)).join("");
}

export function getProximityFeedback(words, wordToGroupMap) {
  switch (getGroupOverlapPattern(words, wordToGroupMap)) {
    case "AAAA":
      return "Correct!";
    case "AAAB":
      return "One away…";
    case "AABB":
    case "AABC":
      return "Halfway there.";
    default:
      return "Not quite.";
  }
}

export function evaluateGuess(state, words, wittyResponses) {
  const proximityMessage = getProximityFeedback(words, state.wordToGroupMap);
  const canonicalWordStrings = [...words].sort();
  const shuffledWords = shuffle(words);

  const guess = {
    canonicalWords: canonicalWordStrings,
    words: shuffledWords.map((word) => {
      const group = state.wordToGroupMap.get(word);
      return { word, colors: group.colors };
    }),
    isCorrect: false,
  };

  const isRepeated = state.guesses.some(
    (g) =>
      g.canonicalWords.length === guess.canonicalWords.length &&
      g.canonicalWords.every((w, i) => w === guess.canonicalWords[i])
  );

  const group = getGroupBySelection(state.activePuzzle, words);
  if (group) {
    guess.isCorrect = true;
  }

  if (isRepeated && !guess.isCorrect) {
    const randomIndex = Math.floor(Math.random() * wittyResponses.length);
    const message = wittyResponses[randomIndex];
    return { ok: false, message, toastMessage: message };
  }

  state.guesses.push(guess);

  if (!group) {
    return {
      ok: false,
      message: "Nope — those 4 don't form a group in this puzzle.",
      toastMessage: proximityMessage,
    };
  }

  const existing = state.foundGroups.find((g) => g.title === group.title);
  if (existing) {
    existing.words = group.words;
  } else {
    state.foundGroups.push(group);
  }

  const groupIndex = findGroupIndex(state.activePuzzle, group);
  lockWords(state, groupWordTexts(group), groupIndex);

  const solvedGroupsCount = state.foundGroups.filter((g) => g.words.length > 0).length;
  const solved = solvedGroupsCount === 4;
  return {
    ok: true,
    group,
    solved,
    message: solved ? "Solved! 🎉" : `Correct! ${4 - solvedGroupsCount} groups left.`,
    toastMessage: proximityMessage,
  };
}

function getSetFeedback(result) {
  if (result.ok && result.group) return "Solved!";
  return result.toastMessage ?? result.message ?? "Not quite.";
}

/** @param {{ setIndex: 0 | 1 | 2 | 3, words: string[] }[]} chunks */
function resolveSubmitFeedback(results) {
  const count = results.length;
  if (count === 0) {
    return { mode: /** @type {const} */ ("none") };
  }
  if (count === 1) {
    const [result] = results;
    return {
      mode: /** @type {const} */ ("toast"),
      toastMessage: result.toastMessage ?? result.message ?? "Not quite.",
    };
  }
  const allSuccess = results.every((result) => result.ok && result.group);
  if (allSuccess) {
    return { mode: /** @type {const} */ ("none") };
  }
  return {
    mode: /** @type {const} */ ("modal"),
    rows: results.map((result) => ({
      setIndex: result.setIndex,
      feedback: getSetFeedback(result),
    })),
  };
}

export function isPuzzleComplete(state) {
  return (
    state.boardWords.length > 0 &&
    state.boardWords.every((item) => item.lockedGroupIndex != null)
  );
}

export function canSubmitSelection(state) {
  if (!state.activePuzzle?.groups?.length) return false;
  if (isPuzzleComplete(state)) return false;
  return getSelectionCount(state) >= CHUNK_SIZE;
}

export function submitSelection(state, wittyResponses) {
  if (getSelectionCount(state) < CHUNK_SIZE) {
    return {
      ok: false,
      message: "Select at least 4 words.",
      toasts: ["Select at least 4 words."],
      results: [],
      solved: false,
      feedback: { mode: /** @type {const} */ ("toast"), toastMessage: "Select at least 4 words." },
    };
  }

  const chunks = chunkSelection(state);
  const results = [];
  let anySuccess = false;
  let lastSuccessMessage = null;
  let lastFailureMessage = null;
  let solved = false;

  for (const { setIndex, words } of chunks) {
    const result = evaluateGuess(state, words, wittyResponses);
    results.push({ ...result, setIndex, words });
    if (result.ok && result.group) {
      anySuccess = true;
      lastSuccessMessage = result.message;
      if (result.solved) {
        solved = true;
      }
    } else if (!result.ok) {
      lastFailureMessage = result.message;
    }
  }

  let message;
  if (solved) {
    message = "Solved! 🎉";
  } else if (anySuccess) {
    message = lastSuccessMessage ?? "Correct!";
  } else {
    message = lastFailureMessage ?? "Nope — those 4 don't form a group in this puzzle.";
  }

  const feedback = resolveSubmitFeedback(results);

  return {
    ok: anySuccess || solved,
    results,
    solved,
    message,
    feedback,
    toasts:
      feedback.mode === "toast" && feedback.toastMessage
        ? [feedback.toastMessage]
        : [],
  };
}

export function shuffleUnlocked(state) {
  const locked = state.boardWords.filter((b) => b.lockedGroupIndex != null);
  const unlocked = shuffle(state.boardWords.filter((b) => b.lockedGroupIndex == null));
  state.boardWords = shuffle([...unlocked, ...locked]);
}

export function hintRevealCategory(state) {
  const remaining = state.activePuzzle.groups
    .map((g, idx) => ({ g, idx }))
    .filter(
      ({ g, idx }) =>
        !state.foundGroups.some((f) => f.title === g.title) &&
        !state.revealedCategories.has(idx)
    );

  if (remaining.length === 0) return { ok: false, message: "No categories left to reveal." };

  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  state.revealedCategories.add(pick.idx);

  const revealedGroup = { ...pick.g, words: [] };
  state.foundGroups.push(revealedGroup);
  return { ok: true, group: revealedGroup, message: "Hint: Revealed a group." };
}

export function solvePuzzle(state) {
  const remaining = state.activePuzzle.groups.filter((g) => !isGroupFound(state, g));

  for (const group of remaining) {
    const existing = state.foundGroups.find((g) => g.title === group.title);
    if (existing) {
      existing.words = group.words;
    } else {
      state.foundGroups.push(group);
    }
    const groupIndex = findGroupIndex(state.activePuzzle, group);
    lockWords(state, groupWordTexts(group), groupIndex);
  }

  clearSelection(state);
  state.revealedWords.clear();
  return { ok: true, solved: true, debugSolve: true, message: "Solved! 🎉" };
}

export function generateDebugGuessHistory(puzzle) {
  const groups = puzzle.groups;
  const total = 4 + Math.floor(Math.random() * 9);
  const guesses = [];

  for (let i = 0; i < total - 4; i++) {
    let indices;
    do {
      indices = Array.from({ length: 4 }, () => Math.floor(Math.random() * groups.length));
    } while (indices.every((idx) => idx === indices[0]));
    guesses.push({
      words: indices.map((idx) => ({ word: "", colors: groups[idx].colors })),
      isCorrect: false,
    });
  }

  for (const group of shuffle([...groups])) {
    guesses.push({
      words: Array.from({ length: 4 }, () => ({ word: "", colors: group.colors })),
      isCorrect: true,
    });
  }

  return guesses;
}

export function hintRevealWord(state) {
  if (getSelectionCount(state) > 0) clearSelection(state);

  const remainingGroups = state.activePuzzle.groups.filter((g) => !isGroupFound(state, g));
  if (remainingGroups.length === 0) return { ok: false, message: "No words left to reveal." };

  const g = remainingGroups[Math.floor(Math.random() * remainingGroups.length)];
  const unlockedWords = groupWordTexts(g).filter((w) => {
    const item = state.boardWords.find((b) => b.word === w);
    return item && item.lockedGroupIndex == null;
  });
  if (unlockedWords.length === 0) {
    return { ok: false, message: "No revealable words in remaining groups." };
  }

  const w = unlockedWords[Math.floor(Math.random() * unlockedWords.length)];
  state.revealedWords.add(w);
  return { ok: true, message: `Hint: revealed “${w}”.` };
}
