import Hypher from "./vendor/hypher.js";
import english from "./vendor/hyphenation.en-us.js";

const hypher = new Hypher(english);

/** Skip hyphenating short tokens (LACE, ROSE, etc.). */
const MIN_HYPHEN_WORD_LEN = 6;

const LEFT_MIN = english.leftmin ?? 2;
const RIGHT_MIN = english.rightmin ?? 3;

/** @param {string} word */
function hyphenFragments(word) {
  if (word.length <= MIN_HYPHEN_WORD_LEN) return [word];
  return hypher.hyphenate(word);
}

/**
 * All legal break indices (break after character at index i).
 * @param {string} word
 * @returns {number[]}
 */
export function getBreakCandidates(word) {
  if (word.length <= MIN_HYPHEN_WORD_LEN) return [];

  const candidates = new Set();
  let pos = 0;
  const fragments = hyphenFragments(word);
  for (let i = 0; i < fragments.length - 1; i += 1) {
    pos += fragments[i].length;
    candidates.add(pos);
  }

  for (let i = LEFT_MIN; i <= word.length - RIGHT_MIN; i += 1) {
    candidates.add(i);
  }

  return [...candidates].sort((a, b) => a - b);
}

/**
 * @param {string} word
 * @param {number[]} breaks sorted break indices
 * @returns {string[]}
 */
export function linesFromBreaks(word, breaks) {
  if (breaks.length === 0) return [word];

  const sorted = [...breaks].sort((a, b) => a - b);
  const lines = [];
  let start = 0;
  for (const breakAt of sorted) {
    lines.push(`${word.slice(start, breakAt)}-`);
    start = breakAt;
  }
  lines.push(word.slice(start));
  return lines;
}

/** Lower max line length and fewer lines win. */
function layoutScore(lines) {
  const lengths = lines.map((line) => line.replace(/-$/, "").length);
  const maxLen = Math.max(...lengths);
  const spread = maxLen - Math.min(...lengths);
  return maxLen * 100 + spread * 10 + lines.length;
}

/**
 * @param {string} word
 * @param {number[]} candidates
 * @param {number} lineCount
 * @returns {number[] | null}
 */
function bestBreaksForLineCount(word, candidates, lineCount) {
  if (lineCount <= 1) return [];
  const breakCount = lineCount - 1;
  if (candidates.length < breakCount) return null;

  /** @type {number[] | null} */
  let bestBreaks = null;
  let bestScore = Infinity;

  function tryBreaks(start, chosen) {
    if (chosen.length === breakCount) {
      const lines = linesFromBreaks(word, chosen);
      const score = layoutScore(lines);
      if (score < bestScore) {
        bestScore = score;
        bestBreaks = [...chosen];
      }
      return;
    }
    const remaining = breakCount - chosen.length;
    for (let i = start; i <= candidates.length - remaining; i += 1) {
      tryBreaks(i + 1, [...chosen, candidates[i]]);
    }
  }

  tryBreaks(0, []);
  return bestBreaks;
}

/**
 * Line layouts to try in order: fewest lines first, best-balanced within each count.
 * @param {string} word
 * @param {number} [maxLines]
 * @returns {string[][]}
 */
export function planTileLineLayouts(word, maxLines = 4) {
  if (!word) return [[""]];

  const candidates = getBreakCandidates(word);
  const layouts = [];
  const limit = Math.min(maxLines, candidates.length + 1);

  for (let lineCount = 1; lineCount <= limit; lineCount += 1) {
    const breaks = bestBreaksForLineCount(word, candidates, lineCount);
    if (breaks == null) continue;
    layouts.push(linesFromBreaks(word, breaks));
  }

  if (layouts.length === 0) layouts.push([word]);
  return layouts;
}

/** Insert soft hyphens at syllable boundaries for display only. */
export function insertSoftHyphens(text) {
  if (text == null || text === "") return "";
  return hypher.hyphenateText(String(text), MIN_HYPHEN_WORD_LEN);
}
