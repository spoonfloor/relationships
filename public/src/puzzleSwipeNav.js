/**
 * Play-mode adjacent puzzle navigation via swipe and arrow keys.
 * Callers own load/side effects; this module only reports delta (+1 older, -1 newer).
 */

const AXIS_LOCK_PX = 12;
const COMMIT_PX = 56;
const COMMIT_VELOCITY = 0.45; // px/ms
const HORIZONTAL_RATIO = 1.35;

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isInteractiveTarget(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, textarea, select, option, [role="button"], [role="menuitem"], [contenteditable="true"], .app-bar__menu'
    )
  );
}

/**
 * @param {EventTarget | null} target
 * @returns {boolean}
 */
function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return !target.readOnly && !target.disabled;
  }
  if (target instanceof HTMLSelectElement) return !target.disabled;
  return target.isContentEditable;
}

/**
 * @param {{
 *   root: HTMLElement,
 *   onNavigate: (delta: 1 | -1) => void,
 *   canNavigate?: () => boolean,
 * }} options
 * @returns {() => void}
 */
export function bindPuzzleAdjacentNav({ root, onNavigate, canNavigate = () => true }) {
  /** @type {{
   *   pointerId: number,
   *   startX: number,
   *   startY: number,
   *   startTime: number,
   *   axis: "pending" | "horizontal" | "vertical",
   *   lastX: number,
   *   lastTime: number,
   * } | null} */
  let gesture = null;
  let suppressClick = false;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let suppressClickTimer = null;

  function armClickSuppression() {
    suppressClick = true;
    if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
    // Board rebuild can drop the trailing click; don't leave the flag stuck.
    suppressClickTimer = window.setTimeout(() => {
      suppressClick = false;
      suppressClickTimer = null;
    }, 50);
  }

  function allowed() {
    try {
      return canNavigate();
    } catch {
      return false;
    }
  }

  /**
   * @param {number} dx
   * @param {number} dt
   * @returns {1 | -1 | null}
   */
  function resolveDelta(dx, dt) {
    const distance = Math.abs(dx);
    const velocity = dt > 0 ? distance / dt : 0;
    if (distance < COMMIT_PX && velocity < COMMIT_VELOCITY) return null;
    // Finger left → older (+1); finger right → newer (-1)
    return dx < 0 ? 1 : -1;
  }

  /** @param {PointerEvent} event */
  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!allowed()) return;
    if (isInteractiveTarget(event.target)) return;

    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      axis: "pending",
      lastX: event.clientX,
      lastTime: event.timeStamp,
    };
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;

    if (gesture.axis === "pending") {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      if (Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO) {
        gesture.axis = "horizontal";
        try {
          root.setPointerCapture(event.pointerId);
        } catch {
          /* ignore */
        }
      } else {
        gesture.axis = "vertical";
      }
    }

    if (gesture.axis === "horizontal") {
      event.preventDefault();
    }
  }

  /** @param {PointerEvent} event */
  function endPointer(event) {
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const active = gesture;
    gesture = null;

    if (root.hasPointerCapture?.(event.pointerId)) {
      try {
        root.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }

    if (active.axis !== "horizontal") return;
    if (!allowed()) return;

    const dx = event.clientX - active.startX;
    const dt = Math.max(1, event.timeStamp - active.startTime);
    const delta = resolveDelta(dx, dt);
    if (!delta) return;

    armClickSuppression();
    onNavigate(delta);
  }

  /** @param {MouseEvent} event */
  function onClickCapture(event) {
    if (!suppressClick) return;
    suppressClick = false;
    if (suppressClickTimer != null) {
      window.clearTimeout(suppressClickTimer);
      suppressClickTimer = null;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /** @param {KeyboardEvent} event */
  function onKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget(event.target)) return;
    if (!allowed()) return;

    event.preventDefault();
    // ArrowRight → older (+1); ArrowLeft → newer (-1) — matches swipe-left = next
    onNavigate(event.key === "ArrowRight" ? 1 : -1);
  }

  root.addEventListener("pointerdown", onPointerDown, { passive: true });
  root.addEventListener("pointermove", onPointerMove, { passive: false });
  root.addEventListener("pointerup", endPointer);
  root.addEventListener("pointercancel", endPointer);
  root.addEventListener("click", onClickCapture, true);
  document.addEventListener("keydown", onKeyDown);

  return () => {
    root.removeEventListener("pointerdown", onPointerDown);
    root.removeEventListener("pointermove", onPointerMove);
    root.removeEventListener("pointerup", endPointer);
    root.removeEventListener("pointercancel", endPointer);
    root.removeEventListener("click", onClickCapture, true);
    document.removeEventListener("keydown", onKeyDown);
    if (suppressClickTimer != null) window.clearTimeout(suppressClickTimer);
    gesture = null;
    suppressClick = false;
  };
}
