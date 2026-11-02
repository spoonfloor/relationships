import { setDisplayText } from "./display.js";
import { openSheet } from "./sheet.js";

const compareWords = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });

/**
 * Running list of past guesses, newest first. Words only — no group colors,
 * so the sheet never reveals more than each guess's feedback already did.
 * @param {{ canonicalWords: string[], feedback: string }[]} guesses
 */
export function openHistorySheet(guesses) {
  return openSheet({
    title: "Your guesses",
    className: "sheet--list sheet--history",
    content(body) {
      const list = document.createElement("ol");
      list.className = "history-list";

      for (let i = guesses.length - 1; i >= 0; i--) {
        const { canonicalWords, feedback } = guesses[i];

        const entry = document.createElement("li");
        entry.className = "history-entry";

        const meta = document.createElement("p");
        meta.className = "history-entry__meta";
        const numberEl = document.createElement("span");
        numberEl.textContent = String(i + 1);
        const dashEl = document.createElement("span");
        dashEl.setAttribute("aria-hidden", "true");
        dashEl.textContent = "–";
        const feedbackEl = document.createElement("span");
        setDisplayText(feedbackEl, feedback);
        meta.append(numberEl, dashEl, feedbackEl);

        const words = document.createElement("div");
        words.className = "history-entry__words";
        for (const word of [...canonicalWords].sort(compareWords)) {
          const wordEl = document.createElement("span");
          wordEl.className = "history-entry__word";
          setDisplayText(wordEl, word);
          words.appendChild(wordEl);
        }

        entry.appendChild(meta);
        entry.appendChild(words);
        list.appendChild(entry);
      }

      body.appendChild(list);
    },
  });
}
