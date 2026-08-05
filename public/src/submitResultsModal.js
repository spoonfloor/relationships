import { syncCtaRow, watchCtaRow } from "./ctaLayout.js";
import { setDisplayText } from "./display.js";
import { activateOverlay, deactivateOverlay } from "./overlay.js";

/**
 * @param {object} options
 * @param {{ setIndex: 0 | 1 | 2 | 3, feedback: string }[]} options.rows
 * @param {() => void} [options.onClose]
 * @returns {{ close: () => void }}
 */
export function openSubmitResultsModal({ rows, onClose }) {
  const previousFocus = document.activeElement;

  const dialog = document.createElement("dialog");
  dialog.className = "modal submit-results-modal";

  const panel = document.createElement("div");
  panel.className = "modal__panel submit-results-modal__panel";

  const headerEl = document.createElement("div");
  headerEl.className = "submit-results-modal__header";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "sheet__close";
  closeBtn.setAttribute("aria-label", "Close");

  const closeIcon = document.createElement("span");
  closeIcon.className = "material-icons";
  closeIcon.setAttribute("aria-hidden", "true");
  closeIcon.textContent = "close";
  closeBtn.appendChild(closeIcon);

  const titleEl = document.createElement("h2");
  titleEl.className = "modal__title submit-results-modal__title";
  const titleId = `submit-results-title-${Date.now()}`;
  titleEl.id = titleId;
  setDisplayText(titleEl, "Results");
  dialog.setAttribute("aria-labelledby", titleId);

  headerEl.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "modal__body";

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

  const actionsEl = document.createElement("div");
  actionsEl.className = "modal__actions cta-row cta-row--comfort submit-results-modal__actions";

  function closeModal() {
    if (!dialog.open) return;
    dialog.close();
  }

  const continueBtn = document.createElement("button");
  continueBtn.type = "button";
  continueBtn.className = "btn btn-primary";
  setDisplayText(continueBtn, "Continue");
  continueBtn.addEventListener("click", closeModal);
  actionsEl.appendChild(continueBtn);

  closeBtn.addEventListener("click", closeModal);
  closeBtn.classList.add("submit-results-modal__close");

  panel.appendChild(closeBtn);
  panel.appendChild(headerEl);
  panel.appendChild(bodyEl);
  panel.appendChild(actionsEl);
  dialog.appendChild(panel);
  document.body.appendChild(dialog);

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeModal();
    }
  });

  dialog.addEventListener("close", () => {
    deactivateOverlay(closeModal);
    dialog.remove();
    onClose?.();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus({ preventScroll: true });
    }
  });

  activateOverlay(closeModal);
  dialog.showModal();

  watchCtaRow(actionsEl);
  requestAnimationFrame(() => syncCtaRow(actionsEl));
  continueBtn.focus({ preventScroll: true });

  return { close: closeModal };
}
