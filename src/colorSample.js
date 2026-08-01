import {
  colorsNeedSeparation,
  contrastTextColor,
  cssColorToHex,
  mixHex,
  normalizeHex,
  relativeLuminance,
} from "./color.js";

export const COLOR_SAMPLE_CLASS = "color-sample";
export const COLOR_SAMPLE_SEPARATED_CLASS = "color-sample--separated";

/** @typedef {"modal" | "canvas"} ColorSampleSurface */

/** @type {Record<ColorSampleSurface, string>} */
const SURFACE_TOKENS = {
  modal: "--surface-modal",
  canvas: "--surface-canvas",
};

/**
 * Element that owns the surface token for separation checks.
 * @param {ColorSampleSurface} surface
 * @param {Element | null | undefined} surfaceElement modal panel when surface is "modal"
 */
function surfaceAnchor(surface, surfaceElement) {
  if (surface === "canvas") return document.body;
  if (surfaceElement instanceof Element) return surfaceElement;
  return document.querySelector(".modal__panel") ?? document.body;
}

/**
 * Resolved surface color for separation checks.
 * @param {ColorSampleSurface} [surface]
 * @param {Element | null | undefined} [surfaceElement] modal panel for "modal" surface
 */
export function readSurfaceHex(surface = "modal", surfaceElement) {
  const token = SURFACE_TOKENS[surface] ?? SURFACE_TOKENS.modal;
  const anchor = surfaceAnchor(surface, surfaceElement);
  const styles = getComputedStyle(anchor);
  const fromToken = cssColorToHex(styles.getPropertyValue(token));
  if (fromToken) return fromToken;
  return cssColorToHex(styles.backgroundColor) ?? "#FFFFFF";
}

/**
 * @param {string} hex
 * @param {ColorSampleSurface} [surface]
 * @param {Element | null | undefined} [surfaceElement]
 */
export function sampleNeedsSeparation(hex, surface = "modal", surfaceElement) {
  const normalized = normalizeHex(hex);
  const surfaceHex = readSurfaceHex(surface, surfaceElement);
  return colorsNeedSeparation(normalized, surfaceHex);
}

/** @param {string} sampleHex @param {string} surfaceHex */
export function sampleNeedsSeparationAgainst(sampleHex, surfaceHex) {
  return colorsNeedSeparation(normalizeHex(sampleHex), normalizeHex(surfaceHex));
}

/** Overlay strength when a logo swatch blends into the page surface. */
export const LOGO_SWATCH_OVERLAY_PERCENT = 5;

/**
 * Logo swatch fill: poem bg, with a light overlay when it blends into the page surface.
 * Light surfaces → 5% black; dark surfaces → 5% white (for future dark mode).
 * @param {string} hex
 * @param {{ surface?: ColorSampleSurface, surfaceElement?: Element }} [options]
 */
export function resolveLogoSwatchFill(hex, { surface = "canvas", surfaceElement } = {}) {
  const normalized = normalizeHex(hex);
  if (!sampleNeedsSeparation(normalized, surface, surfaceElement)) {
    return normalized;
  }
  const surfaceHex = readSurfaceHex(surface, surfaceElement);
  const overlay = relativeLuminance(surfaceHex) < 0.5 ? "#FFFFFF" : "#000000";
  return mixHex(normalized, overlay, LOGO_SWATCH_OVERLAY_PERCENT);
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
export function syncColorSampleEdge(
  silhouetteEl,
  sampleHexes,
  { surface = "modal", surfaceElement } = {},
) {
  const needsEdge = sampleHexes.some((hex) =>
    sampleNeedsSeparation(hex, surface, surfaceElement),
  );
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
