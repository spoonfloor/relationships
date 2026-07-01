import { setDisplayText } from "./display.js";
import { closeActiveModal, openModal } from "./modal.js";

/**
 * @param {object} options
 * @param {{ id: string, title: string }[]} options.puzzles
 * @param {string} options.currentId
 * @param {(id: string) => void} options.onSelect
 */
export function openPuzzlePicker({ puzzles, currentId, onSelect }) {
  openModal({
    title: "Choose puzzle",
    content: (bodyEl) => {
      const list = document.createElement("div");
      list.className = "puzzle-picker";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Puzzles");

      for (const puzzle of puzzles) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "puzzle-picker__item";
        btn.setAttribute("role", "option");
        const isSelected = puzzle.id === currentId;
        btn.setAttribute("aria-selected", isSelected ? "true" : "false");
        if (isSelected) btn.classList.add("is-selected");
        setDisplayText(btn, puzzle.title);
        btn.addEventListener("click", () => {
          onSelect(puzzle.id);
          closeActiveModal();
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
  });
}
