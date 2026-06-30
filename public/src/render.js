import { setDisplayText } from "./display.js";

function wordButton({ word, selected, colors, revealed, onClick, onMouseOver, onMouseOut }) {
  const btn = document.createElement("button");
  btn.className = "word";
  btn.type = "button";
  setDisplayText(btn, word);

  if (selected) btn.classList.add("selected");
  if (colors && (revealed || colors.locked)) {
    if (colors.bg) btn.style.background = colors.bg;
    if (colors.text) btn.style.color = colors.text;
    if (colors.border) btn.style.borderColor = colors.border;
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
  for (const item of state.boardWords) {
    const isRevealed = state.revealedWords.has(item.word);
    const group = state.wordToGroupMap.get(item.word);
    const isLocked = item.lockedGroupIndex != null;
    const colors = group?.colors
      ? { ...group.colors, locked: isLocked }
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
      })
    );
  }
}

export function renderStatus({ statusEl }, text) {
  setDisplayText(statusEl, text);
}

export function appendFoundGroupCard({ foundEl }, group, displayName, colors) {
  const card = document.createElement("div");
  card.className = "groupCard";

  if (colors?.bg) card.style.background = colors.bg;
  if (colors?.text) card.style.color = colors.text;

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
  for (const guess of guesses) {
    const row = document.createElement("div");
    row.className = "guess-row";
    for (const { colors } of guess.words) {
      const box = document.createElement("div");
      box.className = "guess-box";
      if (colors?.bg) {
        box.style.backgroundColor = colors.bg;
      }
      if (colors?.text) {
        const foregroundBox = document.createElement("div");
        foregroundBox.className = "foreground-box";
        foregroundBox.style.backgroundColor = colors.text;
        box.appendChild(foregroundBox);
      }
      row.appendChild(box);
    }
    guessesEl.appendChild(row);
  }
}
