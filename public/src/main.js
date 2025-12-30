/**
 * @fileoverview Copyright 2025 Ed Korthof and Cristie Henry
 */

import { getDom } from "./dom.js";
import { createInitialState } from "./state.js";
import { loadPuzzle, loadPuzzleIndex } from "./loadPuzzle.js";
import {
  initGameState,
  toggleSelect,
  clearSelection,
  submitSelection,
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

import { createPuzzleUploader } from "./fileUploader.js";
import { validatePuzzle } from "./validation.js";

async function bootstrap() {
  const dom = getDom();
  const urlParams = new URLSearchParams(window.location.search);
  const puzzleId = urlParams.get("puzzleId");
  const uploaderContainer = document.getElementById('uploader-container');

  const [index, wittyResponses] = await Promise.all([
    loadPuzzleIndex("./puzzles/index.json"),
    fetch("./witty_responses.json").then(res => res.json()),
  ]);

  dom.puzzleSelect.innerHTML = "";
  for (const p of index.puzzles) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.label ?? p.id;
    dom.puzzleSelect.appendChild(opt);
  }
  const idToEntry = new Map(index.puzzles.map(p => [p.id, p]));

  const onPuzzleUploaded = (puzzle) => {
    try {
      validatePuzzle(puzzle, 'uploaded file');
      const puzzleId = `~uploaded~${puzzle.id}`;
      
      // Remove previous version if it exists
      const existingOption = dom.puzzleSelect.querySelector(`option[value="${puzzleId}"]`);
      if (existingOption) {
        existingOption.remove();
      }

      const option = document.createElement('option');
      option.value = puzzleId;
      option.textContent = `Uploaded: ${puzzle.id}`;
      dom.puzzleSelect.appendChild(option);
      
      idToEntry.set(puzzleId, puzzle);
      
      dom.puzzleSelect.value = puzzleId;
      dom.puzzleSelect.dispatchEvent(new Event('change'));
    } catch (e) {
      console.error(e);
      renderStatus(dom, `Puzzle validation error: ${e.message}`);
      alert(`Puzzle validation error: ${e.message}`);
    }
  };

  const uploader = createPuzzleUploader(onPuzzleUploaded);
  uploaderContainer.appendChild(uploader);

  let puzzle;
  if (puzzleId) {
    const entry = idToEntry.get(puzzleId);
    if (entry) {
      puzzle = await loadPuzzle(`./puzzles/${entry.file}`);
    } else {
      renderStatus(dom, `Puzzle with id "${puzzleId}" not found.`);
      return;
    }
  } else {
    const initialId = index.defaultId && idToEntry.has(index.defaultId)
      ? index.defaultId
      : index.puzzles[0].id;
    puzzle = await loadPuzzle(`./puzzles/${idToEntry.get(initialId).file}`);
    dom.puzzleSelect.value = initialId;
  }

  const state = createInitialState(puzzle);
  initializePage(state, wittyResponses.repeated_incorrect_guess, idToEntry);
}

function initializePage(state, wittyResponses, idToEntry) {
  const dom = getDom();
  dom.glossaryTooltip = document.getElementById('glossary-tooltip');
  dom.glossaryBtn = document.getElementById('glossaryBtn');

  dom.glossaryBtn.addEventListener('click', () => {
    state.glossaryEnabled = !state.glossaryEnabled;
    dom.glossaryBtn.textContent = state.glossaryEnabled ? 'Glossary: ON' : 'Glossary: OFF';
    renderBoard(dom, state, handlers); // Re-render to attach/detach listeners
    hideTooltip(dom);
  });

  function showTooltip(word, definitions, event) {
    dom.glossaryTooltip.innerHTML = `<p>${word}</p><ul>${definitions.map(def => `<li>${def}</li>`).join('')}</ul>`;
    dom.glossaryTooltip.style.left = `${event.clientX + 10}px`;
    dom.glossaryTooltip.style.top = `${event.clientY + 10}px`;
    dom.glossaryTooltip.style.display = 'block';
  }

  function hideTooltip(dom) {
    dom.glossaryTooltip.style.display = 'none';
  }

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
    onMouseOverWord(word, event) {
      if (state.glossaryEnabled && state.activePuzzle.glossary && state.activePuzzle.glossary[word]) {
        showTooltip(word, state.activePuzzle.glossary[word], event);
      }
    },
    onMouseOutWord() {
      hideTooltip(dom);
    }
  };

  function startPuzzle(puzzle) {
    state.activePuzzle = puzzle;
    state.glossaryEnabled = false; // Reset glossary state
    dom.glossaryBtn.textContent = 'Glossary: OFF'; // Reset button text
    dom.vignetteEl.textContent = puzzle.vignette ?? "";
    initGameState(state);
    clearFoundGroups(dom);
    dom.guessesEl.innerHTML = "";
    dom.mostRecentGuessEl.innerHTML = "";
    renderPaletteChips();
    renderBoard(dom, state, handlers);
    renderStatus(dom, "Pick 4 words.");
  }

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
    const res = submitSelection(state, wittyResponses);
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
    if (state.boardWords.filter(wordItem => wordItem.lockedPalette !== null).length === 16) {
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

  dom.puzzleSelect.addEventListener("change", async () => {
    try {
      const id = dom.puzzleSelect.value;
      const entry = idToEntry.get(id);
      let puzzle;
      if (id.startsWith('~uploaded~')) {
        puzzle = entry;
      } else {
        puzzle = await loadPuzzle(`./puzzles/${entry.file}`);
      }
      startPuzzle(puzzle);
    } catch (e) {
      console.error(e);
      renderStatus(dom, `Puzzle load error: ${e.message}`);
    }
  });

  startPuzzle(state.activePuzzle);
}
bootstrap().catch(err => {
  const dom = getDom();
  console.error(err);
  dom.statusEl.textContent = `Startup error: ${err.message}`;
});


