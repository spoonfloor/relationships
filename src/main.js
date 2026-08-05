import { getDom } from "./dom.js";
import { createInitialState } from "./state.js";
import {
  DEBUG_PUZZLE_ID,
  fetchDebugPuzzle,
  fetchPuzzleCatalog,
  hydratePuzzleFromRow,
  isUnpublishedDraftRow,
} from "./puzzleRepository.js";
import { createPuzzleSession } from "./puzzleSession.js";
import { initAppBarMenu } from "./appBar.js";
import {
  initGameState,
  resetGameProgress,
  canSubmitSelection,
  isPuzzleComplete,
  submitSelection,
  solvePuzzle,
  generateDebugGuessHistory,
  shuffleUnlocked,
  hintRevealCategory,
  hintRevealWord,
} from "./game.js";
import { toggleSelection, getSelectionCount } from "./selection.js";
import {
  renderPlayArea,
  renderStatus,
  clearFoundGroups,
  renderGuesses,
} from "./render.js";
import { findGlossaryDefinitions, puzzleHasGlossary } from "./puzzleSchema.js";
import { isGroupColorsAssigned, resolveGroupColors, applyGroupColorsToElement } from "./groupColors.js";
import { alert as showAlert, openModal } from "./modal.js";
import { openSubmitResultsModal } from "./submitResultsModal.js";
import { closeActiveOverlay } from "./overlay.js";
import { openGlossarySheet, commitActiveGlossaryEditor } from "./glossarySheet.js";
import { showToast } from "./toast.js";
import {
  formatStaticUi,
  setDisplayText,
} from "./display.js";
import {
  watchBottomSheet,
  watchCtaRows,
  syncCtaRow,
  syncAppShellHeight,
  syncBottomSheetReserve,
} from "./ctaLayout.js";
import { openPuzzlePicker } from "./puzzlePicker.js";
import { getSavedPuzzleId, saveSelectedPuzzleId } from "./puzzleSelection.js";
import { initPuzzleCompose } from "./puzzleCompose.js";
import { createEmptyPuzzle } from "./puzzleComposeTemplate.js";
import { promptEditPassword } from "./auth.js";
import { initPageLogo, applyLogoSwatches } from "./logoSwatches.js";
import { bindDarkModeSwitch, initColorScheme, onColorSchemeChange } from "./colorScheme.js";

async function bootstrap() {
  initColorScheme();
  watchBottomSheet();
  watchCtaRows();
  const dom = getDom();
  formatStaticUi();

  if (dom.darkModeSwitch instanceof HTMLInputElement) {
    bindDarkModeSwitch(dom.darkModeSwitch);
  }
  await initPageLogo();

  const urlParams = new URLSearchParams(window.location.search);
  const puzzleId = urlParams.get("puzzleId");

  const [catalog, wittyResponsesRaw] = await Promise.all([
    fetchPuzzleCatalog(),
    fetch("./witty_responses.json").then((res) => res.json()),
  ]);
  const wittyResponses = wittyResponsesRaw.repeated_incorrect_guess;

  const session = createPuzzleSession({ catalog });
  const listableIds = new Set(catalog.puzzles.map((entry) => entry.id));
  const draftOnlyRows =
    catalog.rows.filter((row) => !listableIds.has(row.id) && isUnpublishedDraftRow(row));

  for (const entry of catalog.puzzles) {
    const row = catalog.rows.find((item) => item.id === entry.id);
    if (!row) continue;
    session.init(entry.id, {
      published: hydratePuzzleFromRow(row, "published"),
      row,
      num: entry.num,
    });
  }

  for (const row of draftOnlyRows) {
    session.init(row.id, {
      published: hydratePuzzleFromRow(row, "published"),
      row,
      num: row.num,
    });
  }

  dom.puzzleSelect.innerHTML = "";
  for (const p of catalog.puzzles) {
    const opt = document.createElement("option");
    opt.value = p.id;
    setDisplayText(opt, session.getPickerLabel(p.id));
    dom.puzzleSelect.appendChild(opt);
  }

  let initialId;
  if (puzzleId === DEBUG_PUZZLE_ID) {
    initialId = DEBUG_PUZZLE_ID;
  } else if (puzzleId) {
    if (
      !catalog.puzzles.some((entry) => entry.id === puzzleId) &&
      !draftOnlyRows.some((row) => row.id === puzzleId)
    ) {
      renderStatus(dom, `Puzzle with id "${puzzleId}" not found.`);
      return;
    }
    initialId = puzzleId;
  } else {
    const savedId = getSavedPuzzleId();
    initialId =
      savedId &&
      savedId !== DEBUG_PUZZLE_ID &&
      catalog.puzzles.some((entry) => entry.id === savedId)
        ? savedId
        : catalog.defaultId && catalog.puzzles.some((entry) => entry.id === catalog.defaultId)
          ? catalog.defaultId
          : catalog.puzzles[0]?.id;
  }

  let puzzle;
  if (initialId === DEBUG_PUZZLE_ID) {
    const loaded = await fetchDebugPuzzle();
    session.init(DEBUG_PUZZLE_ID, {
      published: loaded.puzzle,
      row: loaded.row,
      num: 0,
    });
    puzzle = loaded.puzzle;
  } else if (initialId) {
    puzzle = session.getPlayable(initialId) ?? hydratePuzzleFromRow(
      draftOnlyRows.find((row) => row.id === initialId) ??
        catalog.rows.find((row) => row.id === initialId),
      "published"
    );
    if (catalog.puzzles.some((entry) => entry.id === initialId)) {
      dom.puzzleSelect.value = initialId;
    }
  } else {
    puzzle = createEmptyPuzzle();
  }

  const state = createInitialState(puzzle);
  initializePage(state, wittyResponses, session, catalog);
  syncAppShellHeight();
  syncBottomSheetReserve();
}

function initializePage(state, wittyResponses, session, catalog) {
  const dom = getDom();
  dom.glossaryTooltip = document.getElementById("glossary-tooltip");
  dom.glossaryBtn = document.getElementById("glossaryBtn");

  dom.glossaryBtn.addEventListener("click", () => {
    state.glossaryEnabled = !state.glossaryEnabled;
    setDisplayText(dom.glossaryBtn, state.glossaryEnabled ? "Glossary: ON" : "Glossary: OFF");
    renderPlayArea(dom, state, handlers);
    hideTooltip();
  });

  function showTooltip(word, definitions, event) {
    dom.glossaryTooltip.replaceChildren();
    const p = document.createElement("p");
    setDisplayText(p, word);
    dom.glossaryTooltip.appendChild(p);
    const ul = document.createElement("ul");
    for (const def of definitions) {
      const li = document.createElement("li");
      setDisplayText(li, def);
      ul.appendChild(li);
    }
    dom.glossaryTooltip.appendChild(ul);
    dom.glossaryTooltip.style.left = `${event.clientX + 10}px`;
    dom.glossaryTooltip.style.top = `${event.clientY + 10}px`;
    dom.glossaryTooltip.style.display = "block";
  }

  function hideTooltip() {
    dom.glossaryTooltip.style.display = "none";
  }

  function syncGlossaryCta(puzzle) {
    if (!dom.glossaryCtaBtn) return;
    dom.glossaryCtaBtn.hidden = !puzzleHasGlossary(puzzle);
    const row = dom.glossaryCtaBtn.parentElement;
    if (row instanceof HTMLElement) {
      syncCtaRow(row);
    }
  }

  function syncPickerOption(id) {
    const opt = dom.puzzleSelect.querySelector(`option[value="${CSS.escape(id)}"]`);
    if (opt) setDisplayText(opt, session.getPickerLabel(id));
  }

  /** @type {{ id: string, puzzle: object } | null} */
  let composeReturnTo = null;

  function registerPersistedDraft(id, draft) {
    state.activePuzzle = draft;
    state.activePuzzle.id = id;
  }

  function addCatalogOption(id) {
    if (dom.puzzleSelect.querySelector(`option[value="${CSS.escape(id)}"]`)) return;
    const opt = document.createElement("option");
    opt.value = id;
    setDisplayText(opt, session.getPickerLabel(id));
    dom.puzzleSelect.appendChild(opt);
  }

  function registerPublishedPuzzle(id) {
    addCatalogOption(id);
    dom.puzzleSelect.value = id;
    syncPickerOption(id);
  }

  function applyPuzzleToUi(puzzle) {
    state.activePuzzle = puzzle;
    setDisplayText(dom.puzzleTitleEl, puzzle.title ?? "");
    setDisplayText(dom.vignetteEl, puzzle.vignette ?? "");
    initGameState(state);
    clearFoundGroups(dom);
    dom.guessesEl.innerHTML = "";
    dom.mostRecentGuessEl.innerHTML = "";
    renderPaletteChips();
    applyLogoSwatches(puzzle.groups);
    syncGlossaryCta(puzzle);
    renderPlayArea(dom, state, handlers);
    updateSubmitBtn();
  }

  function renderPaletteChips() {
    if (!dom.paletteChipsEl) return;
    dom.paletteChipsEl.innerHTML = "";
    for (const group of state.activePuzzle.groups) {
      const btn = document.createElement("button");
      btn.className = "chip";
      btn.type = "button";
      const foundGroup = state.foundGroups.find(
        (g) => g.title === group.title && g.words.length > 0
      );
      setDisplayText(btn, foundGroup ? group.title : "?");
      if (isGroupColorsAssigned(group)) {
        applyGroupColorsToElement(btn, resolveGroupColors(group), { surface: "canvas" });
      }
      dom.paletteChipsEl.appendChild(btn);
    }
  }

  const handlers = {
    onToggleSelect(word) {
      const res = toggleSelection(state, word);
      renderStatus(
        dom,
        res.ok ? `${getSelectionCount(state)} selected.` : res.message,
      );
      renderPlayArea(dom, state, handlers);
      updateSubmitBtn();
    },
    onMouseOverWord(word, event) {
      if (!state.glossaryEnabled) return;
      const definitions = findGlossaryDefinitions(state.activePuzzle, word);
      if (definitions.length > 0) {
        showTooltip(word, definitions, event);
      }
    },
    onMouseOutWord() {
      hideTooltip();
    },
  };

  const puzzleCompose = initPuzzleCompose({
    dom,
    getPuzzle: () => state.activePuzzle,
    setPuzzle(puzzle) {
      state.activePuzzle = puzzle;
    },
    onValidationError(message) {
      showAlert({ title: "Error", message });
    },
    onSaveDraft: async (puzzle, variant) => {
      if (variant === "create") {
        const result = await session.createDraft(puzzle);
        if (!result.ok) {
          return result;
        }
        registerPersistedDraft(result.id, result.draft);
        showToast("Draft saved.");
        return { ok: true, id: result.id };
      }

      const id = getCurrentPuzzleId();
      const result = await session.saveDraft(id, puzzle);
      if (result.ok) {
        showToast("Draft saved.");
        return { ok: true };
      }
      return result;
    },
    onBeforeEnterEdit: async (targetId) => {
      const id = targetId ?? getCurrentPuzzleId();
      const returnId = getCurrentPuzzleId();
      composeReturnTo = {
        id: returnId,
        puzzle:
          session.getPublished(returnId)
            ? structuredClone(session.getPublished(returnId))
            : structuredClone(state.activePuzzle),
      };
      const working = await session.enterEdit(id);
      state.activePuzzle = working;
      setDisplayText(dom.puzzleTitleEl, working.title ?? "");
      setDisplayText(dom.vignetteEl, working.vignette ?? "");
      applyLogoSwatches(working.groups);
      renderStatus(dom, "Editing draft.");
    },
    onEnterCreate: () => {
      const currentId = getCurrentPuzzleId();
      composeReturnTo = {
        id: currentId,
        puzzle: structuredClone(state.activePuzzle),
      };
      state.activePuzzle = puzzleCompose.createEmptyPuzzle();
      setDisplayText(dom.puzzleTitleEl, "");
      setDisplayText(dom.vignetteEl, "");
      applyLogoSwatches(state.activePuzzle.groups);
      renderStatus(dom, "New puzzle.");
    },
    onComposeChange: () => {
      renderPaletteChips();
      applyLogoSwatches(state.activePuzzle.groups);
    },
    onCancelCompose: (variant) => {
      const restore = composeReturnTo?.puzzle;
      const restoreId = composeReturnTo?.id;

      if (variant === "edit" && restoreId && session.isPersistable(restoreId)) {
        session.exitEdit(getCurrentPuzzleId());
      }

      composeReturnTo = null;

      if (restore) {
        state.activePuzzle = restore;
        applyPuzzleToUi(restore);
        renderStatus(dom, "Pick 4–16 words.");
        return;
      }

      renderStatus(dom, "Pick 4–16 words.");
    },
  });

  initAppBarMenu({
    moreBtn: dom.appBarMoreBtn,
    menu: dom.appBarMenu,
    isComposeMode: () => puzzleCompose.isComposeMode(),
  });

  onColorSchemeChange(() => {
    if (state.activePuzzle?.groups) {
      applyLogoSwatches(state.activePuzzle.groups);
    }
    if (puzzleCompose.isComposeMode()) {
      puzzleCompose.refreshSurfaceColors();
    } else {
      renderPlayArea(dom, state, handlers);
    }
  });

  function getCurrentPuzzleId() {
    return state.activePuzzle.id;
  }

  function startPuzzle(puzzle) {
    puzzleCompose.exitComposeMode();
    composeReturnTo = null;
    state.glossaryEnabled = false;
    setDisplayText(dom.glossaryBtn, "Glossary: OFF");
    applyPuzzleToUi(puzzle);
    renderStatus(dom, "Pick 4–16 words.");
    updateSubmitBtn();
  }

  function applyClear() {
    closeActiveOverlay();
    hideTooltip();
    resetGameProgress(state);
    clearFoundGroups(dom);
    dom.guessesEl.innerHTML = "";
    dom.mostRecentGuessEl.innerHTML = "";
    renderPaletteChips();
    renderPlayArea(dom, state, handlers);
    renderGuesses(dom, state.guesses);
    renderStatus(dom, "Pick 4–16 words.");
    updateSubmitBtn();
  }

  dom.newGameBtn.addEventListener("click", () => startPuzzle(state.activePuzzle));
  dom.shuffleBtn.addEventListener("click", () => {
    shuffleUnlocked(state);
    renderPlayArea(dom, state, handlers);
    renderStatus(dom, "Shuffled.");
  });
  dom.clearBtn.addEventListener("click", applyClear);
  dom.glossaryCtaBtn?.addEventListener("click", () => {
    openGlossarySheet(state.activePuzzle);
  });
  dom.glossaryEditBtn?.addEventListener("click", () => {
    if (!puzzleCompose.isComposeMode()) return;
    openGlossarySheet(state.activePuzzle, {
      editable: true,
      onChange: () => syncGlossaryCta(state.activePuzzle),
    });
  });

  let optionHeld = false;

  function updateSubmitBtn() {
    setDisplayText(dom.submitBtn, optionHeld ? "Solve" : "Submit");
    dom.submitBtn.disabled = !(optionHeld || canSubmitSelection(state));
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Alt" && !optionHeld) {
      optionHeld = true;
      updateSubmitBtn();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "Alt") {
      optionHeld = false;
      updateSubmitBtn();
    }
  });

  function handleGameAction(res) {
    const foundGroup = res.group || res.results?.some((chunk) => chunk.group);
    if (res.ok && (foundGroup || res.solved)) {
      renderPaletteChips();
    }
    renderPlayArea(dom, state, handlers);
    renderMostRecentGuess(dom, state.guesses.at(-1));
    const puzzleComplete = isPuzzleComplete(state);
    updateSubmitBtn();
    if (!puzzleComplete) {
      renderGuesses(dom, state.guesses);
    }
    renderStatus(dom, res.message);

    const feedback = res.feedback;
    if (feedback?.mode === "modal") {
      openSubmitResultsModal({
        rows: feedback.rows,
        onClose: () => {
          if (puzzleComplete) {
            showResultsPopup();
          }
        },
      });
      return;
    }

    if (puzzleComplete) {
      showResultsPopup();
    }

    const toastMessage =
      feedback?.mode === "toast"
        ? feedback.toastMessage
        : res.toasts?.[0] ?? res.toastMessage;
    if (toastMessage) {
      showToast(toastMessage);
    }
  }

  function handleDebugSolve() {
    const res = solvePuzzle(state);
    renderPaletteChips();
    renderPlayArea(dom, state, handlers);
    showResultsPopup(generateDebugGuessHistory(state.activePuzzle));
    renderStatus(dom, res.message);
    updateSubmitBtn();
  }

  dom.submitBtn.addEventListener("click", (event) => {
    if (optionHeld || event.altKey) {
      handleDebugSolve();
      return;
    }
    if (!canSubmitSelection(state)) return;
    handleGameAction(submitSelection(state, wittyResponses));
  });

  function showResultsPopup(debugGuesses) {
    const guesses = debugGuesses ?? state.guesses;
    openModal({
      title: "Congratulations!",
      content: (bodyEl) => {
        const summary = document.createElement("p");
        setDisplayText(summary, `You solved the puzzle in ${guesses.length} guesses.`);
        bodyEl.appendChild(summary);

        const guessesEl = document.createElement("div");
        guessesEl.className = "minigrid";
        renderGuesses({ guessesEl }, guesses);
        guessesEl.addEventListener(
          "scroll",
          () => {
            guessesEl.classList.add("has-scrolled");
          },
          { once: true }
        );
        bodyEl.appendChild(guessesEl);
      },
      actions: [{ label: "Okay", variant: "primary" }],
    });
  }

  function renderMostRecentGuess(dom, guess) {
    if (!guess) return;
    renderGuesses({ guessesEl: dom.mostRecentGuessEl }, [guess]);
  }

  dom.hintCategoryBtn.addEventListener("click", () => {
    const res = hintRevealCategory(state);
    if (res.ok && res.group) {
      renderPlayArea(dom, state, handlers);
      renderPaletteChips();
      renderStatus(dom, `Hint: One category is “${res.group.title}”.`);
    } else {
      renderStatus(dom, res.message);
    }
  });

  dom.hintWordBtn.addEventListener("click", () => {
    const res = hintRevealWord(state);
    renderPlayArea(dom, state, handlers);
    renderStatus(dom, res.message);
    updateSubmitBtn();
  });

  function getPuzzleOptions() {
    return [...dom.puzzleSelect.options].map((opt) => ({
      id: opt.value,
      title: opt.textContent ?? opt.value,
    }));
  }

  dom.publishBtn?.addEventListener("click", async () => {
    const id = getCurrentPuzzleId();

    try {
      if (puzzleCompose.isComposeMode()) {
        puzzleCompose.commitAllFields();

        const glossaryCommit = commitActiveGlossaryEditor();
        if (!glossaryCommit.ok) {
          showAlert({ title: "Error", message: glossaryCommit.error });
          return;
        }

        const isNew = !state.activePuzzle.id?.trim();
        const publishError = puzzleCompose.validateComposePublish({ requireId: !isNew });
        if (publishError) {
          showAlert({ title: "Error", message: publishError });
          return;
        }

        if (isNew) {
          const persisted = await session.ensurePersisted(state.activePuzzle);
          if (!persisted.ok) {
            showAlert({ title: "Error", message: persisted.error });
            return;
          }
          if (persisted.created) {
            registerPersistedDraft(persisted.id, persisted.draft);
          } else {
            state.activePuzzle = persisted.draft;
          }
        }
      }

      const publishId = getCurrentPuzzleId();
      const result = await session.publish(
        publishId,
        puzzleCompose.isComposeMode() ? state.activePuzzle : null
      );
      if (!result.ok) {
        showAlert({ title: "Error", message: result.error });
        return;
      }

      if (result.newlyListed) {
        registerPublishedPuzzle(publishId);
      } else {
        syncPickerOption(publishId);
      }
      puzzleCompose.exitComposeMode();
      composeReturnTo = null;
      applyPuzzleToUi(result.published);
      renderStatus(dom, "Pick 4–16 words.");
      showToast("Puzzle published.");
    } catch (err) {
      console.error(err);
      showAlert({ title: "Error", message: err.message });
    }
  });

  async function ensurePuzzleLoaded(id) {
    if (id === DEBUG_PUZZLE_ID) {
      if (session.getPublished(id)) return;
      const loaded = await fetchDebugPuzzle();
      session.init(id, {
        published: loaded.puzzle,
        row: loaded.row,
        num: 0,
      });
      return;
    }

    if (session.getPublished(id)) return;

    const row = catalog.rows.find((item) => item.id === id);
    if (!row) throw new Error(`Puzzle "${id}" not found`);
    const fetched = hydratePuzzleFromRow(row, "published");
    const entry = catalog.puzzles.find((item) => item.id === id);
    session.init(id, { published: fetched, row, num: entry?.num ?? row.num ?? 0 });
  }

  async function selectPuzzleById(id) {
    if (puzzleCompose.isComposeMode()) {
      puzzleCompose.cancelCompose();
    }

    await ensurePuzzleLoaded(id);
    const puzzle = session.getPlayable(id);
    if (!puzzle) throw new Error(`Puzzle "${id}" not found`);

    if (id !== DEBUG_PUZZLE_ID) {
      dom.puzzleSelect.value = id;
      saveSelectedPuzzleId(id);
    }
    startPuzzle(puzzle);
  }

  dom.openDebugPuzzleBtn?.addEventListener("click", () => {
    selectPuzzleById(DEBUG_PUZZLE_ID).catch((e) => {
      console.error(e);
      renderStatus(dom, `Puzzle load error: ${e.message}`);
    });
  });

  dom.choosePuzzleBtn?.addEventListener("click", () => {
    openPuzzlePicker({
      puzzles: getPuzzleOptions(),
      currentId:
        getCurrentPuzzleId() === DEBUG_PUZZLE_ID
          ? dom.puzzleSelect.value
          : getCurrentPuzzleId(),
      onSelect: (id) => {
        selectPuzzleById(id).catch((e) => {
          console.error(e);
          renderStatus(dom, `Puzzle load error: ${e.message}`);
        });
      },
    });
  });

  dom.viewDraftsBtn?.addEventListener("click", () => {
    const drafts = session.getUnpublishedDraftOptions();
    const currentId = drafts.some((entry) => entry.id === getCurrentPuzzleId())
      ? getCurrentPuzzleId()
      : "";

    openPuzzlePicker({
      title: "Drafts",
      emptyMessage: "No unpublished drafts.",
      emptyDismissLabel: "Close",
      listAriaLabel: "Draft puzzles",
      puzzles: drafts,
      currentId,
      onSelect: async (id) => {
        if (puzzleCompose.isComposeMode()) {
          puzzleCompose.cancelCompose();
        }
        await puzzleCompose.beginEdit(id);
      },
    });
  });

  /** @returns {Promise<string[] | null>} */
  function pickPuzzlesToDelete() {
    const sections = session.getDeletablePuzzleSections();
    const currentId = getCurrentPuzzleId();
    const preselectId =
      currentId !== DEBUG_PUZZLE_ID &&
      sections.some((section) => section.puzzles.some((puzzle) => puzzle.id === currentId))
        ? currentId
        : "";

    return new Promise((resolve) => {
      let settled = false;
      const settle = (ids) => {
        if (settled) return;
        settled = true;
        resolve(ids);
      };

      openPuzzlePicker({
        title: "Delete puzzle",
        emptyMessage: "No puzzles to delete.",
        listAriaLabel: "Puzzles to delete",
        sections,
        currentId: preselectId,
        multiple: true,
        primaryLabel: "Delete forever",
        onSelect: (selection) => settle(Array.isArray(selection) ? selection : [selection]),
        onDismiss: () => settle(null),
      });
    });
  }

  /** @param {string[]} ids */
  function confirmDeletePuzzles(ids) {
    const content =
      ids.length === 1
        ? `Permanently delete '${session.getDeletableTitle(ids[0])}'? This action cannot be undone.`
        : `Permanently delete ${ids.length} puzzles? This action cannot be undone.`;

    return new Promise((resolve) => {
      let settled = false;
      const settle = (confirmed) => {
        if (settled) return;
        settled = true;
        resolve(confirmed);
      };

      openModal({
        title: "Delete puzzle",
        content,
        actions: [
          { label: "Cancel", variant: "secondary", onClick: () => settle(false) },
          { label: "Delete forever", variant: "primary", onClick: () => settle(true) },
        ],
        onClose: () => {
          if (!settled) settle(false);
        },
      });
    });
  }

  dom.deletePuzzleBtn?.addEventListener("click", async (event) => {
    event.stopPropagation();

    const ok = await promptEditPassword();
    if (!ok) return;

    const selectedIds = await pickPuzzlesToDelete();
    if (!selectedIds?.length) return;

    const ids = selectedIds.filter(
      (id) => id !== DEBUG_PUZZLE_ID && session.isPersistable(id)
    );
    if (ids.length === 0) {
      showAlert({ title: "Error", message: "This puzzle cannot be deleted." });
      return;
    }

    const confirmed = await confirmDeletePuzzles(ids);
    if (!confirmed) return;

    const currentId = getCurrentPuzzleId();
    const deletingCurrent = ids.includes(currentId);

    if (deletingCurrent && puzzleCompose.isComposeMode()) {
      puzzleCompose.cancelCompose();
    }

    let navigateId = null;
    let deletedCount = 0;

    for (const id of ids) {
      const result = await session.remove(id);
      if (!result.ok) {
        showAlert({ title: "Error", message: result.error });
        break;
      }

      dom.puzzleSelect.querySelector(`option[value="${CSS.escape(id)}"]`)?.remove();
      if (id === currentId) {
        navigateId = result.wasListed
          ? result.nextId
          : composeReturnTo?.id ?? result.nextId;
      }
      deletedCount += 1;
    }

    if (deletedCount === 0) return;

    if (deletingCurrent && navigateId) {
      try {
        await selectPuzzleById(navigateId);
      } catch (e) {
        console.error(e);
        renderStatus(dom, `Puzzle load error: ${e.message}`);
      }
    }

    showToast(deletedCount === 1 ? "Puzzle deleted." : `${deletedCount} puzzles deleted.`);
  });

  dom.puzzleSelect.addEventListener("change", async () => {
    try {
      await selectPuzzleById(dom.puzzleSelect.value);
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
  setDisplayText(dom.statusEl, `Startup error: ${err.message}`);
});
