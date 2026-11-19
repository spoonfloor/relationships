import { formatDisplayText, setDisplayText } from "./display.js";
import { insertSoftHyphens } from "./tileHyphenation.js";
import { openModal } from "./modal.js";
import {
  SECRET_SET_SIZE,
  compareSecretRefs,
  isWholeSet,
  secretRefLabel,
} from "./puzzleSchema.js";

const WHOLE_SET_ERROR =
  "That’s already a set. Pick at least 1 word from another set.";

/** @param {number} count */
function doneLabel(count) {
  return `Done (${count} of ${SECRET_SET_SIZE})`;
}

/**
 * Pick the secret set's words from the 4×4 board. Edits a working copy;
 * Done commits it, dismissing discards it.
 * @param {object} options
 * @param {object} options.puzzle
 * @param {(refs: import("./puzzleSchema.js").SecretRef[]) => void} options.onDone
 */
export function openSecretSetPicker({ puzzle, onDone }) {
  /** @type {import("./puzzleSchema.js").SecretRef[]} */
  let picks = (puzzle.secret?.words ?? []).map((ref) => ({ ...ref }));
  /** @type {HTMLButtonElement[][]} */
  const cells = [];
  /** @type {HTMLParagraphElement[]} */
  const errors = [];
  /** @type {HTMLButtonElement | null} */
  let doneBtn = null;

  const isPicked = (group, word) =>
    picks.some((ref) => ref.group === group && ref.word === word);

  function sync(errorGroup = -1) {
    cells.forEach((row, gi) =>
      row.forEach((cell, wi) => {
        const picked = isPicked(gi, wi);
        cell.classList.toggle("secret-picker__cell--picked", picked);
        cell.classList.toggle("secret-picker__cell--error", false);
        cell.setAttribute("aria-pressed", String(picked));
      })
    );
    errors.forEach((el, gi) => {
      el.hidden = gi !== errorGroup;
    });
    if (doneBtn) setDisplayText(doneBtn, doneLabel(picks.length));
  }

  function toggle(group, word) {
    if (isPicked(group, word)) {
      picks = picks.filter((ref) => ref.group !== group || ref.word !== word);
      sync();
      return;
    }
    if (picks.length >= SECRET_SET_SIZE) return;

    const next = [...picks, { group, word }].sort(compareSecretRefs);
    if (isWholeSet(next)) {
      sync(group);
      cells[group][word].classList.add("secret-picker__cell--error");
      return;
    }
    picks = next;
    sync();
  }

  const { dialog } = openModal({
    title: "Secret set",
    dialogClass: "secret-picker-modal",
    content: (bodyEl) => {
      const listEl = document.createElement("div");
      listEl.className = "secret-picker";

      puzzle.groups.forEach((group, gi) => {
        const labelEl = document.createElement("p");
        labelEl.className = "secret-picker__set";
        setDisplayText(labelEl, group.title?.trim() || `Set ${gi + 1}`);

        const rowEl = document.createElement("div");
        rowEl.className = "secret-picker__row";
        const rowCells = group.words.map((entry, wi) => {
          const ref = { group: gi, word: wi };
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "secret-picker__cell";
          const text = entry.text?.trim();
          cell.classList.toggle("secret-picker__cell--empty", !text);
          if (text) {
            // Narrow cells: break long words at syllables, never mid-letter.
            cell.textContent = insertSoftHyphens(formatDisplayText(text));
          } else {
            setDisplayText(cell, secretRefLabel(ref));
          }
          cell.setAttribute("aria-label", `${text || "Empty"}, ${secretRefLabel(ref)}`);
          cell.addEventListener("click", () => toggle(gi, wi));
          rowEl.appendChild(cell);
          return cell;
        });
        cells.push(rowCells);

        const errorEl = document.createElement("p");
        errorEl.className = "modal__error secret-picker__error";
        errorEl.setAttribute("role", "alert");
        setDisplayText(errorEl, WHOLE_SET_ERROR);
        errorEl.hidden = true;
        errors.push(errorEl);

        listEl.append(labelEl, rowEl, errorEl);
      });

      bodyEl.appendChild(listEl);
    },
    actions: [
      {
        label: doneLabel(picks.length),
        variant: "primary",
        onClick: () => onDone(picks),
      },
    ],
  });

  doneBtn = dialog.querySelector(".modal__actions button");
  sync();
}
