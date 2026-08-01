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

/** @param {SVGSVGElement} svg */
function readSvgPixelSize(svg) {
  const widthAttr = svg.getAttribute("width");
  const heightAttr = svg.getAttribute("height");
  if (widthAttr && heightAttr) {
    const width = parseFloat(widthAttr);
    const height = parseFloat(heightAttr);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return { width, height };
    }
  }

  const { width, height } = svg.viewBox.baseVal;
  if (width > 0 && height > 0) {
    return { width, height };
  }

  return null;
}

/** @param {SVGSVGElement} svg */
function lockSvgToFileSize(svg) {
  const size = readSvgPixelSize(svg);
  if (!size) return;

  svg.setAttribute("width", String(size.width));
  svg.setAttribute("height", String(size.height));
  svg.style.width = `${size.width}px`;
  svg.style.height = `${size.height}px`;
  svg.style.maxWidth = "none";
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
  if (svg instanceof SVGSVGElement) {
    svg.classList.add("page-logo__img");
    svg.setAttribute("aria-hidden", "true");
    lockSvgToFileSize(svg);
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
