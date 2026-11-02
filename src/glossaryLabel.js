/**
 * Playful stand-ins for "Glossary" on the play footer CTA and sheet title.
 *
 * Labels rotate across puzzles in picker order. Each tab session picks up where
 * the previous one stopped: a persistent cursor (localStorage) advances by the
 * puzzle count at session start, and the session's starting offset is pinned in
 * sessionStorage so reloads within the tab keep the same labels.
 */
const LABELS = [
  "Defunitions",
  "Quiptionary",
  "Lexicomedy",
  "Quibliography",
  "Curiglossity",
  "Vocablurry",
  "Epigrammoire",
  "Sillybary",
  "Addenddumb",
  "Gloss-hilarity",
  "Depunitions",
  "Codicilliness",
  "Irrevrenitions",
  "Piquetionary",
  "Nomenclator",
  "Gigglossary",
  "Word-hoard",
  "Semantickle",
  "Dictionoodle",
  "Parsing fancy",
  "Glossolalia",
];
const DEFAULT_LABEL = "Glossary";
const CURSOR_KEY = "relationships.glossaryLabelCursor";
const SESSION_START_KEY = "relationships.glossaryLabelStart";

let sessionStart = 0;

/** @param {string | null} raw @returns {number | null} */
function parseIndex(raw) {
  const value = Number(raw);
  return raw != null && Number.isInteger(value) && value >= 0 ? value % LABELS.length : null;
}

/** @param {number} puzzleCount */
export function initGlossaryLabels(puzzleCount) {
  try {
    const pinned = parseIndex(sessionStorage.getItem(SESSION_START_KEY));
    if (pinned != null) {
      sessionStart = pinned;
      return;
    }
    sessionStart = parseIndex(localStorage.getItem(CURSOR_KEY)) ?? 0;
    sessionStorage.setItem(SESSION_START_KEY, String(sessionStart));
    localStorage.setItem(CURSOR_KEY, String((sessionStart + puzzleCount) % LABELS.length));
  } catch {
    // storage unavailable: rotation restarts each load
  }
}

/**
 * @param {number} puzzleIndex position in the puzzle picker; -1 when not listed
 * @returns {string}
 */
export function glossaryLabelFor(puzzleIndex) {
  if (puzzleIndex < 0) return DEFAULT_LABEL;
  return LABELS[(sessionStart + puzzleIndex) % LABELS.length];
}
