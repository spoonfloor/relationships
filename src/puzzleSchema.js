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

/**
 * Build glossary entries from legacy per-word definitions.
 * @param {object} puzzle
 * @returns {{ term: string | null, definitions: string[] }[]}
 */
function migrateGlossaryFromWords(puzzle) {
  const entries = puzzle.groups
    .flatMap((group) => group.words)
    .filter((word) => (word.definitions?.length ?? 0) > 0)
    .map((word) => ({ term: word.text, definitions: [...word.definitions] }));
  sortGlossaryEntries(entries);
  return entries;
}

/**
 * Ensure puzzle.glossary exists, migrating from word.definitions when needed.
 * Mutates `puzzle` in place.
 * @param {object} puzzle
 */
export function ensureGlossary(puzzle) {
  if (!Array.isArray(puzzle.glossary)) {
    puzzle.glossary = migrateGlossaryFromWords(puzzle);
  }
  return puzzle;
}

/** @param {{ term: string | null, definitions: string[] }} a @param {{ term: string | null, definitions: string[] }} b */
function compareGlossaryEntries(a, b) {
  const aNull = a.term == null || a.term === "";
  const bNull = b.term == null || b.term === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  return a.term.localeCompare(b.term, undefined, { sensitivity: "base" });
}

/** @param {{ term: string | null, definitions: string[] }[]} glossary */
export function sortGlossaryEntries(glossary) {
  glossary.sort(compareGlossaryEntries);
}

export function puzzleHasGlossary(puzzle) {
  ensureGlossary(puzzle);
  return puzzle.glossary.some(
    (entry) =>
      (entry.definitions?.length ?? 0) > 0 ||
      (entry.term != null && entry.term !== "")
  );
}

/**
 * @param {object} puzzle
 * @returns {{ term: string | null, definitions: string[] }[]}
 */
export function collectGlossaryEntries(puzzle) {
  ensureGlossary(puzzle);
  return puzzle.glossary.filter(
    (entry) =>
      (entry.definitions?.length ?? 0) > 0 ||
      (entry.term != null && entry.term !== "")
  );
}

/**
 * @param {object} puzzle
 * @param {string} wordText
 * @returns {string[]}
 */
export function findGlossaryDefinitions(puzzle, wordText) {
  ensureGlossary(puzzle);
  const key = String(wordText ?? "").trim().toLocaleLowerCase();
  const entry = puzzle.glossary.find(
    (item) => String(item.term ?? "").trim().toLocaleLowerCase() === key
  );
  return entry?.definitions ?? [];
}

/**
 * @param {{ term: string | null, definitions: string[] }} entry
 */
function serializeGlossaryEntry(entry) {
  const lines = [];
  if (entry.term != null && entry.term !== "") {
    lines.push(entry.term);
  }
  for (const definition of entry.definitions ?? []) {
    const parts = String(definition).split("\n");
    lines.push(`- ${parts[0] ?? ""}`);
    for (const part of parts.slice(1)) {
      lines.push(`+ ${part}`);
    }
  }
  return lines.join("\n");
}

/**
 * Serialize glossary entries into editor text.
 * @param {object} puzzle
 */
export function serializeGlossaryText(puzzle) {
  return collectGlossaryEntries(puzzle).map(serializeGlossaryEntry).join("\n");
}

/**
 * Parse glossary editor text into entries. Permissive: any term, orphan definitions allowed.
 * `-` starts a definition; `+` continues the previous definition (nested line).
 * @param {string} text
 * @returns {{ term: string | null, definitions: string[] }[]}
 */
export function parseGlossaryText(text) {
  /** @type {{ term: string | null, definitions: string[] }[]} */
  const entries = [];
  /** @type {{ term: string | null, definitions: string[] } | null} */
  let current = null;

  function pushCurrent() {
    if (!current) return;
    entries.push(current);
    current = null;
  }

  function ensureCurrent() {
    if (!current) current = { term: null, definitions: [] };
    return current;
  }

  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("-")) {
      const definition = trimmed.slice(1).trim();
      if (!definition) continue;
      ensureCurrent().definitions.push(definition);
      continue;
    }

    if (trimmed.startsWith("+")) {
      const continuation = trimmed.slice(1).trim();
      if (!continuation) continue;
      const entry = ensureCurrent();
      if (entry.definitions.length > 0) {
        entry.definitions[entry.definitions.length - 1] += `\n${continuation}`;
      } else {
        entry.definitions.push(continuation);
      }
      continue;
    }

    pushCurrent();
    current = { term: trimmed, definitions: [] };
  }

  pushCurrent();
  return entries;
}

/**
 * Apply glossary editor text to puzzle.glossary (A–Z sort only).
 * @param {object} puzzle
 * @param {string} text
 */
export function applyGlossaryText(puzzle, text) {
  ensureGlossary(puzzle);
  puzzle.glossary = parseGlossaryText(text);
  sortGlossaryEntries(puzzle.glossary);
  return puzzle;
}

/**
 * Sort glossary entries A–Z. Mutates `puzzle` in place.
 * @param {object} puzzle
 */
export function normalizeGlossary(puzzle) {
  ensureGlossary(puzzle);
  sortGlossaryEntries(puzzle.glossary);
  return puzzle;
}

// Text limits --------------------------------------------------------------
// Character caps enforced in compose. Sized so display never truncates
// conforming text; display clamps only catch older data that predates them.

export const MAX_WORD_LENGTH = 30;
export const MAX_SET_TITLE_LENGTH = 80;
export const MAX_PUZZLE_TITLE_LENGTH = 60;

// Secret set ---------------------------------------------------------------
// An optional easter-egg set: four board words, usually one decoy from each
// real set. Stored as positions ({ group, word }) so it survives word edits.
// Drafts may hold 0–4 picks; play only uses a complete secret set.

export const SECRET_SET_SIZE = 4;

/** @typedef {{ group: number, word: number }} SecretRef */

/** @param {SecretRef} a @param {SecretRef} b */
export function compareSecretRefs(a, b) {
  return a.group - b.group || a.word - b.word;
}

/** "1-B" style label for a board position. @param {SecretRef} ref */
export function secretRefLabel(ref) {
  return `${ref.group + 1}-${String.fromCharCode(65 + ref.word)}`;
}

/** True when the refs are exactly one real set's four words. @param {SecretRef[]} refs */
export function isWholeSet(refs) {
  return (
    refs.length === SECRET_SET_SIZE &&
    refs.every((ref) => ref.group === refs[0].group)
  );
}

/**
 * The playable secret set, or null when there is none or it is incomplete.
 * @param {object} puzzle
 * @returns {{ title: string, words: string[] } | null}
 */
export function getPlayableSecret(puzzle) {
  const refs = puzzle?.secret?.words;
  if (!Array.isArray(refs) || refs.length !== SECRET_SET_SIZE || isWholeSet(refs)) {
    return null;
  }
  const words = refs.map((ref) => puzzle.groups[ref.group]?.words[ref.word]?.text ?? "");
  if (words.some((text) => !text.trim())) return null;
  return { title: puzzle.secret.title ?? "", words };
}

/** True when the author has picked 1–3 secret words. @param {object} puzzle */
export function hasPartialSecret(puzzle) {
  const count = puzzle?.secret?.words?.length ?? 0;
  return count > 0 && count < SECRET_SET_SIZE;
}
