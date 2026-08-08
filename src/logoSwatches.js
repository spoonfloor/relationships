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
 * Nodes for group n: #swatch-n, plus split variants (#swatch-4a / #swatch-4b,
 * #swatch-4-T / #swatch-4-B). All variants share the same group fill.
 * @param {ParentNode} root
 * @param {number} index 0-based group index
 * @returns {SVGElement[]}
 */
export function swatchElementsForIndex(root, index) {
  const n = index + 1;
  const prefix = `swatch-${n}`;
  return [...root.querySelectorAll(`[id^="${prefix}"]`)].filter((el) => {
    if (!(el instanceof SVGElement)) return false;
    const id = el.id;
    if (id === prefix) return true;
    const rest = id.slice(prefix.length);
    const lead = rest.charAt(0);
    return lead === "a" || lead === "b" || lead === "-";
  });
}

/**
 * Paint logo swatches on any SVG root (header or share lockup).
 * @param {ParentNode | null | undefined} root
 * @param {Array<{ colors?: { text?: string, bg?: string } }> | null | undefined} groups
 * @param {{ surface?: "modal" | "canvas", surfaceElement?: Element, textFill?: string }} [options]
 */
export function paintLogoSwatches(root, groups, { surface = "canvas", surfaceElement, textFill } = {}) {
  if (!root || !Array.isArray(groups)) return;

  for (let i = 0; i < 4; i += 1) {
    const fill = resolveLogoSwatchFill(resolveGroupColors(groups[i]).bg, {
      surface,
      surfaceElement,
    });
    for (const swatch of swatchElementsForIndex(root, i)) {
      swatch.removeAttribute("class");
      swatch.style.fill = fill;
    }
  }

  if (typeof textFill === "string" && textFill) {
    const text = root.querySelector("#text");
    if (text instanceof SVGElement) {
      text.removeAttribute("class");
      text.style.fill = textFill;
      for (const path of text.querySelectorAll("path")) {
        path.removeAttribute("class");
        path.style.fill = "inherit";
      }
    }
  }
}

/**
 * @param {Array<{ colors?: { text?: string, bg?: string } }> | null | undefined} groups
 */
export function applyLogoSwatches(groups) {
  paintLogoSwatches(document.querySelector(".page-logo svg"), groups);
}
