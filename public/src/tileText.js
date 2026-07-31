import { formatDisplayText } from "./typography.js";
import { insertSoftHyphens } from "./tileHyphenation.js";

const MIN_TILE_FONT_PX = 9;
const TILE_FIT_STEP_PX = 0.5;

/** @type {Set<HTMLElement>} */
const pendingFits = new Set();
let fitFrameId = 0;

/** @type {WeakMap<HTMLElement, ResizeObserver>} */
const boardObservers = new WeakMap();

function tileOverflows(element) {
  return (
    element.scrollHeight > element.clientHeight + 1
    || element.scrollWidth > element.clientWidth + 1
  );
}

/** Format puzzle tile copy (smart quotes + soft hyphens; storage stays raw). */
export function formatTileText(text) {
  return insertSoftHyphens(formatDisplayText(text));
}

/** Clear per-tile font scaling. */
export function resetTileTextFit(element) {
  element.style.fontSize = "";
  delete element.dataset.tileFitted;
}

/** Fit tile text: wrap/hyphenate at full size first; shrink font only as last resort. */
export function fitTileText(element) {
  if (!element.textContent) {
    resetTileTextFit(element);
    return;
  }

  resetTileTextFit(element);

  const maxHeight = element.clientHeight;
  const maxWidth = element.clientWidth;
  if (maxHeight <= 0 || maxWidth <= 0) return;

  if (!tileOverflows(element)) {
    element.dataset.tileFitted = "true";
    return;
  }

  let sizePx = parseFloat(getComputedStyle(element).fontSize);
  element.style.fontSize = `${sizePx}px`;

  while (sizePx > MIN_TILE_FONT_PX && tileOverflows(element)) {
    sizePx -= TILE_FIT_STEP_PX;
    element.style.fontSize = `${sizePx}px`;
  }

  element.dataset.tileFitted = "true";
}

function queueTileFit(element) {
  pendingFits.add(element);
  if (fitFrameId) return;
  fitFrameId = requestAnimationFrame(() => {
    fitFrameId = 0;
    const elements = [...pendingFits];
    pendingFits.clear();
    for (const el of elements) {
      fitTileText(el);
    }
  });
}

/** Assign visible tile text and scale to fit. */
export function setTileText(element, text) {
  element.textContent = formatTileText(text);
  queueTileFit(element);
}

function refitTilesIn(root) {
  for (const tile of root.querySelectorAll(".word")) {
    if (!(tile instanceof HTMLElement)) continue;
    if (!tile.textContent || tile.classList.contains("editable-field--focused")) continue;
    fitTileText(tile);
  }
}

/** Refit tiles when a board or puzzle stack changes width. */
export function observeTileBoard(boardEl) {
  if (!(boardEl instanceof HTMLElement)) return;
  if (boardObservers.has(boardEl)) return;

  const observer = new ResizeObserver(() => {
    refitTilesIn(boardEl);
  });
  observer.observe(boardEl);
  boardObservers.set(boardEl, observer);
}
