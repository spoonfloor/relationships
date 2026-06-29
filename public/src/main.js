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
import { findWordEntry } from "./puzzleSchema.js";

import { createPuzzleUploader } from "./fileUploader.js";
import { validatePuzzle } from "./validation.js";

async function bootstrap() {
  const dom = getDom();
  const urlParams = new URLSearchParams(window.location.search);
  const puzzleId = urlParams.get("puzzleId");
  const uploaderContainer = document.getElementById("uploader-container");

  const [index, wittyResponses] = await Promise.all([
    loadPuzzleIndex("./puzzles/index.json"),
    fetch("./witty_responses.json").then((res) => res.json()),
  ]);

  const puzzleCache = new Map();
  await Promise.all(
    index.puzzles.map(async (entry) => {
      const puzzle = await loadPuzzle(`./puzzles/${entry.file}`);
      puzzleCache.set(entry.id, puzzle);
    })
  );

  dom.puzzleSelect.innerHTML = "";
  for (const p of index.puzzles) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = puzzleCache.get(p.id)?.title ?? p.id;
    dom.puzzleSelect.appendChild(opt);
  }
  const idToEntry = new Map(index.puzzles.map((p) => [p.id, p]));

  const onPuzzleUploaded = (puzzle) => {
    try {
      validatePuzzle(puzzle, "uploaded file");
      const uploadedId = `~uploaded~${puzzle.id}`;

      const existingOption = dom.puzzleSelect.querySelector(`option[value="${uploadedId}"]`);
      if (existingOption) {
        existingOption.remove();
      }

      const option = document.createElement("option");
      option.value = uploadedId;
      option.textContent = `Uploaded: ${puzzle.title ?? puzzle.id}`;
      dom.puzzleSelect.appendChild(option);

      idToEntry.set(uploadedId, puzzle);

      dom.puzzleSelect.value = uploadedId;
      dom.puzzleSelect.dispatchEvent(new Event("change"));
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
    if (puzzleCache.has(puzzleId)) {
      puzzle = puzzleCache.get(puzzleId);
    } else {
      renderStatus(dom, `Puzzle with id "${puzzleId}" not found.`);
      return;
    }
  } else {
    const initialId =
      index.defaultId && idToEntry.has(index.defaultId)
        ? index.defaultId
        : index.puzzles[0].id;
    puzzle = puzzleCache.get(initialId);
    dom.puzzleSelect.value = initialId;
  }

  const state = createInitialState(puzzle);
  initializePage(state, wittyResponses.repeated_incorrect_guess, idToEntry, puzzleCache);
}

function initializePage(state, wittyResponses, idToEntry, puzzleCache) {
  const dom = getDom();
  dom.glossaryTooltip = document.getElementById("glossary-tooltip");
  dom.glossaryBtn = document.getElementById("glossaryBtn");

  dom.glossaryBtn.addEventListener("click", () => {
    state.glossaryEnabled = !state.glossaryEnabled;
    dom.glossaryBtn.textContent = state.glossaryEnabled ? "Glossary: ON" : "Glossary: OFF";
    renderBoard(dom, state, handlers);
    hideTooltip();
  });

  function showTooltip(word, definitions, event) {
    dom.glossaryTooltip.innerHTML = `<p>${word}</p><ul>${definitions.map((def) => `<li>${def}</li>`).join("")}</ul>`;
    dom.glossaryTooltip.style.left = `${event.clientX + 10}px`;
    dom.glossaryTooltip.style.top = `${event.clientY + 10}px`;
    dom.glossaryTooltip.style.display = "block";
  }

  function hideTooltip() {
    dom.glossaryTooltip.style.display = "none";
  }

  function renderPaletteChips() {
    if (!dom.paletteChipsEl) return;
    dom.paletteChipsEl.innerHTML = "";
    for (const group of state.activePuzzle.groups) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      const foundGroup = state.foundGroups.find((g) => g.title === group.title);
      btn.textContent = foundGroup ? group.title : "?";
      if (group.colors?.bg) btn.style.background = group.colors.bg;
      if (group.colors?.text) btn.style.color = group.colors.text;
      dom.paletteChipsEl.appendChild(btn);
    }
  }

  function renderAllFoundGroups() {
    clearFoundGroups(dom);
    for (const group of state.foundGroups) {
      appendFoundGroupCard(dom, group, group.title, group.colors);
    }
  }

  const handlers = {
    onToggleSelect(word) {
      const res = toggleSelect(state, word);
      renderStatus(dom, res.ok ? `${state.selected.size} selected.` : res.message);
      renderBoard(dom, state, handlers);
    },
    onMouseOverWord(word, event) {
      if (!state.glossaryEnabled) return;
      const entry = findWordEntry(state.activePuzzle, word);
      const definitions = entry?.definitions ?? [];
      if (definitions.length > 0) {
        showTooltip(word, definitions, event);
      }
    },
    onMouseOutWord() {
      hideTooltip();
    },
  };

  function startPuzzle(puzzle) {
    state.activePuzzle = puzzle;
    state.glossaryEnabled = false;
    dom.glossaryBtn.textContent = "Glossary: OFF";
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
      renderAllFoundGroups();
      renderPaletteChips();
    }
    renderBoard(dom, state, handlers);
    renderMostRecentGuess(dom, state.guesses.at(-1));
    if (state.boardWords.filter((wordItem) => wordItem.lockedGroupIndex != null).length === 16) {
      showResultsPopup();
    } else {
      renderGuesses(dom, state.guesses);
    }
    renderStatus(dom, res.message);
  });

  function showResultsPopup() {
    dom.resultsNumGuessesEl.textContent = state.guesses.length;
    renderGuesses({ guessesEl: dom.resultsGuessesEl }, state.guesses);
    dom.resultsPopupEl.style.display = "flex";
  }

  dom.resultsCloseBtn.addEventListener("click", () => {
    dom.resultsPopupEl.style.display = "none";
  });

  function renderMostRecentGuess(dom, guess) {
    if (!guess) return;
    renderGuesses({ guessesEl: dom.mostRecentGuessEl }, [guess]);
  }

  dom.hintCategoryBtn.addEventListener("click", () => {
    const res = hintRevealCategory(state);
    if (res.ok && res.group) {
      appendFoundGroupCard(dom, res.group, res.group.title, res.group.colors);
      renderPaletteChips();
      renderStatus(dom, `Hint: One category is “${res.group.title}”.`);
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
      let puzzle;
      if (id.startsWith("~uploaded~")) {
        puzzle = idToEntry.get(id);
      } else if (puzzleCache.has(id)) {
        puzzle = puzzleCache.get(id);
      } else {
        const entry = idToEntry.get(id);
        puzzle = await loadPuzzle(`./puzzles/${entry.file}`);
        puzzleCache.set(id, puzzle);
      }
      startPuzzle(puzzle);
    } catch (e) {
      console.error(e);
      renderStatus(dom, `Puzzle load error: ${e.message}`);
    }
  });

  startPuzzle(state.activePuzzle);
}

bootstrap().catch((err) => {
  const dom = getDom();
  console.error(err);
  dom.statusEl.textContent = `Startup error: ${err.message}`;
});
