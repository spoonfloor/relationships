/** @type {((options?: { immediate?: boolean }) => void) | null} */
let activeOverlayClose = null;
let savedBodyOverflow = null;

function lockScroll() {
  if (savedBodyOverflow != null) return;
  savedBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
}

function unlockScroll() {
  if (savedBodyOverflow == null) return;
  document.body.style.overflow = savedBodyOverflow;
  savedBodyOverflow = null;
}

/**
 * Register the one active overlay and close any predecessor immediately.
 * @param {(options?: { immediate?: boolean }) => void} close
 */
export function activateOverlay(close) {
  if (activeOverlayClose && activeOverlayClose !== close) {
    activeOverlayClose({ immediate: true });
  }
  activeOverlayClose = close;
  lockScroll();
}

/**
 * Release ownership only when the closing overlay is still active.
 * @param {(options?: { immediate?: boolean }) => void} close
 */
export function deactivateOverlay(close) {
  if (activeOverlayClose !== close) return;
  activeOverlayClose = null;
  unlockScroll();
}

export function closeActiveOverlay({ immediate = true } = {}) {
  activeOverlayClose?.({ immediate });
}
