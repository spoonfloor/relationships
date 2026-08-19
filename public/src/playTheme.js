import {
  contrastRatio,
  mixHex,
  normalizeHex,
} from "./color.js";
import { getColorScheme } from "./colorScheme.js";
import { isGroupColorsAssigned } from "./groupColors.js";

/** WCAG AA large text — 18px footer primary labels. */
const MIN_CTA_CONTRAST = 3;

const HOVER_MIX_PERCENT = 15;

/** @typedef {{ fill: string, label: string, hover: string }} PlayTheme */

/** @typedef {"light" | "dark"} ColorScheme */

/** @param {ColorScheme} scheme */
export function neutralPlayTheme(scheme) {
  if (scheme === "light") {
    const fill = "#1A1A1A";
    const label = "#FFFFFF";
    return {
      fill,
      label,
      hover: mixHex(fill, label, HOVER_MIX_PERCENT),
    };
  }

  const fill = "#F0F0F0";
  const label = "#1A1A1A";
  return {
    fill,
    label,
    hover: mixHex(fill, label, HOVER_MIX_PERCENT),
  };
}

/**
 * @param {string} fill
 * @param {string} label
 * @returns {PlayTheme}
 */
function playThemeFromPair(fill, label) {
  const normalizedFill = normalizeHex(fill);
  const normalizedLabel = normalizeHex(label);
  return {
    fill: normalizedFill,
    label: normalizedLabel,
    hover: mixHex(normalizedFill, normalizedLabel, HOVER_MIX_PERCENT),
  };
}

/**
 * Play chrome from set 1 colors: bg fill + text label (same as solved tiles).
 * Swap only when the authored pair is below minimum legibility; neutral when unset.
 * @param {{ colors?: { text?: string, bg?: string } } | null | undefined} group
 * @param {ColorScheme} [scheme]
 * @returns {PlayTheme}
 */
export function resolvePlayThemeFromGroup(group, scheme = getColorScheme()) {
  if (!isGroupColorsAssigned(group)) {
    return neutralPlayTheme(scheme);
  }

  const bg = group.colors.bg;
  const text = group.colors.text;

  const native = playThemeFromPair(bg, text);
  if (contrastRatio(native.fill, native.label) >= MIN_CTA_CONTRAST) {
    return native;
  }

  const swapped = playThemeFromPair(text, bg);
  if (contrastRatio(swapped.fill, swapped.label) >= MIN_CTA_CONTRAST) {
    return swapped;
  }

  return native;
}

/**
 * Scheme-aware neutral play chrome (before a puzzle loads or when set 1 is unset).
 * @param {ColorScheme} [scheme]
 */
export function applyNeutralPlayTheme(scheme = getColorScheme()) {
  const theme = neutralPlayTheme(scheme);
  const root = document.documentElement;
  root.style.setProperty("--theme-play-primary", theme.fill);
  root.style.setProperty("--theme-play-primary-hover", theme.hover);
  root.style.setProperty("--cta-primary-color", theme.label);
}

/**
 * Apply play-mode accent tokens from the active puzzle's set 1 palette.
 * @param {{ groups?: Array<{ colors?: { text?: string, bg?: string } }> } | null | undefined} puzzle
 * @param {ColorScheme} [scheme]
 */
export function applyPlayTheme(puzzle, scheme = getColorScheme()) {
  const group = puzzle?.groups?.[0];
  const theme = resolvePlayThemeFromGroup(group, scheme);
  const root = document.documentElement;
  root.style.setProperty("--theme-play-primary", theme.fill);
  root.style.setProperty("--theme-play-primary-hover", theme.hover);
  root.style.setProperty("--cta-primary-color", theme.label);
}
