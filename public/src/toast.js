import { setDisplayText } from "./display.js";

const TOAST_DURATION_MS = 2000;

/** @type {(() => void) | null} */
let activeToastDismiss = null;

export function dismissToast() {
  activeToastDismiss?.();
  activeToastDismiss = null;
}

function readSafeAreaTop() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none;";
  document.body.appendChild(probe);
  const top = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  return top;
}

function readToastMinTop() {
  const rootStyle = getComputedStyle(document.documentElement);
  const topGap = parseFloat(rootStyle.getPropertyValue("--toast-top-gap")) || 32;
  return topGap + readSafeAreaTop();
}

/** @param {HTMLElement} toast */
function syncToastPosition(toast, minTop) {
  const rootStyle = getComputedStyle(document.documentElement);
  const boardGap = parseFloat(rootStyle.getPropertyValue("--toast-board-gap")) || 24;

  const board = document.getElementById("board");
  let top = minTop;
  if (board) {
    const boardTop = board.getBoundingClientRect().top;
    const toastHeight = toast.offsetHeight;
    top = Math.max(minTop, boardTop - boardGap - toastHeight);
  }

  toast.style.top = `${Math.round(top)}px`;
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
  let minTop = readToastMinTop();

  const updatePosition = () => syncToastPosition(toast, minTop);
  const refreshMinTop = () => {
    minTop = readToastMinTop();
    updatePosition();
  };

  updatePosition();
  requestAnimationFrame(updatePosition);

  window.addEventListener("scroll", updatePosition, { passive: true });
  window.addEventListener("resize", refreshMinTop);

  const viewport = window.visualViewport;
  viewport?.addEventListener("scroll", updatePosition);
  viewport?.addEventListener("resize", refreshMinTop);

  function dismiss() {
    if (!layer.isConnected) return;
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    window.removeEventListener("scroll", updatePosition);
    window.removeEventListener("resize", refreshMinTop);
    viewport?.removeEventListener("scroll", updatePosition);
    viewport?.removeEventListener("resize", refreshMinTop);
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
