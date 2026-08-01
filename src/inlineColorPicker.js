import { hexToHsv, hsvToHex, hueToHex, normalizeHex } from "./color.js";

/** @param {number} value @param {number} min @param {number} max */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * VS Code–style inline picker: SV field + vertical hue strip (no alpha, no RGB inputs).
 * @param {HTMLElement} container
 * @param {{ value: string, onChange: (hex: string) => void, ariaLabel?: string }} options
 */
export function mountInlineColorPicker(container, { value, onChange, ariaLabel = "Color picker" }) {
  /** @type {{ h: number, s: number, v: number }} */
  let state = hexToHsv(normalizeHex(value));

  const root = document.createElement("div");
  root.className = "inline-color-picker";

  const sv = document.createElement("div");
  sv.className = "inline-color-picker__sv";
  sv.setAttribute("role", "slider");
  sv.setAttribute("aria-label", `${ariaLabel}: saturation and brightness`);
  sv.setAttribute("aria-valuemin", "0");
  sv.setAttribute("aria-valuemax", "100");
  sv.tabIndex = 0;

  const svBg = document.createElement("div");
  svBg.className = "inline-color-picker__sv-bg";
  svBg.setAttribute("aria-hidden", "true");

  const svCursor = document.createElement("div");
  svCursor.className = "inline-color-picker__sv-cursor";
  svCursor.setAttribute("aria-hidden", "true");

  sv.appendChild(svBg);
  sv.appendChild(svCursor);

  const hue = document.createElement("div");
  hue.className = "inline-color-picker__hue";
  hue.setAttribute("role", "slider");
  hue.setAttribute("aria-label", `${ariaLabel}: hue`);
  hue.setAttribute("aria-valuemin", "0");
  hue.setAttribute("aria-valuemax", "360");
  hue.tabIndex = 0;

  const hueCursor = document.createElement("div");
  hueCursor.className = "inline-color-picker__hue-cursor";
  hueCursor.setAttribute("aria-hidden", "true");

  hue.appendChild(hueCursor);
  root.appendChild(sv);
  root.appendChild(hue);
  container.appendChild(root);

  /** @type {"sv" | "hue" | null} */
  let dragTarget = null;

  function currentHex() {
    return hsvToHex(state.h, state.s, state.v);
  }

  function emitChange() {
    render();
    onChange(currentHex());
  }

  function renderSvBackground() {
    svBg.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueToHex(state.h)})`;
  }

  function render() {
    renderSvBackground();
    svCursor.style.left = `${state.s * 100}%`;
    svCursor.style.top = `${(1 - state.v) * 100}%`;
    hueCursor.style.top = `${(state.h / 360) * 100}%`;
    sv.setAttribute("aria-valuenow", String(Math.round(state.s * 100)));
    sv.setAttribute("aria-valuetext", currentHex());
    hue.setAttribute("aria-valuenow", String(Math.round(state.h)));
    hue.setAttribute("aria-valuetext", `${Math.round(state.h)} degrees`);
  }

  function setHex(hex) {
    const normalized = normalizeHex(hex);
    if (normalized === currentHex()) return;
    state = hexToHsv(normalized);
    render();
  }

  function setAriaLabel(label) {
    sv.setAttribute("aria-label", `${label}: saturation and brightness`);
    hue.setAttribute("aria-label", `${label}: hue`);
  }

  /** @param {PointerEvent} event */
  function svFromPointer(event) {
    const rect = sv.getBoundingClientRect();
    state.s = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    state.v = clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1);
    emitChange();
  }

  /** @param {PointerEvent} event */
  function hueFromPointer(event) {
    const rect = hue.getBoundingClientRect();
    state.h = clamp((event.clientY - rect.top) / rect.height, 0, 1) * 360;
    // Achromatic colors (s=0) ignore hue in HSV; bump saturation so hue picks a color.
    if (state.s === 0 && state.v > 0) state.s = 1;
    emitChange();
  }

  /** @param {PointerEvent} event */
  function onPointerMove(event) {
    if (!dragTarget) return;
    if (dragTarget === "sv") svFromPointer(event);
    else hueFromPointer(event);
  }

  /** @param {PointerEvent} event */
  function onPointerUp(event) {
    if (!dragTarget) return;
    const surface = dragTarget === "sv" ? sv : hue;
    dragTarget = null;
    surface.releasePointerCapture?.(event.pointerId);
  }

  /** @param {"sv" | "hue"} target @param {PointerEvent} event */
  function beginDrag(target, event) {
    dragTarget = target;
    event.preventDefault();
    const surface = target === "sv" ? sv : hue;
    surface.setPointerCapture?.(event.pointerId);
    if (target === "sv") svFromPointer(event);
    else hueFromPointer(event);
  }

  sv.addEventListener("pointerdown", (event) => beginDrag("sv", event));
  hue.addEventListener("pointerdown", (event) => beginDrag("hue", event));
  sv.addEventListener("pointermove", onPointerMove);
  hue.addEventListener("pointermove", onPointerMove);
  sv.addEventListener("pointerup", onPointerUp);
  hue.addEventListener("pointerup", onPointerUp);
  sv.addEventListener("pointercancel", onPointerUp);
  hue.addEventListener("pointercancel", onPointerUp);

  render();

  return {
    setValue: setHex,
    setAriaLabel,
    destroy() {
      root.remove();
    },
  };
}
