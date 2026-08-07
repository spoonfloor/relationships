import { resolveGroupColors } from "./groupColors.js";

const COLS = 4;
const CELL_SIZE = 80;
const CELL_GAP = 20;
const ROW_GAP = 20;
const PADDING = 64;
const BORDER_RADIUS = 12;

function readPageBackgroundColor() {
  return (
    getComputedStyle(document.documentElement).getPropertyValue("--surface-canvas").trim() ||
    "#121212"
  );
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
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * @param {{ words: { colors?: { text?: string, bg?: string } }[] }[]} guesses
 * @returns {HTMLCanvasElement}
 */
export function renderGuessShareCanvas(guesses) {
  const rowCount = guesses.length;
  const gridWidth = COLS * CELL_SIZE + (COLS - 1) * CELL_GAP;
  const gridHeight = rowCount * CELL_SIZE + Math.max(0, rowCount - 1) * ROW_GAP;
  const width = PADDING * 2 + gridWidth;
  const height = PADDING * 2 + gridHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas is not supported.");
  }

  const background = readPageBackgroundColor();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (let row = 0; row < rowCount; row++) {
    const guess = guesses[row];
    for (let col = 0; col < COLS; col++) {
      const wordEntry = guess.words[col];
      const resolved = wordEntry?.colors
        ? resolveGroupColors({ colors: wordEntry.colors })
        : null;
      const fill = resolved?.bg?.trim() || background;

      const x = PADDING + col * (CELL_SIZE + CELL_GAP);
      const y = PADDING + row * (CELL_SIZE + ROW_GAP);

      ctx.fillStyle = fill;
      fillRoundRect(ctx, x, y, CELL_SIZE, CELL_SIZE, BORDER_RADIUS);
    }
  }

  return canvas;
}

/**
 * @param {{ words: { colors?: { text?: string, bg?: string } }[] }[]} guesses
 */
export async function copyGuessResultsToClipboard(guesses) {
  if (!guesses.length) {
    throw new Error("No guesses to share.");
  }
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Clipboard is not supported in this browser.");
  }

  const canvas = renderGuessShareCanvas(guesses);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Failed to encode share image."));
    }, "image/png");
  });

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
