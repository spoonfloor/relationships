/** Copy for the end-of-puzzle summary (Congratulations modal, share image). */

const SECRET_EMOJIS = ["🦄", "🤫", "🍀", "🤘"];

/** Ends a sentence already; the author's punctuation wins. */
const TERMINAL_PUNCTUATION = /[!?.…‽]$/u;
/** Trailing quotes/brackets to look past when checking for terminal punctuation. */
const TRAILING_CLOSERS = /["'”’)\]»]+$/u;
/** Punctuation left hanging at the end; dropped before adding “!”. */
const DANGLING_PUNCTUATION = /[,;:\-–—]+$/u;

/** @param {number} n e.g. “1 guess”, “2,384 guesses” */
export function formatGuessCount(n) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? "guess" : "guesses"}`;
}

/** The random pool as one string, for copy that lists it. */
export function formatSecretEmojiPool() {
  return SECRET_EMOJIS.join("");
}

export function pickSecretEmoji() {
  return SECRET_EMOJIS[Math.floor(Math.random() * SECRET_EMOJIS.length)];
}

/**
 * The title as it should read before the emoji, ending in exactly one
 * sentence-ending mark. Empty when nothing is left to name the set by.
 * @param {string} title
 */
export function exclaimTitle(title) {
  const trimmed = String(title ?? "").trim();
  if (TERMINAL_PUNCTUATION.test(trimmed.replace(TRAILING_CLOSERS, ""))) return trimmed;
  const stripped = trimmed.replace(DANGLING_PUNCTUATION, "").trimEnd();
  return stripped ? `${stripped}!` : "";
}

/**
 * @param {string} title secret set title (may be empty)
 * @param {string} emoji
 */
export function secretFoundLine(title, emoji) {
  const named = exclaimTitle(title);
  return named
    ? `Found the secret set: ${named} ${emoji}`
    : `Found the secret set! ${emoji}`;
}
