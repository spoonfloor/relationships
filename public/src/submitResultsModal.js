import { setDisplayText } from "./display.js";
import { openModal } from "./modal.js";

/**
 * @param {object} options
 * @param {{ setIndex: 0 | 1 | 2 | 3, feedback: string }[]} options.rows
 * @param {() => void} [options.onClose]
 * @returns {{ close: () => void }}
 */
export function openSubmitResultsModal({ rows, onClose }) {
  return openModal({
    title: "Results",
    dialogClass: "submit-results-modal",
    panelClass: "submit-results-modal__panel",
    content: (bodyEl) => {
      const listEl = document.createElement("div");
      listEl.className = "submit-results";
      listEl.setAttribute("role", "list");

      for (const { setIndex, feedback } of rows) {
        const rowEl = document.createElement("div");
        rowEl.className = "submit-results__row";
        rowEl.setAttribute("role", "listitem");

        const setEl = document.createElement("div");
        setEl.className = "submit-results__set";

        const swatchEl = document.createElement("span");
        swatchEl.className = `submit-results__swatch submit-results__swatch--${setIndex + 1}`;
        swatchEl.setAttribute("aria-hidden", "true");

        const labelEl = document.createElement("span");
        labelEl.className = "submit-results__label";
        setDisplayText(labelEl, `Set ${setIndex + 1}`);

        setEl.appendChild(swatchEl);
        setEl.appendChild(labelEl);

        const feedbackEl = document.createElement("span");
        feedbackEl.className = "submit-results__feedback";
        setDisplayText(feedbackEl, feedback);

        rowEl.appendChild(setEl);
        rowEl.appendChild(feedbackEl);
        listEl.appendChild(rowEl);
      }

      bodyEl.appendChild(listEl);
    },
    actions: [{ label: "Continue", variant: "primary" }],
    onClose,
    assemblePanel: ({ panel, titleEl, bodyEl, actionsEl, close }) => {
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "sheet__close submit-results-modal__close";
      closeBtn.setAttribute("aria-label", "Close");

      const closeIcon = document.createElement("span");
      closeIcon.className = "material-icons";
      closeIcon.setAttribute("aria-hidden", "true");
      closeIcon.textContent = "close";
      closeBtn.appendChild(closeIcon);
      closeBtn.addEventListener("click", close);

      const headerEl = document.createElement("div");
      headerEl.className = "submit-results-modal__header";
      titleEl.classList.add("submit-results-modal__title");
      headerEl.appendChild(titleEl);

      actionsEl.classList.add("submit-results-modal__actions");

      panel.appendChild(closeBtn);
      panel.appendChild(headerEl);
      panel.appendChild(bodyEl);
      panel.appendChild(actionsEl);
    },
  });
}
