import { formatDisplayText } from "./typography.js";
import { planTileLineLayouts } from "./tileHyphenation.js";

/**
 * Tile text DOM contract:
 * - Unfitted (editing / placeholder): .word → plain text
 * - Fitted (display): .word → .tile-text → .tile-line × N
 */
const MIN_TILE_FONT_PX = 9;
const TILE_FIT_STEP_PX = 0.5;
const TILE_TEXT_CLASS = "tile-text";
const TILE_LINE_CLASS = "tile-line";

/** @type {Set<HTMLElement>} */
const pendingFits = new Set();
let fitFrameId = 0;

/** @type {WeakMap<HTMLElement, ResizeObserver>} */
const boardObservers = new WeakMap();

const OVERFLOW_TOLERANCE_PX = 1;

/** Inner area excluding padding — where tile copy must fit. */
function readTileContentBox(element) {
  const style = getComputedStyle(element);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return {
    width: Math.max(0, element.clientWidth - padX),
    height: Math.max(0, element.clientHeight - padY),
  };
}

/** Painted glyph width (scrollWidth lies when ancestors cap max-width). */
function measureContentWidth(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getBoundingClientRect().width;
}

function tileOverflows(element) {
  const { width: maxWidth, height: maxHeight } = readTileContentBox(element);
  if (maxWidth <= 0 || maxHeight <= 0) return false;

  const lines = element.querySelectorAll(`.${TILE_LINE_CLASS}`);
  if (lines.length > 0) {
    for (const line of lines) {
      if (measureContentWidth(line) > maxWidth + OVERFLOW_TOLERANCE_PX) return true;
    }
    const textWrap = element.querySelector(`.${TILE_TEXT_CLASS}`);
    if (textWrap) {
      const wrapHeight = textWrap.getBoundingClientRect().height;
      if (wrapHeight > maxHeight + OVERFLOW_TOLERANCE_PX) return true;
    }
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  const rect = range.getBoundingClientRect();
  return (
    rect.width > maxWidth + OVERFLOW_TOLERANCE_PX
    || rect.height > maxHeight + OVERFLOW_TOLERANCE_PX
  );
}

/** @param {HTMLElement} element */
function clearTileLayout(element) {
  element.replaceChildren();
}

/** @param {HTMLElement} element @param {string[]} lines */
function renderTileLines(element, lines) {
  clearTileLayout(element);
  const textWrap = document.createElement("span");
  textWrap.className = TILE_TEXT_CLASS;
  for (const line of lines) {
    const lineEl = document.createElement("span");
    lineEl.className = TILE_LINE_CLASS;
    lineEl.textContent = line;
    textWrap.appendChild(lineEl);
  }
  element.appendChild(textWrap);
}

/** @param {HTMLElement} element */
function readTileLineHeightPx(element) {
  const lineHeight = parseFloat(getComputedStyle(element).lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  const fontSize = parseFloat(getComputedStyle(element).fontSize);
  const ratio =
    parseFloat(getComputedStyle(element).getPropertyValue("--word-line-height")) || 1.2;
  return fontSize * ratio;
}

/** @param {HTMLElement} element */
function readTileSourceText(element) {
  const stored = element.dataset.tileText;
  if (stored != null && stored !== "") return stored;
  return (element.textContent ?? "").replace(/\u00AD/g, "").replace(/-/g, "");
}

/** @param {HTMLElement} element @param {string} word */
function findBestLayout(element, word) {
  const { width, height: maxHeight } = readTileContentBox(element);
  if (maxHeight <= 0 || width <= 0) return null;

  const lineHeight = readTileLineHeightPx(element);
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const layouts = planTileLineLayouts(word, maxLines);

  for (const lines of layouts) {
    renderTileLines(element, lines);
    if (!tileOverflows(element)) return lines;
  }

  return null;
}

/** Format puzzle tile copy (smart quotes; storage stays raw). */
export function formatTileText(text) {
  return formatDisplayText(text);
}

/** Clear per-tile font scaling and line layout. */
export function resetTileTextFit(element) {
  element.style.fontSize = "";
  delete element.dataset.tileFitted;
  const source = readTileSourceText(element);
  if (source) {
    element.textContent = source;
  } else {
    clearTileLayout(element);
  }
}

/** Fit tile text: try balanced multi-line breaks at full size; shrink only as last resort. */
export function fitTileText(element) {
  const raw = readTileSourceText(element);
  if (!raw) {
    resetTileTextFit(element);
    delete element.dataset.tileText;
    return;
  }

  const word = formatTileText(raw);
  element.dataset.tileText = word;
  element.style.fontSize = "";

  const { width, height: maxHeight } = readTileContentBox(element);
  if (maxHeight <= 0 || width <= 0) return;

  let sizePx = parseFloat(getComputedStyle(element).fontSize);
  /** @type {string[] | null} */
  let bestLayout = null;

  while (sizePx >= MIN_TILE_FONT_PX) {
    element.style.fontSize = `${sizePx}px`;
    const layout = findBestLayout(element, word);
    if (layout) {
      bestLayout = layout;
      break;
    }
    sizePx -= TILE_FIT_STEP_PX;
  }

  if (bestLayout) {
    renderTileLines(element, bestLayout);
    element.style.fontSize = `${sizePx}px`;
  } else {
    renderTileLines(element, [word]);
    element.style.fontSize = `${MIN_TILE_FONT_PX}px`;
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
  const display = formatTileText(text);
  element.dataset.tileText = display;
  queueTileFit(element);
}

function refitTilesIn(root) {
  for (const tile of root.querySelectorAll(".word")) {
    if (!(tile instanceof HTMLElement)) continue;
    if (!readTileSourceText(tile) || tile.classList.contains("editable-field--focused")) continue;
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
