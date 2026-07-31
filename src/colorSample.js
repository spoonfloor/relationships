import { colorsNeedSeparation, contrastTextColor, normalizeHex, rgbToHex } from "./color.js";

export const COLOR_SAMPLE_CLASS = "color-sample";
export const COLOR_SAMPLE_SEPARATED_CLASS = "color-sample--separated";

/** @typedef {"modal" | "canvas"} ColorSampleSurface */

/** @type {Record<ColorSampleSurface, string>} */
const SURFACE_TOKENS = {
  modal: "--surface-modal",
  canvas: "--surface-canvas",
};

/** @param {string} value */
function cssColorToHex(value) {
  const trimmed = value.trim();
  if (!trimmed) return "#FFFFFF";
  if (trimmed.startsWith("#")) return normalizeHex(trimmed);

  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return normalizeHex(
      rgbToHex(Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])),
    );
  }

  return "#FFFFFF";
}

/**
 * Resolved surface color for separation checks.
 * @param {ColorSampleSurface} [surface]
 * @param {Element} [element]
 */
export function readSurfaceHex(surface = "modal", element = document.documentElement) {
  const token = SURFACE_TOKENS[surface] ?? SURFACE_TOKENS.modal;
  return cssColorToHex(getComputedStyle(element).getPropertyValue(token));
}

/**
 * @param {string} hex
 * @param {ColorSampleSurface} [surface]
 * @param {Element} [surfaceElement]
 */
export function sampleNeedsSeparation(hex, surface = "modal", surfaceElement) {
  const normalized = normalizeHex(hex);
  const surfaceHex = readSurfaceHex(surface, surfaceElement ?? document.documentElement);
  return colorsNeedSeparation(normalized, surfaceHex);
}

/** @param {string} sampleHex @param {string} surfaceHex */
export function sampleNeedsSeparationAgainst(sampleHex, surfaceHex) {
  return colorsNeedSeparation(normalizeHex(sampleHex), normalizeHex(surfaceHex));
}

/** @param {HTMLElement} el @param {string} hex */
export function paintColorFill(el, hex) {
  el.style.background = normalizeHex(hex);
  el.classList.remove(COLOR_SAMPLE_SEPARATED_CLASS);
}

/**
 * Toggle separation edge on the silhouette owner when any sample blends into the surface.
 * @param {HTMLElement} silhouetteEl
 * @param {string[]} sampleHexes
 * @param {{ surface?: ColorSampleSurface, surfaceElement?: Element }} [options]
 */
export function syncColorSampleEdge(silhouetteEl, sampleHexes, { surface = "modal", surfaceElement } = {}) {
  const context = surfaceElement ?? silhouetteEl;
  const needsEdge = sampleHexes.some((hex) => sampleNeedsSeparation(hex, surface, context));
  silhouetteEl.classList.toggle(COLOR_SAMPLE_SEPARATED_CLASS, needsEdge);
}

/**
 * Atomic color sample: fill and edge on the same silhouette element.
 * @param {HTMLElement} el
 * @param {string} hex
 * @param {{ surface?: ColorSampleSurface, surfaceElement?: Element }} [options]
 */
export function applyColorSample(el, hex, { surface = "modal", surfaceElement } = {}) {
  paintColorFill(el, hex);
  syncColorSampleEdge(el, [hex], { surface, surfaceElement });
}

/**
 * @param {HTMLElement} el
 * @param {string} hex
 * @param {{ surface?: ColorSampleSurface, surfaceElement?: Element }} [options]
 */
export function applyColorSampleWithText(el, hex, options = {}) {
  const normalized = normalizeHex(hex);
  applyColorSample(el, normalized, options);
  el.style.color = contrastTextColor(normalized);
}

/**
 * Composite preview: fills on children, one edge on the wrapper when any fill needs it.
 * @param {HTMLElement} silhouetteEl
 * @param {{ left: string, right: string }} fills
 * @param {{ leftEl: HTMLElement, rightEl: HTMLElement, surface?: ColorSampleSurface, surfaceElement?: Element }} options
 */
export function applyCompositeColorPreview(
  silhouetteEl,
  fills,
  { leftEl, rightEl, surface = "modal", surfaceElement },
) {
  paintColorFill(leftEl, fills.left);
  paintColorFill(rightEl, fills.right);
  syncColorSampleEdge(silhouetteEl, [fills.left, fills.right], { surface, surfaceElement });
}
