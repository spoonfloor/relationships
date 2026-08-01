import { observeTileBoard, setDisplayText, setTileText } from "./display.js";
import {
  applyGroupColorsToElement,
  isGroupColorsAssigned,
  resolveGroupColors,
} from "./groupColors.js";
import {
  COLOR_SAMPLE_CLASS,
  COLOR_SAMPLE_SEPARATED_CLASS,
  sampleNeedsSeparationAgainst,
} from "./colorSample.js";

/** @typedef {import("./colorSample.js").ColorSampleSurface} ColorSampleSurface */

/** @param {Element} guessesEl @returns {ColorSampleSurface} */
function guessSwatchSurface(guessesEl) {
  return guessesEl.closest(".modal__panel") ? "modal" : "canvas";
}

function wordButton({ word, selected, colors, revealed, onClick, onMouseOver, onMouseOut }) {
  const btn = document.createElement("button");
  btn.className = "word";
  btn.type = "button";
  setTileText(btn, word);

  if (selected) btn.classList.add("selected");
  if (colors && (revealed || colors.locked)) {
    applyGroupColorsToElement(btn, colors);
  }

  if (colors?.locked) {
    btn.classList.add("locked");
    btn.disabled = true;
  } else {
    btn.addEventListener("click", onClick);
    if (onMouseOver) btn.addEventListener("mouseover", (event) => onMouseOver(word, event));
    if (onMouseOut) btn.addEventListener("mouseout", onMouseOut);
  }

  return btn;
}

export function renderBoard({ boardEl }, state, handlers) {
  boardEl.innerHTML = "";
  observeTileBoard(boardEl);
  for (const item of state.boardWords) {
    const isRevealed = state.revealedWords.has(item.word);
    const group = state.wordToGroupMap.get(item.word);
    const isLocked = item.lockedGroupIndex != null;
    const colors =
      group && isGroupColorsAssigned(group)
        ? { ...resolveGroupColors(group), locked: isLocked }
        : null;

    boardEl.appendChild(
      wordButton({
        word: item.word,
        selected: state.selected.has(item.word),
        colors: isLocked || isRevealed ? colors : null,
        revealed: isRevealed,
        onClick: () => handlers.onToggleSelect(item.word),
        onMouseOver: state.glossaryEnabled ? handlers.onMouseOverWord : null,
        onMouseOut: state.glossaryEnabled ? handlers.onMouseOutWord : null,
      }),
    );
  }
}

export function renderStatus({ statusEl }, text) {
  setDisplayText(statusEl, text);
}

export function appendFoundGroupCard({ foundEl }, group, displayName, colors) {
  const resolved = colors ? resolveGroupColors({ colors }) : null;
  const card = document.createElement("div");
  card.className = resolved ? `groupCard ${COLOR_SAMPLE_CLASS}` : "groupCard";

  if (resolved) {
    applyGroupColorsToElement(card, resolved, { surface: "canvas" });
  }

  const title = document.createElement("div");
  title.className = "groupTitle";
  setDisplayText(title, displayName);

  const words = document.createElement("div");
  words.className = "groupWords";
  const wordTexts = group.words.map((w) => (typeof w === "string" ? w : w.text));
  if (wordTexts.length > 0) {
    setDisplayText(words, wordTexts.join(" · "));
  } else {
    words.innerHTML = "&nbsp;";
  }

  card.appendChild(title);
  card.appendChild(words);
  foundEl.appendChild(card);
}

export function clearFoundGroups({ foundEl }) {
  foundEl.innerHTML = "";
}

export function renderGuesses({ guessesEl }, guesses) {
  guessesEl.innerHTML = "";
  const surface = guessSwatchSurface(guessesEl);

  for (const guess of guesses) {
    const row = document.createElement("div");
    row.className = "guess-row";
    for (const { colors } of guess.words) {
      const resolved = colors ? resolveGroupColors({ colors }) : null;
      const box = document.createElement("div");
      box.className = resolved ? `guess-box ${COLOR_SAMPLE_CLASS}` : "guess-box";

      if (resolved?.bg) {
        applyGroupColorsToElement(box, resolved, {
          surface,
          surfaceElement: guessesEl.closest(".modal__panel") ?? undefined,
          applyText: false,
        });
      }

      if (resolved?.text && resolved?.bg) {
        const foregroundBox = document.createElement("div");
        foregroundBox.className = `foreground-box ${COLOR_SAMPLE_CLASS}`;
        foregroundBox.style.backgroundColor = resolved.text;
        foregroundBox.classList.toggle(
          COLOR_SAMPLE_SEPARATED_CLASS,
          sampleNeedsSeparationAgainst(resolved.text, resolved.bg),
        );
        box.appendChild(foregroundBox);
      }

      row.appendChild(box);
    }
    guessesEl.appendChild(row);
  }
}
