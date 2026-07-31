import { setDisplayText } from "./display.js";
import { openModal } from "./modal.js";

/**
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.emptyMessage]
 * @param {string} [options.listAriaLabel]
 * @param {{ id: string, title: string }[]} options.puzzles
 * @param {string} [options.currentId]
 * @param {string} [options.emptyDismissLabel]
 * @param {(id: string) => void} options.onSelect
 */
export function openPuzzlePicker({
  title = "Choose puzzle",
  emptyMessage = "No puzzles.",
  listAriaLabel = "Puzzles",
  emptyDismissLabel = "Cancel",
  puzzles,
  currentId = "",
  onSelect,
}) {
  if (puzzles.length === 0) {
    openModal({
      title,
      content: (bodyEl) => {
        const list = document.createElement("div");
        list.className = "modal-list";
        const emptyEl = document.createElement("p");
        emptyEl.className = "puzzle-picker__empty";
        setDisplayText(emptyEl, emptyMessage);
        list.appendChild(emptyEl);
        bodyEl.appendChild(list);
      },
      actions: [{ label: emptyDismissLabel, variant: "secondary" }],
    });
    return;
  }

  let selectedId = currentId;
  /** @type {{ openBtn: HTMLButtonElement | null }} */
  const ui = { openBtn: null };

  function syncOpenButton() {
    if (ui.openBtn) {
      ui.openBtn.disabled = !selectedId;
    }
  }

  const { dialog } = openModal({
    title,
    content: (bodyEl) => {
      const list = document.createElement("div");
      list.className = "modal-list puzzle-picker";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", listAriaLabel);

      /** @type {HTMLButtonElement | null} */
      let selectedBtn = null;

      function setSelected(btn, id) {
        selectedBtn?.classList.remove("is-selected");
        selectedBtn?.setAttribute("aria-selected", "false");
        selectedBtn = btn;
        selectedId = id;
        btn.classList.add("is-selected");
        btn.setAttribute("aria-selected", "true");
        syncOpenButton();
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
          setSelected(btn, puzzle.id);
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
    actions: [
      { label: "Cancel", variant: "secondary" },
      {
        label: "Open",
        variant: "primary",
        onClick: () => {
          if (!selectedId) return;
          onSelect(selectedId);
        },
      },
    ],
  });

  const openBtn = dialog.querySelector(".modal__actions .btn-primary");
  if (openBtn instanceof HTMLButtonElement) {
    ui.openBtn = openBtn;
    syncOpenButton();
  }
}
