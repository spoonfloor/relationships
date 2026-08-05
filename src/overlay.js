/** @type {((options?: { immediate?: boolean }) => void) | null} */
let activeOverlayClose = null;

/** @type {{
 *   htmlOverflow: string;
 *   bodyOverflow: string;
 *   bodyPosition: string;
 *   bodyTop: string;
 *   bodyLeft: string;
 *   bodyRight: string;
 *   bodyWidth: string;
 *   scrollY: number;
 * } | null} */
let savedScrollLock = null;

function lockScroll() {
  if (savedScrollLock != null) return;

  savedScrollLock = {
    htmlOverflow: document.documentElement.style.overflow,
    bodyOverflow: document.body.style.overflow,
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    bodyLeft: document.body.style.left,
    bodyRight: document.body.style.right,
    bodyWidth: document.body.style.width,
    scrollY: window.scrollY,
  };

  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollLock.scrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockScroll() {
  if (savedScrollLock == null) return;

  const { scrollY, ...styles } = savedScrollLock;
  document.documentElement.style.overflow = styles.htmlOverflow;
  document.body.style.overflow = styles.bodyOverflow;
  document.body.style.position = styles.bodyPosition;
  document.body.style.top = styles.bodyTop;
  document.body.style.left = styles.bodyLeft;
  document.body.style.right = styles.bodyRight;
  document.body.style.width = styles.bodyWidth;
  savedScrollLock = null;

  window.scrollTo(0, scrollY);
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
