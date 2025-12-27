function wordButton({ word, selected, lockedColor, onClick }) {
  const btn = document.createElement("button");
  btn.className = "word";
  btn.type = "button";
  btn.textContent = word;

  if (selected) btn.classList.add("selected");

  if (lockedColor) {
    btn.classList.add("locked", `lock-${lockedColor}`);
    btn.disabled = true;
  } else {
    btn.addEventListener("click", onClick);
  }

  return btn;
}

export function renderBoard({ boardEl }, state, handlers) {
  boardEl.innerHTML = "";
  for (const item of state.boardWords) {
    boardEl.appendChild(
      wordButton({
        word: item.word,
        selected: state.selected.has(item.word),
        lockedColor: item.lockedColor,
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
  title.textContent = `${group.category} (${group.color.toUpperCase()})`;

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

