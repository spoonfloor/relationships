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
import { getSelectionBand, isSelected } from "./selection.js";

/** @typedef {import("./colorSample.js").ColorSampleSurface} ColorSampleSurface */

/** @param {Element} guessesEl @returns {ColorSampleSurface} */
function guessSwatchSurface(guessesEl) {
  return guessesEl.closest(".modal__panel") ? "modal" : "canvas";
}

function wordButton({ word, selected, selectionBand, colors, revealed, onClick, onMouseOver, onMouseOut }) {
  const btn = document.createElement("button");
  btn.className = "word";
  btn.type = "button";
  setTileText(btn, word);

  if (selected) {
    btn.classList.add("selected");
    if (selectionBand != null) {
      btn.classList.add(`selected--band-${selectionBand + 1}`);
    }
  }
  if (colors && revealed) {
    applyGroupColorsToElement(btn, colors);
  }

  btn.addEventListener("click", onClick);
  if (onMouseOver) btn.addEventListener("mouseover", (event) => onMouseOver(word, event));
  if (onMouseOut) btn.addEventListener("mouseout", onMouseOut);

  return btn;
}

function createFoundGroupCard(group, displayName, colors) {
  const resolved = colors ? resolveGroupColors({ colors }) : null;
  const card = document.createElement("div");
  card.className = "groupCard";

  if (resolved) {
    applyGroupColorsToElement(card, resolved, { surface: "canvas" });
  }

  const title = document.createElement("div");
  title.className = "groupTitle";
  setDisplayText(title, displayName);

  const words = document.createElement("div");
  words.className = "groupWords";
  const wordTexts = group.words.map((w) => (typeof w === "string" ? w : w.text));
  setDisplayText(words, wordTexts.join(", "));

  card.appendChild(title);
  card.appendChild(words);
  return card;
}

export function renderSolvedSets({ solvedSetsEl }, foundGroups) {
  if (!solvedSetsEl) return;
  solvedSetsEl.replaceChildren();
  for (const group of foundGroups) {
    if (group.words.length === 0) continue;
    solvedSetsEl.appendChild(createFoundGroupCard(group, group.title, group.colors));
  }
}

export function renderBoard({ boardEl }, state, handlers) {
  const unlocked = state.boardWords.filter((item) => item.lockedGroupIndex == null);
  boardEl.replaceChildren();

  if (unlocked.length === 0) {
    boardEl.hidden = true;
    return;
  }

  boardEl.hidden = false;
  observeTileBoard(boardEl);

  for (const item of unlocked) {
    const isRevealed = state.revealedWords.has(item.word);
    const group = state.wordToGroupMap.get(item.word);
    const colors =
      group && isGroupColorsAssigned(group) ? resolveGroupColors(group) : null;

    boardEl.appendChild(
      wordButton({
        word: item.word,
        selected: isSelected(state, item.word),
        selectionBand: getSelectionBand(state, item.word),
        colors: isRevealed ? colors : null,
        revealed: isRevealed,
        onClick: () => handlers.onToggleSelect(item.word),
        onMouseOver: state.glossaryEnabled ? handlers.onMouseOverWord : null,
        onMouseOut: state.glossaryEnabled ? handlers.onMouseOutWord : null,
      }),
    );
  }
}

/** Canonical play-area renderer: solved banners above the unsolved tile grid. */
export function renderPlayArea(dom, state, handlers) {
  renderSolvedSets(dom, state.foundGroups);
  renderBoard(dom, state, handlers);
}

export function renderStatus({ statusEl }, text) {
  setDisplayText(statusEl, text);
}

export function appendFoundGroupCard({ foundEl }, group, displayName, colors) {
  foundEl.appendChild(createFoundGroupCard(group, displayName, colors));
}

export function clearFoundGroups({ foundEl }) {
  foundEl.innerHTML = "";
}

/** Clear play-mode DOM without rendering the board (e.g. before compose takes over). */
export function clearPlaySurface(dom) {
  renderSolvedSets(dom, []);
  clearFoundGroups(dom);
  dom.guessesEl.innerHTML = "";
  dom.mostRecentGuessEl.innerHTML = "";
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
      box.className = "guess-box";

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
