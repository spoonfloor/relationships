import { setDisplayText } from "./display.js";
import { openModal } from "./modal.js";

/**
 * @typedef {{ id: string, title: string }} PuzzleOption
 * @typedef {{ heading?: string, puzzles: PuzzleOption[] }} PuzzlePickerSection
 */

/**
 * @param {object} options
 * @param {string} [options.title]
 * @param {string} [options.emptyMessage]
 * @param {string} [options.listAriaLabel]
 * @param {PuzzleOption[]} [options.puzzles]
 * @param {PuzzlePickerSection[]} [options.sections]
 * @param {string} [options.currentId]
 * @param {string[]} [options.currentIds]
 * @param {boolean} [options.multiple]
 * @param {string} [options.emptyDismissLabel]
 * @param {string} [options.primaryLabel]
 * @param {(selection: string | string[]) => void} options.onSelect
 * @param {() => void} [options.onDismiss]
 */
export function openPuzzlePicker({
  title = "Choose puzzle",
  emptyMessage = "No puzzles.",
  listAriaLabel = "Puzzles",
  emptyDismissLabel = "Cancel",
  puzzles,
  sections,
  currentId = "",
  currentIds,
  multiple = false,
  primaryLabel = "Open",
  onSelect,
  onDismiss,
}) {
  const resolvedSections = sections ?? (puzzles ? [{ puzzles }] : []);
  const allPuzzles = resolvedSections.flatMap((section) => section.puzzles);

  if (allPuzzles.length === 0) {
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
      actions: [{ label: emptyDismissLabel, variant: "secondary", onClick: onDismiss }],
      onClose: onDismiss,
    });
    return;
  }

  const initialIds =
    multiple && currentIds?.length
      ? currentIds.filter((id) => allPuzzles.some((puzzle) => puzzle.id === id))
      : multiple && currentId && allPuzzles.some((puzzle) => puzzle.id === currentId)
        ? [currentId]
        : [];

  let selectedId = !multiple && allPuzzles.some((puzzle) => puzzle.id === currentId) ? currentId : "";
  /** @type {Set<string>} */
  let selectedIds = new Set(initialIds);
  let anchorId = initialIds[0] ?? "";

  /** @type {{ primaryBtn: HTMLButtonElement | null }} */
  const ui = { primaryBtn: null };

  function hasSelection() {
    return multiple ? selectedIds.size > 0 : Boolean(selectedId);
  }

  function syncPrimaryButton() {
    if (ui.primaryBtn) {
      ui.primaryBtn.disabled = !hasSelection();
    }
  }

  const { dialog } = openModal({
    title,
    content: (bodyEl) => {
      const list = document.createElement("div");
      list.className = "modal-list puzzle-picker";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", listAriaLabel);
      if (multiple) {
        list.setAttribute("aria-multiselectable", "true");
      }

      /** @type {string[]} */
      const orderedIds = [];
      /** @type {Map<string, HTMLButtonElement>} */
      const buttonsById = new Map();

      /** @type {HTMLButtonElement | null} */
      let selectedBtn = null;

      function syncSelectionUi() {
        if (multiple) {
          for (const [id, btn] of buttonsById) {
            const isSelected = selectedIds.has(id);
            btn.classList.toggle("is-selected", isSelected);
            btn.setAttribute("aria-selected", isSelected ? "true" : "false");
          }
        }
        syncPrimaryButton();
      }

      function setSelected(btn, id) {
        selectedBtn?.classList.remove("is-selected");
        selectedBtn?.setAttribute("aria-selected", "false");
        selectedBtn = btn;
        selectedId = id;
        btn.classList.add("is-selected");
        btn.setAttribute("aria-selected", "true");
        syncPrimaryButton();
      }

      /**
       * @param {MouseEvent} event
       * @param {string} id
       * @param {HTMLButtonElement} btn
       */
      function handleItemClick(event, id, btn) {
        if (!multiple) {
          setSelected(btn, id);
          return;
        }

        const rangeAnchor =
          anchorId ||
          orderedIds.find((entryId) => selectedIds.has(entryId)) ||
          id;

        if (event.shiftKey) {
          const start = orderedIds.indexOf(rangeAnchor);
          const end = orderedIds.indexOf(id);
          if (start !== -1 && end !== -1) {
            if (!(event.metaKey || event.ctrlKey)) {
              selectedIds.clear();
            }
            const [lo, hi] = start < end ? [start, end] : [end, start];
            for (let i = lo; i <= hi; i++) {
              selectedIds.add(orderedIds[i]);
            }
          } else {
            selectedIds.clear();
            selectedIds.add(id);
          }
        } else if (event.metaKey || event.ctrlKey) {
          if (selectedIds.has(id)) {
            selectedIds.delete(id);
          } else {
            selectedIds.add(id);
          }
          anchorId = id;
        } else {
          selectedIds.clear();
          selectedIds.add(id);
          anchorId = id;
        }

        syncSelectionUi();
      }

      let hasRenderedItems = false;

      for (const section of resolvedSections) {
        if (section.puzzles.length === 0) continue;

        if (section.heading) {
          if (hasRenderedItems) {
            const divider = document.createElement("hr");
            divider.className = "puzzle-picker__section-divider";
            list.appendChild(divider);
          }

          const heading = document.createElement("div");
          heading.className = "puzzle-picker__section-heading";
          heading.setAttribute("role", "presentation");
          setDisplayText(heading, section.heading);
          list.appendChild(heading);
        }

        for (const puzzle of section.puzzles) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "puzzle-picker__item";
          btn.setAttribute("role", "option");
          orderedIds.push(puzzle.id);
          buttonsById.set(puzzle.id, btn);

          const isSelected = multiple ? selectedIds.has(puzzle.id) : puzzle.id === currentId;
          btn.setAttribute("aria-selected", isSelected ? "true" : "false");
          if (isSelected) {
            btn.classList.add("is-selected");
            if (!multiple) {
              selectedBtn = btn;
            }
          }

          setDisplayText(btn, puzzle.title);
          btn.addEventListener("click", (event) => {
            handleItemClick(event, puzzle.id, btn);
          });
          list.appendChild(btn);
          hasRenderedItems = true;
        }
      }

      bodyEl.appendChild(list);
      syncPrimaryButton();
    },
    actions: [
      { label: "Cancel", variant: "secondary", onClick: onDismiss },
      {
        label: primaryLabel,
        variant: "primary",
        onClick: () => {
          if (!hasSelection()) return;
          if (multiple) {
            onSelect([...selectedIds]);
          } else {
            onSelect(selectedId);
          }
        },
      },
    ],
    onClose: onDismiss,
  });

  const primaryBtn = dialog.querySelector(".modal__actions .btn-primary");
  if (primaryBtn instanceof HTMLButtonElement) {
    ui.primaryBtn = primaryBtn;
    syncPrimaryButton();
  }
}
