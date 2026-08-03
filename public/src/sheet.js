import { setDisplayText } from "./display.js";
import { activateOverlay, deactivateOverlay } from "./overlay.js";

const SHEET_OPEN_MS = 300;
const SHEET_CLOSE_MS = 200;

/**
 * @param {object} options
 * @param {string} options.title
 * @param {string | Node | ((bodyEl: HTMLElement) => void)} [options.content]
 * @param {() => void} [options.onClose]
 * @param {string} [options.className]
 * @returns {{ close: () => void, dialog: HTMLDialogElement }}
 */
export function openSheet({ title, content, onClose, className = "" }) {
  const previousFocus = document.activeElement;

  const dialog = document.createElement("dialog");
  dialog.className = "sheet";
  dialog.classList.add(...className.split(/\s+/).filter(Boolean));
  dialog.tabIndex = -1;
  dialog.setAttribute("autofocus", "");

  const panel = document.createElement("div");
  panel.className = "sheet__panel";

  const headerEl = document.createElement("div");
  headerEl.className = "sheet__header";

  const titleEl = document.createElement("h2");
  titleEl.className = "sheet__title";
  const titleId = `sheet-title-${Date.now()}`;
  titleEl.id = titleId;
  setDisplayText(titleEl, title);
  dialog.setAttribute("aria-labelledby", titleId);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.tabIndex = -1;
  closeBtn.className = "sheet__close";
  closeBtn.setAttribute("aria-label", "Close");

  const closeIcon = document.createElement("span");
  closeIcon.className = "material-icons";
  closeIcon.setAttribute("aria-hidden", "true");
  closeIcon.textContent = "close";
  closeBtn.appendChild(closeIcon);

  headerEl.appendChild(titleEl);
  headerEl.appendChild(closeBtn);

  const bodyEl = document.createElement("div");
  bodyEl.className = "sheet__body";

  if (typeof content === "function") {
    content(bodyEl);
  } else if (content instanceof Node) {
    bodyEl.appendChild(content);
  } else if (content != null) {
    const paragraph = document.createElement("p");
    setDisplayText(paragraph, String(content));
    bodyEl.appendChild(paragraph);
  }

  panel.appendChild(headerEl);
  panel.appendChild(bodyEl);
  dialog.appendChild(panel);
  document.body.appendChild(dialog);

  let closing = false;
  let closeTimer = 0;
  let openFocusTimer = 0;
  let openFrameOne = 0;
  let openFrameTwo = 0;

  function cancelOpen() {
    window.cancelAnimationFrame(openFrameOne);
    window.cancelAnimationFrame(openFrameTwo);
    window.clearTimeout(openFocusTimer);
  }

  function finishClose() {
    if (!dialog.open) return;
    cancelOpen();
    window.clearTimeout(closeTimer);
    dialog.close();
  }

  function beginClose({ immediate = false } = {}) {
    if (!dialog.open) return;
    if (immediate) {
      finishClose();
      return;
    }
    if (closing) return;

    closing = true;
    cancelOpen();
    if (!dialog.classList.replace("sheet--open", "sheet--closing")) {
      dialog.classList.add("sheet--closing");
    }

    const onEnd = (event) => {
      if (event.target !== panel || event.propertyName !== "transform") return;
      panel.removeEventListener("transitionend", onEnd);
      finishClose();
    };

    panel.addEventListener("transitionend", onEnd);
    closeTimer = window.setTimeout(() => {
      if (dialog.open) finishClose();
    }, SHEET_CLOSE_MS + 50);
  }

  closeBtn.addEventListener("click", () => beginClose());

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      beginClose();
    }
  });

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    beginClose();
  });

  dialog.addEventListener("close", () => {
    deactivateOverlay(beginClose);
    cancelOpen();
    window.clearTimeout(closeTimer);
    dialog.remove();
    onClose?.();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus({ preventScroll: true });
    }
  });

  function focusCloseButton() {
    if (!dialog.open || closing) return;
    // Do not steal focus if the user interacted with sheet content while the
    // opening transition was still running.
    if (document.activeElement !== dialog) return;
    closeBtn.tabIndex = 0;
    closeBtn.focus({ preventScroll: true });
  }

  function onOpenEnd(event) {
    if (event.target !== panel || event.propertyName !== "transform") return;
    panel.removeEventListener("transitionend", onOpenEnd);
    window.clearTimeout(openFocusTimer);
    focusCloseButton();
  }

  panel.addEventListener("transitionend", onOpenEnd);
  activateOverlay(beginClose);
  dialog.showModal();
  dialog.focus({ preventScroll: true });
  dialog.scrollTop = 0;

  openFrameOne = requestAnimationFrame(() => {
    openFrameTwo = requestAnimationFrame(() => {
      if (dialog.open && !closing) {
        dialog.classList.add("sheet--open");
        openFocusTimer = window.setTimeout(
          focusCloseButton,
          SHEET_OPEN_MS + 50
        );
      }
    });
  });

  return { close: () => beginClose(), dialog };
}
