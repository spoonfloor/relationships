const APOSTROPHE = "\u2019";
const OPEN_SINGLE = "\u2018";
const OPEN_DOUBLE = "\u201C";
const CLOSE_DOUBLE = "\u201D";

const OPEN_QUOTE_CONTEXT = /(^|[\s([{—–-])/;
const STRAIGHT_APOSTROPHE = "'";
const STRAIGHT_DOUBLE = '"';

/**
 * Convert straight quotes and apostrophes to typographic equivalents.
 * Idempotent for text that already uses curly quotes.
 */
export function formatDisplayText(text) {
  if (text == null) return "";
  let s = String(text);
  if (!s.includes(STRAIGHT_APOSTROPHE) && !s.includes(STRAIGHT_DOUBLE)) return s;

  s = s.replace(/(\w)'(\w)/g, `$1${APOSTROPHE}$2`);
  s = s.replace(/(\w)'s(\W|$)/g, `$1${APOSTROPHE}s$2`);
  s = s.replace(/(\w)s'(\W|$)/g, `$1s${APOSTROPHE}$2`);
  s = s.replace(/(\w)'(\W|$)/g, `$1${APOSTROPHE}$2`);
  s = s.replace(/'(\d)/g, `${APOSTROPHE}$1`);
  s = s.replace(/(\d)'/g, `$1${APOSTROPHE}`);

  s = s.replace(new RegExp(`${OPEN_QUOTE_CONTEXT.source}"`, "g"), `$1${OPEN_DOUBLE}`);
  s = s.replace(/"/g, CLOSE_DOUBLE);

  s = s.replace(new RegExp(`${OPEN_QUOTE_CONTEXT.source}'`, "g"), `$1${OPEN_SINGLE}`);
  s = s.replace(/'/g, APOSTROPHE);

  return s;
}
