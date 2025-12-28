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

  const whimsicalNames = {
    yellow: "Golden Sunshine",
    green: "Emerald Forest",
    blue: "Azure Sky",
    purple: "Royal Amethyst",
    a: "Coral Mist",
    b: "Meadow",
    c: "Lake",
    d: "Plum",
  };

  const idToEntry = new Map(index.puzzles.map(p => [p.id, p]));

  // State is created once; we swap its activePuzzle on selection.
  const initialId = index.defaultId && idToEntry.has(index.defaultId)
    ? index.defaultId
    : index.puzzles[0].id;

  const state = createInitialState(await loadPuzzle(`./puzzles/${idToEntry.get(initialId).file}`));
  dom.puzzleSelect.value = initialId;

  function renderPaletteChips() {
    const pal = state.activePuzzle.palette || {};
    dom.paletteChipsEl.innerHTML = "";
    for (const [palette, entry] of Object.entries(pal)) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      btn.textContent = entry.name ?? palette.toUpperCase();
      if (entry.bg) btn.style.background = entry.bg;
      if (entry.fg) btn.style.color = entry.fg;
      btn.addEventListener("click", () => {
        const res = assignColorToSelection(state, palette);
        if (res.ok && res.group) {
          appendFoundGroupCard(dom, res.group, whimsicalNames[res.group.palette] || res.group.palette);
          // color the last-added card
          const last = dom.foundEl.lastElementChild;
          if (last && entry.bg) last.style.background = entry.bg;
          if (last && entry.fg) last.style.color = entry.fg;
        }
        renderBoard(dom, state, handlers);
        renderStatus(dom, res.message);
      });
      dom.paletteChipsEl.appendChild(btn);
    }
  }

  const handlers = {
    onToggleSelect(word) {
      const res = toggleSelect(state, word);
      renderStatus(dom, res.ok ? `${state.selected.size} selected.` : res.message);
      renderBoard(dom, state, handlers);
    },
  };

  function startPuzzle(puzzle) {
    state.activePuzzle = puzzle;
    dom.vignetteEl.textContent = puzzle.vignette ?? "";
    initGameState(state);
    clearFoundGroups(dom);
    renderPaletteChips();
    renderBoard(dom, state, handlers);
    renderStatus(dom, "Pick 4 words.");
  }

  // Controls
  dom.newGameBtn.addEventListener("click", () => startPuzzle(state.activePuzzle));
  dom.shuffleBtn.addEventListener("click", () => { shuffleUnlocked(state); renderBoard(dom, state, handlers); renderStatus(dom, "Shuffled."); });
  dom.clearBtn.addEventListener("click", () => { clearSelection(state); renderBoard(dom, state, handlers); renderStatus(dom, "Selection cleared."); });

  dom.submitBtn.addEventListener("click", () => {
    const res = submitSelection(state);
    if (res.ok && res.group) {
      appendFoundGroupCard(dom, res.group, whimsicalNames[res.group.palette] || res.group.palette);
      const palEntry = state.activePuzzle.palette?.[res.group.palette];
      const last = dom.foundEl.lastElementChild;
      if (last && palEntry?.bg) last.style.background = palEntry.bg;
      if (last && palEntry?.fg) last.style.color = palEntry.fg;
    }
    renderBoard(dom, state, handlers);
    renderStatus(dom, res.message);
  });

  // (chips are now created dynamically in renderPaletteChips)

  dom.hintCategoryBtn.addEventListener("click", () => {
    const res = hintRevealCategory(state);
    if (res.ok && res.group) {
      appendFoundGroupCard(dom, res.group, whimsicalNames[res.group.palette] || res.group.palette);
      const palEntry = state.activePuzzle.palette?.[res.group.palette];
      const last = dom.foundEl.lastElementChild;
      if (last && palEntry?.bg) last.style.background = palEntry.bg;
      if (last && palEntry?.fg) last.style.color = palEntry.fg;
      renderStatus(dom, `Hint: One category is “${res.group.category}”.`);
    } else {
      renderStatus(dom, res.message);
    }
  });
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


