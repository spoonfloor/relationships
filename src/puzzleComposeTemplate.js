/** Default group colors for published puzzles (not compose unset state). */
export const DEFAULT_GROUP_COLORS = [
  { text: "#916026", bg: "#E9C478", border: "#B48847" },
  { text: "#FFFADE", bg: "#C9BBA3", border: "#E9E1C6" },
  { text: "#783F04", bg: "#B9C08C", border: "#92733A" },
  { text: "#BDC7AE", bg: "#688364", border: "#9BAC90" },
];

export const COMPOSE_PLACEHOLDERS = {
  PUZZLE_TITLE: "Add a puzzle title",
  VIGNETTE: "Add a vignette",
  WORD: "?",
};

/** @param {number} groupIndex 0-based */
export function groupTitlePlaceholder(groupIndex) {
  return `Add title for set ${groupIndex + 1}`;
}

/** @param {number} _groupIndex 0-based @param {number} _wordIndex 0-based */
export function wordPlaceholder(_groupIndex, _wordIndex) {
  return COMPOSE_PLACEHOLDERS.WORD;
}

/** @param {number} groupIndex 0-based @param {number} wordIndex 0-based */
export function wordFieldLabel(groupIndex, wordIndex) {
  return `Word ${wordIndex + 1} in set ${groupIndex + 1}`;
}

/** Legacy grid coordinate shown before compose placeholders used "?". */
function legacyWordPlaceholder(groupIndex, wordIndex) {
  const row = groupIndex + 1;
  const col = String.fromCharCode(97 + wordIndex);
  return `${row}${col}`;
}

/** @param {string} value @param {number} groupIndex 0-based @param {number} wordIndex 0-based */
export function isWordPlaceholderValue(value, groupIndex, wordIndex) {
  if (isPlaceholderValue(value, COMPOSE_PLACEHOLDERS.WORD)) return true;
  return isPlaceholderValue(value, legacyWordPlaceholder(groupIndex, wordIndex));
}

/**
 * @param {string} value
 * @param {string} placeholder
 */
export function isPlaceholderValue(value, placeholder) {
  const trimmed = (value ?? "").trim();
  return !trimmed || trimmed.toLowerCase() === placeholder.toLowerCase();
}

const UNTITLED_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** @param {Date} [date] */
export function defaultUntitledTitle(date = new Date()) {
  const month = UNTITLED_MONTHS[date.getMonth()];
  return `Untitled ${month} ${date.getDate()}`;
}

/** @returns {object} Empty puzzle suitable for compose/create. */
export function createEmptyPuzzle() {
  return {
    id: "",
    title: "",
    vignette: "",
    glossary: [],
    groups: Array.from({ length: 4 }, () => ({
      title: "",
      colors: {},
      words: Array.from({ length: 4 }, () => ({ text: "", definitions: [] })),
    })),
  };
}

/** True when published_data is the pre-publish placeholder (not yet playable). */
export function isPublishedShell(puzzle) {
  if (!Array.isArray(puzzle?.groups) || puzzle.groups.length !== 4) return true;
  return puzzle.groups.some((group) =>
    !Array.isArray(group.words) ||
    group.words.length !== 4 ||
    group.words.some((word) => !String(word?.text ?? "").trim())
  );
}

/**
 * Published shell for a newly inserted row (draft holds authoring content).
 * @param {string} id
 * @param {string} title
 */
export function createPublishedShell(id, title) {
  const shell = createEmptyPuzzle();
  shell.id = id;
  shell.title = title || defaultUntitledTitle();
  return shell;
}
