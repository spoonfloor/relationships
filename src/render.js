function wordButton({ word, selected, lockedPalette, paletteEntry, onClick }) {
  const btn = document.createElement("button");
  btn.className = "word";
  btn.type = "button";
  btn.textContent = word;

  if (selected) btn.classList.add("selected");

  if (lockedPalette) {
    btn.classList.add("locked", `lock-${lockedPalette}`);
    btn.disabled = true;
    if (paletteEntry?.bg) btn.style.background = paletteEntry.bg;
    if (paletteEntry?.fg) btn.style.color = paletteEntry.fg;
  } else {
    btn.addEventListener("click", onClick);
  }

  return btn;
}

export function renderBoard({ boardEl }, state, handlers) {
  boardEl.innerHTML = "";
  for (const item of state.boardWords) {
    const pal = item.lockedPalette ? state.activePuzzle?.palette?.[item.lockedPalette] : null;
    boardEl.appendChild(
      wordButton({
        word: item.word,
        selected: state.selected.has(item.word),
        lockedPalette: item.lockedPalette,
        paletteEntry: pal,
        onClick: () => handlers.onToggleSelect(item.word),
      })
    );
  }
}

export function renderStatus({ statusEl }, text) {
  statusEl.textContent = text;
}

export function appendFoundGroupCard({ foundEl }, group) {
  const card = document.createElement("div");
  card.className = "groupCard";

  const title = document.createElement("div");
  title.className = "groupTitle";
  title.textContent = group.category;

  const words = document.createElement("div");
  words.className = "groupWords";
  words.textContent = group.words.join(" · ");

  card.appendChild(title);
  card.appendChild(words);
  foundEl.appendChild(card);
}

export function clearFoundGroups({ foundEl }) {
  foundEl.innerHTML = "";
}

