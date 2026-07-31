import Hypher from "./vendor/hypher.js";
import english from "./vendor/hyphenation.en-us.js";

const hypher = new Hypher(english);

/** Skip hyphenating short tokens (LACE, ROSE, etc.). */
const MIN_HYPHEN_WORD_LEN = 6;

/** Insert soft hyphens at syllable boundaries for display only. */
export function insertSoftHyphens(text) {
  if (text == null || text === "") return "";
  return hypher.hyphenateText(String(text), MIN_HYPHEN_WORD_LEN);
}
