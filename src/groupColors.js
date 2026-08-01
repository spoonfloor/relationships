import { COLOR_SAMPLE_SEPARATED_CLASS, sampleNeedsSeparation } from "./colorSample.js";

/** @typedef {import("./colorSample.js").ColorSampleSurface} ColorSampleSurface */

/** Default unsolved tile colors — mirrors --text-color and --word-tile-bg. */
export const POEM_DEFAULT_COLORS = {
  text: "#1A1A1A",
  bg: "#E0E0E0",
};

/**
 * @param {{ colors?: { text?: string, bg?: string, border?: string } } | null | undefined} group
 */
export function isGroupColorsAssigned(group) {
  const colors = group?.colors;
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    return false;
  }
  const text = colors.text;
  const bg = colors.bg;
  return (
    typeof text === "string" &&
    text.trim() !== "" &&
    typeof bg === "string" &&
    bg.trim() !== ""
  );
}

/**
 * Saved group colors when assigned; poem default (black on gray) otherwise.
 * @param {{ colors?: { text?: string, bg?: string, border?: string } } | null | undefined} group
 * @returns {{ text: string, bg: string }}
 */
export function resolveGroupColors(group) {
  if (isGroupColorsAssigned(group)) {
    const { text, bg } = group.colors;
    return { text, bg };
  }
  return { ...POEM_DEFAULT_COLORS };
}

/**
 * Apply resolved group colors and conditional separation edge on a silhouette element.
 * Pass `null` to clear inline overrides and fall back to CSS defaults.
 * @param {HTMLElement} el
 * @param {{ text?: string, bg?: string } | null | undefined} colors
 * @param {{ surface?: ColorSampleSurface, surfaceElement?: Element, applyText?: boolean, paintFill?: boolean }} [options]
 */
export function applyGroupColorsToElement(
  el,
  colors,
  { surface = "canvas", surfaceElement, applyText = true, paintFill = true } = {},
) {
  if (!colors) {
    el.style.background = "";
    if (applyText) el.style.color = "";
    el.classList.remove(COLOR_SAMPLE_SEPARATED_CLASS);
    return;
  }

  const needsEdge =
    typeof colors.bg === "string" &&
    colors.bg.trim() !== "" &&
    sampleNeedsSeparation(colors.bg, surface, surfaceElement);

  if (paintFill) {
    if (colors.bg) el.style.background = colors.bg;
    else el.style.background = "";
    if (applyText) {
      if (colors.text) el.style.color = colors.text;
      else el.style.color = "";
    }
  } else {
    el.style.background = "";
    if (applyText) el.style.color = "";
  }

  el.classList.toggle(COLOR_SAMPLE_SEPARATED_CLASS, needsEdge);
}

/**
 * Persist text/background for a group; clears legacy border (outline uses separation edge).
 * @param {{ colors?: { text?: string, bg?: string, border?: string } }} group
 * @param {{ text: string, bg: string }} colors
 */
export function setGroupColors(group, { text, bg }) {
  if (!group.colors) group.colors = {};
  group.colors.text = text;
  group.colors.bg = bg;
  delete group.colors.border;
}
