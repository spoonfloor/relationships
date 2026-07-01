import { setDisplayText } from "./display.js";
import { closeActiveModal, openModal } from "./modal.js";

/**
 * @param {object} options
 * @param {{ id: string, title: string }[]} options.puzzles
 * @param {string} options.currentId
 * @param {(id: string) => void} options.onSelect
 */
const SELECTION_ACK_MS = 150;

export function openPuzzlePicker({ puzzles, currentId, onSelect }) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let closeTimer = null;

  function clearCloseTimer() {
    if (closeTimer == null) return;
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  function scheduleClose() {
    clearCloseTimer();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      closeActiveModal();
    }, SELECTION_ACK_MS);
  }

  openModal({
    title: "Choose puzzle",
    content: (bodyEl) => {
      const list = document.createElement("div");
      list.className = "modal-list puzzle-picker";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Puzzles");

      let selectedId = currentId;
      /** @type {HTMLButtonElement | null} */
      let selectedBtn = null;

      function setSelected(btn, id) {
        selectedBtn?.classList.remove("is-selected");
        selectedBtn?.setAttribute("aria-selected", "false");
        selectedBtn = btn;
        selectedId = id;
        btn.classList.add("is-selected");
        btn.setAttribute("aria-selected", "true");
      }

      for (const puzzle of puzzles) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "puzzle-picker__item";
        btn.setAttribute("role", "option");
        const isSelected = puzzle.id === currentId;
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
        if (isSelected) {
          btn.classList.add("is-selected");
          selectedBtn = btn;
        }
        setDisplayText(btn, puzzle.title);
        btn.addEventListener("click", () => {
          if (puzzle.id === selectedId) {
            clearCloseTimer();
            closeActiveModal();
            return;
          }
          setSelected(btn, puzzle.id);
          onSelect(puzzle.id);
          scheduleClose();
        });
        list.appendChild(btn);
      }

      bodyEl.appendChild(list);

      list.addEventListener(
        "scroll",
        () => {
          list.classList.add("has-scrolled");
        },
        { once: true }
      );
    },
    actions: [{ label: "Cancel", variant: "secondary" }],
    onClose: clearCloseTimer,
  });
}
