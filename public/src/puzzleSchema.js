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
  const idx = puzzle.groups.indexOf(group);
  if (idx !== -1) return idx;
  return puzzle.groups.findIndex((g) => g.title === group.title);
}

export function puzzleHasGlossary(puzzle) {
  return puzzle.groups.some((group) =>
    group.words.some((word) => (word.definitions?.length ?? 0) > 0)
  );
}

export function collectGlossaryEntries(puzzle) {
  return puzzle.groups
    .flatMap((group) => group.words)
    .filter((word) => (word.definitions?.length ?? 0) > 0)
    .map((word) => ({ word: word.text, definitions: word.definitions }))
    .sort((a, b) => a.word.localeCompare(b.word));
}

/**
 * Serialize the canonical per-word definitions into the glossary editor format.
 * @param {object} puzzle
 */
export function serializeGlossaryText(puzzle) {
  return collectGlossaryEntries(puzzle)
    .map(({ word, definitions }) =>
      [word, ...definitions.map((definition) => `- ${definition}`)].join("\n")
    )
    .join("\n");
}

/**
 * Apply glossary editor text to the canonical per-word definitions.
 * Lines without a leading hyphen name puzzle words; following hyphenated lines
 * are their definitions. The update is rejected when a term does not match a
 * puzzle word because glossary data is owned by puzzle words.
 *
 * @param {object} puzzle
 * @param {string} text
 * @returns {{ unknownTerms: string[] }}
 */
export function applyGlossaryText(puzzle, text) {
  const words = puzzle.groups.flatMap((group) => group.words);
  const wordsByText = new Map(
    words.map((word) => [String(word.text ?? "").trim().toLocaleLowerCase(), word])
  );
  const definitionsByWord = new Map();
  const unknownTerms = [];
  let currentWord = null;

  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (!trimmed.startsWith("-")) {
      currentWord = wordsByText.get(trimmed.toLocaleLowerCase()) ?? null;
      if (!currentWord) unknownTerms.push(trimmed);
      continue;
    }

    const definition = trimmed.slice(1).trim();
    if (!currentWord || !definition) continue;
    const definitions = definitionsByWord.get(currentWord) ?? [];
    definitions.push(definition);
    definitionsByWord.set(currentWord, definitions);
  }

  if (unknownTerms.length) return { unknownTerms };

  for (const word of words) {
    word.definitions = definitionsByWord.get(word) ?? [];
  }

  return { unknownTerms };
}
