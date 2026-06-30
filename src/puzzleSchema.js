export function groupWordTexts(group) {
  return group.words.map((w) => w.text);
}

export function allWordTexts(puzzle) {
  return puzzle.groups.flatMap(groupWordTexts);
}

export function findWordEntry(puzzle, text) {
  for (const group of puzzle.groups) {
    const entry = group.words.find((w) => w.text === text);
    if (entry) return entry;
  }
  return null;
}

export function findGroupIndex(puzzle, group) {
  return puzzle.groups.indexOf(group);
}
