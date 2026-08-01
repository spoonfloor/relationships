import { resolveGroupColors } from "./groupColors.js";
import { resolveLogoSwatchFill } from "./colorSample.js";

/** @type {Promise<void> | null} */
let initPromise = null;

export function initPageLogo() {
  if (!initPromise) {
    initPromise = loadPageLogo();
  }
  return initPromise;
}

async function loadPageLogo() {
  const container = document.querySelector(".page-logo");
  if (!container) return;

  const res = await fetch("./logo.svg", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load logo.svg: ${res.status} ${res.statusText}`);
  }

  container.innerHTML = await res.text();
  const svg = container.querySelector("svg");
  if (svg) {
    svg.classList.add("page-logo__img");
    svg.setAttribute("aria-hidden", "true");
  }
}

/**
 * @param {Array<{ colors?: { text?: string, bg?: string } }> | null | undefined} groups
 */
export function applyLogoSwatches(groups) {
  const root = document.querySelector(".page-logo svg");
  if (!root || !Array.isArray(groups)) return;

  for (let i = 0; i < 4; i += 1) {
    const swatch = root.querySelector(`#swatch-${i + 1}`);
    if (!(swatch instanceof SVGElement)) continue;
    swatch.removeAttribute("class");
    swatch.style.fill = resolveLogoSwatchFill(resolveGroupColors(groups[i]).bg, {
      surface: "canvas",
    });
  }
}
