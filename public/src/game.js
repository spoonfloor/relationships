/**
 * @fileoverview Copyright 2025 Ed Korthof and Cristie Henry
 */

import { shuffle } from "./utils.js";

export function pickPuzzleWords(puzzle) {
  const words = puzzle.groups.flatMap(g => g.words);
  return shuffle(words);
}

export function initGameState(state) {
  state.foundGroups = [];
  state.revealedCategories.clear();
  state.revealedWords.clear();
  state.guesses = [];
  state.selected.clear();
  state.wordToGroupMap.clear();

  for (const group of state.activePuzzle.groups) {
    for (const word of group.words) {
      state.wordToGroupMap.set(word, group);
    }
  }

  state.boardWords = pickPuzzleWords(state.activePuzzle)
    .map(word => ({ word, lockedPalette: null }));
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

export function getGroupBySelection(puzzle, wordsArr) {
  const sel = new Set(wordsArr);
  return puzzle.groups.find(g => g.words.every(w => sel.has(w)));
}

export function isGroupFound(state, group) {
  const found = state.foundGroups.find(g => g.category === group.category);
  return found && found.words.length > 0;
}

export function lockWords(state, wordsArr, color) {
  for (const item of state.boardWords) {
    if (wordsArr.includes(item.word)) item.lockedPalette = color;
  }
}

export function submitSelection(state, wittyResponses) {
  if (state.selected.size !== 4) {
    return { ok: false, message: "Select exactly 4 words." };
  }

  const words = Array.from(state.selected);
  const shuffledWords = shuffle(words);

  const guess = {
    words: shuffledWords.map(word => {
      const group = state.wordToGroupMap.get(word);
      return { word, palette: group.palette };
    }),
    isCorrect: false,
  };

  const isRepeated = state.guesses.some(g =>
    g.words.length === guess.words.length &&
    g.words.every((w, i) => w.word === guess.words[i].word)
  );

  let group = getGroupBySelection(state.activePuzzle, words);
  if (group) {
    guess.isCorrect = true;
  }

  if (isRepeated && !guess.isCorrect) {
    const randomIndex = Math.floor(Math.random() * wittyResponses.length);
    return { ok: false, message: wittyResponses[randomIndex] };
  } else {
    state.guesses.push(guess);
  }

  if (!group) {
    return { ok: false, message: "Nope — those 4 don't form a group (in this demo puzzle)." };
  }

  console.log("submitSelection: state.foundGroups BEFORE:", state.foundGroups);

  const existing = state.foundGroups.find(g => g.category === group.category);
  if (existing) {
    existing.words = group.words;
    group = existing;
  } else {
    state.foundGroups.push(group);
  }

  console.log("submitSelection: state.foundGroups AFTER:", state.foundGroups);

  lockWords(state, group.words, group.palette);
  state.selected.clear();

  const solvedGroupsCount = state.foundGroups.filter(g => g.words.length > 0).length;
  const solved = solvedGroupsCount === 4;
  console.log("submitSelection: solvedGroupsCount:", solvedGroupsCount, "solved:", solved);
  return {
    ok: true,
    group,
    message: solved ? "Solved! 🎉" : `Correct! ${4 - solvedGroupsCount} groups left.`,
  };
}

export function assignColorToSelection(state, palette) {
  if (state.selected.size !== 4) {
    return { ok: false, message: "Select exactly 4 words to assign a color." };
  }
  const words = Array.from(state.selected);
  const group = getGroupBySelection(state.activePuzzle, words);
  if (!group) return { ok: false, message: "That selection isn't a correct group (demo)." };

  const forced = { ...group, palette };
  if (!isGroupFound(state, forced)) {
    state.foundGroups.push(forced);
    lockWords(state, forced.words, forced.palette);
  }
  state.selected.clear();
  return { ok: true, group: forced, message: "Locked." };
}

export function shuffleUnlocked(state) {
  const locked = state.boardWords.filter(b => b.lockedPalette);
  const unlocked = shuffle(state.boardWords.filter(b => !b.lockedPalette));
  state.boardWords = shuffle([...unlocked, ...locked]);
}

export function hintRevealCategory(state) {
  const remaining = state.activePuzzle.groups
    .map((g, idx) => ({ g, idx }))
    .filter(({ g, idx }) =>
      !state.foundGroups.some(f => f.category === g.category) &&
      !state.revealedCategories.has(idx)
    );

  if (remaining.length === 0) return { ok: false, message: "No categories left to reveal." };

  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  state.revealedCategories.add(pick.idx);

  const revealedGroup = { ...pick.g, words: [] };
  state.foundGroups.push(revealedGroup);
  console.log("hintRevealCategory: state.foundGroups AFTER:", state.foundGroups);
  return { ok: true, group: revealedGroup, message: `Hint: Revealed a group.` };
}

export function hintRevealWord(state) {
  if (state.selected.size >= 4) state.selected.clear();

  const remainingGroups = state.activePuzzle.groups.filter(g => !isGroupFound(state, g));
  if (remainingGroups.length === 0) return { ok: false, message: "No words left to reveal." };

  const g = remainingGroups[Math.floor(Math.random() * remainingGroups.length)];
  const unlockedWords = g.words.filter(w => {
    const item = state.boardWords.find(b => b.word === w);
    return item && !item.lockedPalette;
  });
  if (unlockedWords.length === 0) {
    return { ok: false, message: "No revealable words in remaining groups." };
  }

  const w = unlockedWords[Math.floor(Math.random() * unlockedWords.length)];
  state.revealedWords.add(w);
  return { ok: true, message: `Hint: revealed “${w}”.` };
}

