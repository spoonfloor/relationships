import { shuffle } from "./utils.js";
import { groupWordTexts, findGroupIndex } from "./puzzleSchema.js";

function pickPuzzleWords(puzzle) {
  return shuffle(puzzle.groups.flatMap(groupWordTexts));
}

export function initGameState(state) {
  state.foundGroups = [];
  state.revealedCategories.clear();
  state.revealedWords.clear();
  state.guesses = [];
  state.selected.clear();
  state.wordToGroupMap.clear();

  for (const group of state.activePuzzle.groups) {
    for (const word of groupWordTexts(group)) {
      state.wordToGroupMap.set(word, group);
    }
  }

  state.boardWords = pickPuzzleWords(state.activePuzzle)
    .map((word) => ({ word, lockedGroupIndex: null }));
}

export function toggleSelect(state, word) {
  if (state.selected.has(word)) {
    state.selected.delete(word);
    return { ok: true };
  }
  if (state.selected.size >= 4) {
    return { ok: false, message: "You can only select 4 at a time." };
  }
  state.selected.add(word);
  return { ok: true };
}

export function clearSelection(state) {
  state.selected.clear();
  state.revealedWords.clear();
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

export function submitSelection(state, wittyResponses) {
  if (state.selected.size !== 4) {
    return { ok: false, message: "Select exactly 4 words." };
  }

  const words = Array.from(state.selected);
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

  let group = getGroupBySelection(state.activePuzzle, words);
  if (group) {
    guess.isCorrect = true;
  }

  if (isRepeated && !guess.isCorrect) {
    const randomIndex = Math.floor(Math.random() * wittyResponses.length);
    return { ok: false, message: wittyResponses[randomIndex] };
  }
  state.guesses.push(guess);

  if (!group) {
    return { ok: false, message: "Nope — those 4 don't form a group in this puzzle." };
  }

  const existing = state.foundGroups.find((g) => g.title === group.title);
  if (existing) {
    existing.words = group.words;
    group = existing;
  } else {
    state.foundGroups.push(group);
  }

  const groupIndex = findGroupIndex(state.activePuzzle, group);
  lockWords(state, groupWordTexts(group), groupIndex);
  state.selected.clear();

  const solvedGroupsCount = state.foundGroups.filter((g) => g.words.length > 0).length;
  const solved = solvedGroupsCount === 4;
  return {
    ok: true,
    group,
    message: solved ? "Solved! 🎉" : `Correct! ${4 - solvedGroupsCount} groups left.`,
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

  state.selected.clear();
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
  if (state.selected.size >= 4) state.selected.clear();

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
