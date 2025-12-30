/**
 * @fileoverview Copyright 2025 Ed Korthof and Cristie Henry
 */

function wordButton({ word, selected, lockedPalette, paletteEntry, revealed, onClick, onMouseOver, onMouseOut }) {
  const btn = document.createElement("button");
  btn.className = "word";
  btn.type = "button";
  btn.textContent = word;

  if (selected) btn.classList.add("selected");
  if (revealed) {
    if (paletteEntry?.bg) btn.style.background = paletteEntry.bg;
    if (paletteEntry?.fg) btn.style.color = paletteEntry.fg;
  }

  if (lockedPalette) {
    btn.classList.add("locked", `lock-${lockedPalette}`);
    btn.disabled = true;
    if (paletteEntry?.bg) btn.style.background = paletteEntry.bg;
    if (paletteEntry?.fg) btn.style.color = paletteEntry.fg;
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
    const paletteKey = item.lockedPalette || (isRevealed ? state.wordToGroupMap.get(item.word)?.palette : null);
    const pal = paletteKey ? state.activePuzzle?.palette?.[paletteKey] : null;

    boardEl.appendChild(
      wordButton({
        word: item.word,
        selected: state.selected.has(item.word),
        lockedPalette: item.lockedPalette,
        paletteEntry: pal,
        revealed: isRevealed,
        onClick: () => handlers.onToggleSelect(item.word),
        onMouseOver: state.glossaryEnabled ? handlers.onMouseOverWord : null,
        onMouseOut: state.glossaryEnabled ? handlers.onMouseOutWord : null,
      })
    );
  }
}

export function renderStatus({ statusEl }, text) {
  statusEl.textContent = text;
}

export function appendFoundGroupCard({ foundEl }, group, displayName) {
  const card = document.createElement("div");
  card.className = "groupCard";

  const title = document.createElement("div");
  title.className = "groupTitle";
  title.textContent = displayName;

  const words = document.createElement("div");
  words.className = "groupWords";
  if (group.words.length > 0) {
    words.textContent = group.words.join(" · ");
  } else {
    words.innerHTML = "&nbsp;"; // Keep height
  }

  card.appendChild(title);
  card.appendChild(words);
  foundEl.appendChild(card);
}

export function clearFoundGroups({ foundEl }) {
  foundEl.innerHTML = "";
}

export function renderGuesses({ guessesEl }, guesses, palette) {
  guessesEl.innerHTML = "";
  for (const guess of guesses) {
    const row = document.createElement("div");
    row.className = "guess-row";
    for (const word of guess.words) {
      const box = document.createElement("div");
      box.className = "guess-box";
      const palEntry = palette[word.palette];
      if (palEntry?.bg) {
        box.style.backgroundColor = palEntry.bg;
      }
      if (palEntry?.fg) {
        const foregroundBox = document.createElement('div');
        foregroundBox.className = 'foreground-box';
        foregroundBox.style.backgroundColor = palEntry.fg;
        box.appendChild(foregroundBox);
      }
      row.appendChild(box);
    }
    guessesEl.appendChild(row);
  }
}
