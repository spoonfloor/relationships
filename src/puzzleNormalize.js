import { normalizeGlossary } from "./puzzleSchema.js";
import {
  COMPOSE_PLACEHOLDERS,
  createEmptyPuzzle,
  defaultUntitledTitle,
  groupTitlePlaceholder,
  isPlaceholderValue,
  isWordPlaceholderValue,
} from "./puzzleComposeTemplate.js";

const GROUP_COUNT = 4;
const WORDS_PER_GROUP = 4;

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeWord(word, gi, wi) {
  const base = asObject(word);
  let text = asString(base.text);
  if (isWordPlaceholderValue(text, gi, wi)) {
    text = "";
  }
  const definitions = Array.isArray(base.definitions)
    ? base.definitions.filter((def) => typeof def === "string")
    : [];
  return { text, definitions };
}

function normalizeGroup(group, gi, templateGroup) {
  const base = asObject(group);
  let title = asString(base.title);
  if (isPlaceholderValue(title, groupTitlePlaceholder(gi))) {
    title = "";
  }
  const colors = asObject(base.colors);
  const templateWords = templateGroup.words;
  const words = Array.from({ length: WORDS_PER_GROUP }, (_, wi) =>
    normalizeWord(base.words?.[wi] ?? templateWords[wi], gi, wi)
  );
  return { title, colors, words };
}

/**
 * Coerce puzzle data into a display-safe 4×4 shape. Mutates `puzzle` in place.
 * Editorial completeness is not enforced — only structural displayability.
 * @param {object} puzzle
 */
export function normalizePuzzle(puzzle) {
  const template = createEmptyPuzzle();

  if (isPlaceholderValue(puzzle.title ?? "", COMPOSE_PLACEHOLDERS.PUZZLE_TITLE)) {
    puzzle.title = defaultUntitledTitle();
  } else {
    puzzle.title = asString(puzzle.title);
  }

  if (isPlaceholderValue(puzzle.vignette ?? "", COMPOSE_PLACEHOLDERS.VIGNETTE)) {
    puzzle.vignette = "";
  } else {
    puzzle.vignette = asString(puzzle.vignette);
  }

  if (!Array.isArray(puzzle.glossary)) {
    puzzle.glossary = [];
  }

  const sourceGroups = Array.isArray(puzzle.groups) ? puzzle.groups : [];
  puzzle.groups = Array.from({ length: GROUP_COUNT }, (_, gi) =>
    normalizeGroup(sourceGroups[gi], gi, template.groups[gi])
  );

  normalizeGlossary(puzzle);
  return puzzle;
}

/**
 * After normalization, ensure the puzzle has a non-empty title.
 * @param {object} puzzle
 * @returns {string | null} error message, or null if ok
 */
export function requirePuzzleTitle(puzzle) {
  normalizePuzzle(puzzle);
  if (!puzzle.title.trim()) {
    return "Puzzle must have a title.";
  }
  return null;
}

/**
 * @param {object} puzzle
 * @param {{ requireId?: boolean }} [options]
 * @returns {string | null}
 */
export function validateComposePublish(puzzle, { requireId = true } = {}) {
  const titleError = requirePuzzleTitle(puzzle);
  if (titleError) return titleError;

  if (requireId) {
    const id = typeof puzzle.id === "string" ? puzzle.id.trim() : "";
    if (!id) return "Puzzle must have an id.";
  }

  return null;
}

/**
 * Clone and normalize puzzle JSON from a Supabase row.
 * @param {import("./puzzleRepository.js").PuzzleRow} row
 * @param {'published' | 'draft'} [variant]
 */
export function hydratePuzzleFromRow(row, variant = "published") {
  const raw =
    variant === "draft"
      ? row.draft_data ?? row.published_data
      : row.published_data;
  if (!raw) {
    throw new Error(`Puzzle "${row.id}" has no ${variant} data`);
  }
  const puzzle = structuredClone(raw);
  if (typeof puzzle.id !== "string" || !puzzle.id.trim()) {
    puzzle.id = row.id;
  }
  return normalizePuzzle(puzzle);
}

/** @param {object} puzzle */
export function normalizedPuzzleSnapshot(puzzle) {
  return normalizePuzzle(structuredClone(puzzle));
}

/** @param {object} a @param {object} b */
export function puzzlesEquivalent(a, b) {
  return (
    JSON.stringify(normalizedPuzzleSnapshot(a)) ===
    JSON.stringify(normalizedPuzzleSnapshot(b))
  );
}
