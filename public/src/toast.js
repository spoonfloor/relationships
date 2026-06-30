import { setDisplayText } from "./display.js";

const TOAST_DURATION_MS = 2500;

/** @type {(() => void) | null} */
let activeToastDismiss = null;

export function dismissToast() {
  activeToastDismiss?.();
  activeToastDismiss = null;
}

/**
 * @param {string} message
 * @returns {{ dismiss: () => void }}
 */
export function showToast(message) {
  dismissToast();

  const layer = document.createElement("div");
  layer.className = "toast-layer";

  const scrim = document.createElement("button");
  scrim.type = "button";
  scrim.className = "toast-scrim";
  scrim.setAttribute("aria-label", "Dismiss");

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const messageEl = document.createElement("span");
  messageEl.className = "toast__message";
  setDisplayText(messageEl, message);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "toast__close";
  closeBtn.setAttribute("aria-label", "Close");
  setDisplayText(closeBtn, "×");

  toast.appendChild(messageEl);
  toast.appendChild(closeBtn);
  layer.appendChild(scrim);
  layer.appendChild(toast);
  document.body.appendChild(layer);

  let timeoutId = null;

  function dismiss() {
    if (!layer.isConnected) return;
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (activeToastDismiss === dismiss) {
      activeToastDismiss = null;
    }
    layer.remove();
  }

  scrim.addEventListener("click", dismiss);
  closeBtn.addEventListener("click", dismiss);
  timeoutId = setTimeout(dismiss, TOAST_DURATION_MS);

  activeToastDismiss = dismiss;
  return { dismiss };
}
