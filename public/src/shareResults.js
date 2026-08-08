import { resolveGroupColors } from "./groupColors.js";
import { paintLogoSwatches } from "./logoSwatches.js";

/** Layout tokens from share-mockup.html */
const CONTENT_WIDTH = 420;
const OUTER_MARGIN = 40;
const PAGE_COLOR = "#1f1f1f";
const FG = "#f0f0f0";

const TITLE_WEIGHT = 600;
const COUNT_WEIGHT = 400;
const TITLE_SIZE = 40;
const COUNT_SIZE = 36;
const TITLE_LINE_HEIGHT = TITLE_SIZE * 1.2;

const LOGO_GAP_BELOW = 38;
const COUNT_GAP_ABOVE = 26;
const GRID_GAP_ABOVE = 46;

const COLS = 4;
const TILE_GAP = 18;
const TILE_RADIUS = 16;
const TILE = (CONTENT_WIDTH - (COLS - 1) * TILE_GAP) / COLS;

const SHARE_LOGO_HREF = new URL("../share-logo.svg", import.meta.url).href;
const PIXEL_RATIO = 2;

const EMOJI_POOLS = [
  { max: 4, emojis: ["🤩", "🔥", "🚀", "🏆"] },
  { max: 7, emojis: ["🎉", "💪", "🙌", "🥳"] },
  { max: 12, emojis: ["🍭", "😻", "✨", "😎"] },
  { max: Infinity, emojis: ["❤️‍🔥", "🌈", "😅", "🤍"] },
];

/** @type {Promise<string> | null} */
let shareLogoSvgTextPromise = null;

function readCssVar(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** @param {number} n */
export function emojiPoolForGuesses(n) {
  for (const pool of EMOJI_POOLS) {
    if (n <= pool.max) return pool.emojis;
  }
  return EMOJI_POOLS[EMOJI_POOLS.length - 1].emojis;
}

/** @param {number} n */
export function pickShareEmoji(n) {
  const pool = emojiPoolForGuesses(n);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** @param {CanvasRenderingContext2D} ctx */
function fillRoundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];

  /** @type {string[]} */
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function loadShareLogoSvgText() {
  if (!shareLogoSvgTextPromise) {
    shareLogoSvgTextPromise = fetch(SHARE_LOGO_HREF, { cache: "no-store" }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to load share-logo.svg: ${res.status} ${res.statusText}`);
      }
      return res.text();
    });
  }
  return shareLogoSvgTextPromise;
}

/**
 * @param {Array<{ colors?: { text?: string, bg?: string } }> | null | undefined} groups
 * @returns {Promise<HTMLImageElement>}
 */
async function renderShareLogoImage(groups) {
  const svgText = await loadShareLogoSvgText();
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("share-logo.svg has no <svg>");
  }

  paintLogoSwatches(svg, groups, { surface: "canvas", textFill: FG });
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to decode share logo."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @typedef {{ words: { colors?: { text?: string, bg?: string } }[] }[]} ShareGuesses
 * @typedef {{
 *   guesses: ShareGuesses,
 *   title?: string,
 *   groups?: Array<{ colors?: { text?: string, bg?: string } }>,
 *   emoji?: string,
 * }} ShareRenderOptions
 */

/**
 * @param {ShareRenderOptions} options
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderGuessShareCanvas({ guesses, title = "", groups = [], emoji } = {}) {
  if (!Array.isArray(guesses) || !guesses.length) {
    throw new Error("No guesses to share.");
  }

  const rowCount = guesses.length;
  const resolvedEmoji = emoji ?? pickShareEmoji(rowCount);
  const guessLabel = rowCount === 1 ? "guess" : "guesses";
  const countText = `Solved in ${rowCount} ${guessLabel} ${resolvedEmoji}`;

  await Promise.all([
    document.fonts.load(`${TITLE_WEIGHT} ${TITLE_SIZE}px Inter`),
    document.fonts.load(`${COUNT_WEIGHT} ${COUNT_SIZE}px Inter`),
  ]);

  const logoImg = await renderShareLogoImage(groups);
  const logoHeight = CONTENT_WIDTH * (logoImg.naturalHeight / logoImg.naturalWidth);

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("Canvas is not supported.");
  measureCtx.font = `${TITLE_WEIGHT} ${TITLE_SIZE}px Inter, sans-serif`;
  const titleLines = wrapText(measureCtx, title, CONTENT_WIDTH);
  const titleBlockHeight = titleLines.length
    ? titleLines.length * TITLE_LINE_HEIGHT
    : 0;

  const width = OUTER_MARGIN * 2 + CONTENT_WIDTH;
  const gridHeight =
    rowCount * TILE + Math.max(0, rowCount - 1) * TILE_GAP;
  const height =
    OUTER_MARGIN +
    logoHeight +
    (titleLines.length ? LOGO_GAP_BELOW + titleBlockHeight : 0) +
    COUNT_GAP_ABOVE +
    COUNT_SIZE * 1.3 +
    GRID_GAP_ABOVE +
    gridHeight +
    OUTER_MARGIN;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * PIXEL_RATIO);
  canvas.height = Math.round(height * PIXEL_RATIO);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported.");
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO);

  const background = PAGE_COLOR || readCssVar("--surface-canvas", "#1f1f1f");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  let y = OUTER_MARGIN;
  const x = OUTER_MARGIN;

  ctx.drawImage(logoImg, x, y, CONTENT_WIDTH, logoHeight);
  y += logoHeight;

  if (titleLines.length) {
    y += LOGO_GAP_BELOW;
    ctx.fillStyle = FG;
    ctx.font = `${TITLE_WEIGHT} ${TITLE_SIZE}px Inter, sans-serif`;
    ctx.textBaseline = "top";
    for (const line of titleLines) {
      ctx.fillText(line, x, y);
      y += TITLE_LINE_HEIGHT;
    }
  }

  y += COUNT_GAP_ABOVE;
  ctx.fillStyle = FG;
  ctx.font = `${COUNT_WEIGHT} ${COUNT_SIZE}px Inter, sans-serif`;
  ctx.textBaseline = "top";
  ctx.fillText(countText, x, y);
  y += COUNT_SIZE * 1.3;

  y += GRID_GAP_ABOVE;
  for (let row = 0; row < rowCount; row++) {
    const guess = guesses[row];
    for (let col = 0; col < COLS; col++) {
      const wordEntry = guess.words[col];
      const resolved = wordEntry?.colors
        ? resolveGroupColors({ colors: wordEntry.colors })
        : null;
      const fill = resolved?.bg?.trim() || background;
      const cellX = x + col * (TILE + TILE_GAP);
      const cellY = y + row * (TILE + TILE_GAP);
      ctx.fillStyle = fill;
      fillRoundRect(ctx, cellX, cellY, TILE, TILE, TILE_RADIUS);
    }
  }

  return canvas;
}

/**
 * @param {ShareRenderOptions} options
 */
export async function copyGuessResultsToClipboard(options) {
  const guesses = options?.guesses;
  if (!Array.isArray(guesses) || !guesses.length) {
    throw new Error("No guesses to share.");
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard is not supported in this browser.");
  }

  const canvas = await renderGuessShareCanvas(options);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Failed to encode share image."));
    }, "image/png");
  });

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
