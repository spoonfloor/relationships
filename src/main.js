import { getDom } from "./dom.js";
import { createInitialState } from "./state.js";
import { loadPuzzle, loadPuzzleIndex } from "./loadPuzzle.js";
import {
  initGameState,
  toggleSelect,
  clearSelection,
  submitSelection,
  assignColorToSelection,
  shuffleUnlocked,
  hintRevealCategory,
  hintRevealWord,
} from "./game.js";
import {
  renderBoard,
  renderStatus,
  appendFoundGroupCard,
  clearFoundGroups,
} from "./render.js";

const dom = getDom();

async function bootstrap() {
  const index = await loadPuzzleIndex("./puzzles/index.json");

  // Populate dropdown
  dom.puzzleSelect.innerHTML = "";
  for (const p of index.puzzles) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label ?? p.id;
    dom.puzzleSelect.appendChild(opt);
  }

  const idToEntry = new Map(index.puzzles.map(p => [p.id, p]));

  // State is created once; we swap its activePuzzle on selection.
  const initialId = index.defaultId && idToEntry.has(index.defaultId)
    ? index.defaultId
    : index.puzzles[0].id;

  const state = createInitialState(await loadPuzzle(`./puzzles/${idToEntry.get(initialId).file}`));
  dom.puzzleSelect.value = initialId;

  const handlers = {
    onToggleSelect(word) {
      const res = toggleSelect(state, word);
      renderStatus(dom, res.ok ? `${state.selected.size} selected.` : res.message);
      renderBoard(dom, state, handlers);
    },
  };

  function startPuzzle(puzzle) {
    state.activePuzzle = puzzle;
    initGameState(state);
    clearFoundGroups(dom);
    renderBoard(dom, state, handlers);
    renderStatus(dom, "Pick 4 words.");
  }

  // Controls
  dom.newGameBtn.addEventListener("click", () => startPuzzle(state.activePuzzle));
  dom.shuffleBtn.addEventListener("click", () => { shuffleUnlocked(state); renderBoard(dom, state, handlers); renderStatus(dom, "Shuffled."); });
  dom.clearBtn.addEventListener("click", () => { clearSelection(state); renderBoard(dom, state, handlers); renderStatus(dom, "Selection cleared."); });

  dom.submitBtn.addEventListener("click", () => {
    const res = submitSelection(state);
    if (res.ok && res.group) appendFoundGroupCard(dom, res.group);
    renderBoard(dom, state, handlers);
    renderStatus(dom, res.message);
  });

  dom.colorChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const res = assignColorToSelection(state, chip.dataset.color);
      if (res.ok && res.group) appendFoundGroupCard(dom, res.group);
      renderBoard(dom, state, handlers);
      renderStatus(dom, res.message);
    });
  });

  dom.hintCategoryBtn.addEventListener("click", () => renderStatus(dom, hintRevealCategory(state).message));
  dom.hintWordBtn.addEventListener("click", () => { const res = hintRevealWord(state); renderBoard(dom, state, handlers); renderStatus(dom, res.message); });

  // Puzzle switching
  dom.puzzleSelect.addEventListener("change", async () => {
    try {
      const id = dom.puzzleSelect.value;
      const entry = idToEntry.get(id);
      const puzzle = await loadPuzzle(`./puzzles/${entry.file}`);
      startPuzzle(puzzle);
    } catch (e) {
      console.error(e);
      renderStatus(dom, `Puzzle load error: ${e.message}`);
    }
  });

  // Start initial
  startPuzzle(state.activePuzzle);
}

bootstrap().catch(err => {
  console.error(err);
  dom.statusEl.textContent = `Startup error: ${err.message}`;
});


