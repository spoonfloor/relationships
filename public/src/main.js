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
  renderGuesses,
} from "./render.js";

const dom = getDom();

async function bootstrap() {

  const [index, wittyResponses] = await Promise.all([

    loadPuzzleIndex("./puzzles/index.json"),

    fetch("./witty_responses.json").then(res => res.json()),

  ]);



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



  function renderPaletteChips() {

    const pal = state.activePuzzle.palette || {};

    dom.paletteChipsEl.innerHTML = "";

    for (const [palette, entry] of Object.entries(pal)) {

      const btn = document.createElement("button");

      btn.className = "chip";

      btn.type = "button";



      const foundGroup = state.foundGroups.find(g => g.palette === palette);

      if (foundGroup) {

        btn.textContent = foundGroup.category;

      } else {

        btn.textContent = entry.name ?? palette.toUpperCase();

      }



      if (entry.bg) btn.style.background = entry.bg;

      if (entry.fg) btn.style.color = entry.fg;

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

  dom.shuffleBtn.addEventListener("click", () => {

    shuffleUnlocked(state);

    renderBoard(dom, state, handlers);

    renderStatus(dom, "Shuffled.");

  });

  dom.clearBtn.addEventListener("click", () => {

    clearSelection(state);

    renderBoard(dom, state, handlers);

    renderStatus(dom, "Selection cleared.");

  });



  dom.submitBtn.addEventListener("click", () => {

    const res = submitSelection(state, wittyResponses.repeated_incorrect_guess);

    if (res.ok && res.group) {

      clearFoundGroups(dom);

      for (const group of state.foundGroups) {

        const palEntry = state.activePuzzle.palette?.[group.palette];

        const displayName = group.category;

        appendFoundGroupCard(dom, group, displayName);

        const last = dom.foundEl.lastElementChild;

        if (last && palEntry?.bg) last.style.background = palEntry.bg;

        if (last && palEntry?.fg) last.style.color = palEntry.fg;

      }

      renderPaletteChips();

    }

        renderBoard(dom, state, handlers);

        renderMostRecentGuess(dom, state.guesses.at(-1), state.activePuzzle.palette);

                if (state.foundGroups.length === 4) {

                  showResultsPopup();

                } else {

                  renderGuesses(dom, state.guesses, state.activePuzzle.palette);

                }

                renderStatus(dom, res.message);

              });

        

              function showResultsPopup() {

                dom.resultsNumGuessesEl.textContent = state.guesses.length;

                renderGuesses({ guessesEl: dom.resultsGuessesEl }, state.guesses, state.activePuzzle.palette);

                dom.resultsPopupEl.style.display = "flex";

              }

        

              dom.resultsCloseBtn.addEventListener("click", () => {

                dom.resultsPopupEl.style.display = "none";

              });

    

      function renderMostRecentGuess(dom, guess, palette) {

        if (!guess) return;

        const row = document.createElement("div");

        row.className = "guess-row";

        for (const word of guess.words) {

          const box = document.createElement("div");

          box.className = "guess-box";

          const palEntry = palette[word.palette];

          if (palEntry?.bg) {

            box.style.backgroundColor = palEntry.bg;

          }

          row.appendChild(box);

        }

        dom.mostRecentGuessEl.innerHTML = "";

        dom.mostRecentGuessEl.appendChild(row);

      }



  // (chips are now created dynamically in renderPaletteChips)



  dom.hintCategoryBtn.addEventListener("click", () => {

    const res = hintRevealCategory(state);

    if (res.ok && res.group) {

      appendFoundGroupCard(dom, res.group, res.group.category);

      const palEntry = state.activePuzzle.palette?.[res.group.palette];

      const last = dom.foundEl.lastElementChild;

      if (last && palEntry?.bg) last.style.background = palEntry.bg;

      if (last && palEntry?.fg) last.style.color = palEntry.fg;

      renderPaletteChips();

      renderStatus(dom, `Hint: One category is “${res.group.category}”.`);

    } else {

      renderStatus(dom, res.message);

    }

  });

  dom.hintWordBtn.addEventListener("click", () => {

    const res = hintRevealWord(state);

    renderBoard(dom, state, handlers);

    renderStatus(dom, res.message);

  });

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


