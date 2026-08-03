const STORAGE_KEY = "relationships.colorScheme";
const DEFAULT_SCHEME = "dark";

/** @typedef {"light" | "dark"} ColorScheme */

/** @type {Set<(scheme: ColorScheme) => void>} */
const listeners = new Set();

/** @returns {ColorScheme} */
export function getColorScheme() {
  return document.documentElement.dataset.colorScheme === "light" ? "light" : "dark";
}

export function isDarkMode() {
  return getColorScheme() === "dark";
}

function syncThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const canvas = getComputedStyle(document.documentElement)
    .getPropertyValue("--surface-canvas")
    .trim();
  if (canvas) meta.setAttribute("content", canvas);
}

/**
 * @param {ColorScheme} scheme
 */
export function setColorScheme(scheme) {
  const next = scheme === "light" ? "light" : "dark";
  document.documentElement.dataset.colorScheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore quota errors or private browsing
  }
  syncThemeColorMeta();
  for (const listener of listeners) listener(next);
}

/**
 * @param {(scheme: ColorScheme) => void} listener
 * @returns {() => void}
 */
export function onColorSchemeChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** @returns {ColorScheme} */
export function initColorScheme() {
  let scheme = DEFAULT_SCHEME;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") scheme = stored;
  } catch {
    // ignore
  }
  document.documentElement.dataset.colorScheme = scheme;
  syncThemeColorMeta();
  return scheme;
}

/**
 * @param {HTMLInputElement} switchEl
 */
export function bindDarkModeSwitch(switchEl) {
  function syncSwitch(scheme) {
    const dark = scheme === "dark";
    switchEl.checked = dark;
    switchEl.setAttribute("aria-checked", dark ? "true" : "false");
  }

  syncSwitch(getColorScheme());

  switchEl.addEventListener("change", () => {
    setColorScheme(switchEl.checked ? "dark" : "light");
  });

  switchEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  return onColorSchemeChange(syncSwitch);
}
