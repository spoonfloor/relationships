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
  canSubmitSelection,
  canShuffle,
  canUseClearCta,
  isPuzzleComplete,
  isPuzzleAtZeroState,
  submitSelection,
  shuffleUnlocked,
  hintRevealCategory,
  hintRevealWord,
} from "./game.js";
import { toggleSelection, getSelectionCount, clearSelection } from "./selection.js";
import {
  renderPlayArea,
  renderStatus,
  clearPlaySurface,
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
  setCtaAvailability,
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

  const catalog = await fetchPuzzleCatalog();

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
  initializePage(state, session, catalog);
  syncAppShellHeight();
  syncBottomSheetReserve();
}

function initializePage(state, session, catalog) {
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

  /** @returns {Promise<boolean>} */
  function confirmDiscardChanges() {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (confirmed) => {
        if (settled) return;
        settled = true;
        resolve(confirmed);
      };

      openModal({
        title: "Discard changes",
        content:
          "This puzzle has unsaved changes. Do you want to permanently discard those changes?",
        actions: [
          { label: "Cancel", variant: "secondary", onClick: () => settle(false) },
          { label: "Discard", variant: "primary", onClick: () => settle(true) },
        ],
        onClose: () => {
          if (!settled) settle(false);
        },
      });
    });
  }

  function registerPersistedDraft(id, draft) {
    state.activePuzzle = draft;
    state.activePuzzle.id = id;
  }

  function syncCatalogSelect() {
    const selected = dom.puzzleSelect.value;
    dom.puzzleSelect.innerHTML = "";
    for (const p of catalog.puzzles) {
      const opt = document.createElement("option");
      opt.value = p.id;
      setDisplayText(opt, session.getPickerLabel(p.id));
      dom.puzzleSelect.appendChild(opt);
    }
    if (catalog.puzzles.some((entry) => entry.id === selected)) {
      dom.puzzleSelect.value = selected;
    }
  }

  function addCatalogOption(id) {
    if (!catalog.puzzles.some((entry) => entry.id === id)) return;
    syncCatalogSelect();
  }

  function registerPublishedPuzzle(id) {
    addCatalogOption(id);
    dom.puzzleSelect.value = id;
    syncPickerOption(id);
  }

  function resetPlaySession(puzzle) {
    state.activePuzzle = puzzle;
    initGameState(state);
    setDisplayText(dom.puzzleTitleEl, puzzle.title ?? "");
    setDisplayText(dom.vignetteEl, puzzle.vignette ?? "");
    applyLogoSwatches(puzzle.groups);
    syncGlossaryCta(puzzle);
    renderPaletteChips();
    syncPlayControls();
  }

  function renderPlaySession() {
    clearPlaySurface(dom);
    renderPlayArea(dom, state, handlers);
  }

  function applyPuzzleToUi(puzzle) {
    resetPlaySession(puzzle);
    renderPlaySession();
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
      syncPlayControls();
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
      resetPlaySession(working);
      clearPlaySurface(dom);
      renderStatus(dom, "Editing draft.");
    },
    onEnterCreate: ({ switching = false } = {}) => {
      if (!switching) {
        const currentId = getCurrentPuzzleId();
        composeReturnTo = {
          id: currentId,
          puzzle: structuredClone(state.activePuzzle),
        };
      }
      resetPlaySession(puzzleCompose.createEmptyPuzzle());
      clearPlaySurface(dom);
      renderStatus(dom, "New puzzle.");
    },
    onComposeChange: () => {
      renderPaletteChips();
      applyLogoSwatches(state.activePuzzle.groups);
    },
    getPublishBaseline: () => {
      const id = state.activePuzzle?.id?.trim();
      if (id) {
        const published = session.getPublished(id);
        if (published) return published;
      }
      return createEmptyPuzzle();
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
    onConfirmDiscard: confirmDiscardChanges,
  });

  initAppBarMenu({
    moreBtn: dom.appBarMoreBtn,
    menu: dom.appBarMenu,
    isComposeMode: () => puzzleCompose.isComposeMode(),
    syncMenuItemAvailability: syncResetMenuItem,
  });

  function syncResetMenuItem() {
    if (!dom.resetPuzzleBtn) return;
    const unavailable =
      puzzleCompose.isComposeMode() || isPuzzleAtZeroState(state);
    dom.resetPuzzleBtn.disabled = unavailable;
    dom.resetPuzzleBtn.toggleAttribute("aria-disabled", unavailable);
  }

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

  let playSessionGeneration = 0;

  function endPlayMoment({ closeOverlays = true } = {}) {
    playSessionGeneration += 1;
    cancelWinModalTimer();
    if (closeOverlays) closeActiveOverlay();
    hideTooltip();
  }

  function startPuzzle(puzzle) {
    endPlayMoment();
    puzzleCompose.exitComposeMode();
    composeReturnTo = null;
    state.glossaryEnabled = false;
    setDisplayText(dom.glossaryBtn, "Glossary: OFF");
    applyPuzzleToUi(puzzle);
    renderStatus(dom, "Pick 4–16 words.");
    syncPlayControls();
  }

  function applyClear() {
    cancelWinModalTimer();
    closeActiveOverlay();
    hideTooltip();
    clearSelection(state);
    renderPlayArea(dom, state, handlers);
    renderStatus(dom, "Pick 4–16 words.");
    syncPlayControls();
  }

  async function applyResetPlaySession() {
    if (puzzleCompose.isComposeMode() || isPuzzleAtZeroState(state)) return;
    if (!isPuzzleComplete(state)) {
      const confirmed = await confirmResetPuzzle();
      if (!confirmed) return;
    }
    startPuzzle(state.activePuzzle);
  }

  dom.newGameBtn.addEventListener("click", () => startPuzzle(state.activePuzzle));
  dom.shuffleBtn.addEventListener("click", () => {
    shuffleUnlocked(state);
    renderPlayArea(dom, state, handlers);
    renderStatus(dom, "Shuffled.");
  });
  dom.clearBtn.addEventListener("click", () => {
    if (isPuzzleComplete(state)) {
      applyResetPlaySession();
      return;
    }
    applyClear();
  });
  dom.glossaryCtaBtn?.addEventListener("click", () => {
    openGlossarySheet(state.activePuzzle);
  });
  dom.glossaryEditBtn?.addEventListener("click", () => {
    if (!puzzleCompose.isComposeMode()) return;
    openGlossarySheet(state.activePuzzle, {
      editable: true,
      onChange: () => {
        syncGlossaryCta(state.activePuzzle);
        puzzleCompose.syncComposeControls();
      },
    });
  });

  function syncPlayControls() {
    const puzzleComplete = isPuzzleComplete(state);
    setDisplayText(dom.submitBtn, "Submit");
    setCtaAvailability(dom.submitBtn, canSubmitSelection(state));
    setCtaAvailability(dom.shuffleBtn, canShuffle(state));
    setDisplayText(dom.clearBtn, puzzleComplete ? "Reset" : "Clear");
    setCtaAvailability(dom.clearBtn, canUseClearCta(state));
  }

  function handleGameAction(res) {
    const foundGroup = res.group || res.results?.some((chunk) => chunk.group);
    if (res.ok && (foundGroup || res.solved)) {
      renderPaletteChips();
    }
    renderPlayArea(dom, state, handlers);
    renderMostRecentGuess(dom, state.guesses.at(-1));
    const puzzleComplete = isPuzzleComplete(state);
    syncPlayControls();
    if (!puzzleComplete) {
      renderGuesses(dom, state.guesses);
    }
    renderStatus(dom, res.message);

    const feedback = res.feedback;
    if (feedback?.mode === "modal") {
      openSubmitResultsModal({
        rows: feedback.rows,
        onClose: () => {
          if (isPuzzleComplete(state)) {
            showResultsPopup();
          }
        },
      });
      return;
    }

    if (puzzleComplete) {
      showResultsPopup();
    }
  }

  dom.submitBtn.addEventListener("click", () => {
    if (!canSubmitSelection(state)) return;
    handleGameAction(submitSelection(state));
  });

  const WIN_MODAL_DELAY_MS = 600;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let winModalTimer = null;

  function cancelWinModalTimer() {
    if (winModalTimer == null) return;
    window.clearTimeout(winModalTimer);
    winModalTimer = null;
  }

  function showResultsPopup() {
    cancelWinModalTimer();
    const generation = playSessionGeneration;
    winModalTimer = window.setTimeout(() => {
      winModalTimer = null;
      if (generation !== playSessionGeneration) return;
      if (!isPuzzleComplete(state)) return;
      const guesses = state.guesses;
      openModal({
        title: "Congratulations!",
        content: (bodyEl) => {
          const summary = document.createElement("p");
          setDisplayText(summary, `You solved the puzzle in ${guesses.length} guesses.`);
          bodyEl.appendChild(summary);

          const guessesEl = document.createElement("div");
          guessesEl.className = "minigrid";
          renderGuesses({ guessesEl }, guesses);
          bodyEl.appendChild(guessesEl);
        },
        actions: [{ label: "Okay", variant: "primary" }],
      });
    }, WIN_MODAL_DELAY_MS);
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
      syncPlayControls();
    } else {
      renderStatus(dom, res.message);
    }
  });

  dom.hintWordBtn.addEventListener("click", () => {
    const res = hintRevealWord(state);
    renderPlayArea(dom, state, handlers);
    renderStatus(dom, res.message);
    syncPlayControls();
  });

  function getPuzzleOptions() {
    return catalog.puzzles.map((entry) => ({
      id: entry.id,
      title: session.getPickerLabel(entry.id),
    }));
  }

  dom.publishBtn?.addEventListener("click", async () => {
    if (dom.publishBtn?.disabled) return;
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

      const publishedId = result.published.id;
      if (result.newlyListed) {
        registerPublishedPuzzle(publishedId);
      } else {
        syncPickerOption(publishedId);
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
      const closed = await puzzleCompose.cancelCompose();
      if (!closed) return;
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

  dom.resetPuzzleBtn?.addEventListener("click", () => {
    applyResetPlaySession();
  });

  dom.viewDraftsBtn?.addEventListener("click", () => {
    const drafts = session.getSavedDraftOptions();
    const currentId = drafts.some((entry) => entry.id === getCurrentPuzzleId())
      ? getCurrentPuzzleId()
      : "";

    openPuzzlePicker({
      title: "Drafts",
      emptyMessage: "No saved drafts.",
      emptyDismissLabel: "Close",
      listAriaLabel: "Draft puzzles",
      puzzles: drafts,
      currentId,
      onSelect: async (id) => {
        if (puzzleCompose.isComposeMode()) {
          const closed = await puzzleCompose.cancelCompose();
          if (!closed) return;
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

  /** @returns {Promise<boolean>} */
  function confirmResetPuzzle() {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (confirmed) => {
        if (settled) return;
        settled = true;
        resolve(confirmed);
      };

      openModal({
        title: "Reset puzzle",
        content:
          "Are you sure you want to start over from beginning? The puzzle will be reset and all your progress will be lost.",
        actions: [
          { label: "Cancel", variant: "secondary", onClick: () => settle(false) },
          { label: "Reset", variant: "primary", onClick: () => settle(true) },
        ],
        onClose: () => {
          if (!settled) settle(false);
        },
      });
    });
  }

  /** @param {string[]} pickerIds */
  function confirmDeletePuzzles(pickerIds) {
    const draftCount = pickerIds.filter(
      (pickerId) => session.resolveDeleteTarget(pickerId).kind === "draft"
    ).length;
    const publishedCount = pickerIds.length - draftCount;

    let content;
    if (pickerIds.length === 1) {
      const target = session.resolveDeleteTarget(pickerIds[0]);
      const title = session.getDeletableTitle(pickerIds[0]);
      content =
        target.kind === "draft"
          ? `Delete draft '${title}'? The published puzzle will not be changed.`
          : `Permanently delete '${title}'? This action cannot be undone.`;
    } else if (draftCount > 0 && publishedCount > 0) {
      content = `Delete ${draftCount} draft${draftCount === 1 ? "" : "s"} and permanently delete ${publishedCount} published puzzle${publishedCount === 1 ? "" : "s"}? Published puzzles selected for deletion cannot be undone.`;
    } else if (draftCount > 0) {
      content = `Delete ${draftCount} draft${draftCount === 1 ? "" : "s"}? Published puzzles will not be changed.`;
    } else {
      content = `Permanently delete ${publishedCount} puzzle${publishedCount === 1 ? "" : "s"}? This action cannot be undone.`;
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (confirmed) => {
        if (settled) return;
        settled = true;
        resolve(confirmed);
      };

      openModal({
        title: "Delete",
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

    const pickerIds = selectedIds.filter((pickerId) => {
      if (pickerId === DEBUG_PUZZLE_ID) return false;
      const { id } = session.resolveDeleteTarget(pickerId);
      return session.isPersistable(id);
    });
    if (pickerIds.length === 0) {
      showAlert({ title: "Error", message: "This puzzle cannot be deleted." });
      return;
    }

    const confirmed = await confirmDeletePuzzles(pickerIds);
    if (!confirmed) return;

    const currentId = getCurrentPuzzleId();
    const deletingCurrentPublished = pickerIds.some((pickerId) => {
      const target = session.resolveDeleteTarget(pickerId);
      return target.kind === "published" && target.id === currentId;
    });
    const deletingCurrentDraft = pickerIds.some((pickerId) => {
      const target = session.resolveDeleteTarget(pickerId);
      return target.kind === "draft" && target.id === currentId;
    });

    if ((deletingCurrentPublished || deletingCurrentDraft) && puzzleCompose.isComposeMode()) {
      await puzzleCompose.cancelCompose({ force: true });
    }

    let navigateId = null;
    let deletedDraftCount = 0;
    let deletedPublishedCount = 0;

    for (const pickerId of pickerIds) {
      const target = session.resolveDeleteTarget(pickerId);
      const result =
        target.kind === "draft"
          ? await session.removeDraft(target.id)
          : await session.removePublished(target.id);
      if (!result.ok) {
        showAlert({ title: "Error", message: result.error });
        break;
      }

      if (target.kind === "published") {
        dom.puzzleSelect.querySelector(`option[value="${CSS.escape(target.id)}"]`)?.remove();
        deletedPublishedCount += 1;
        if (target.id === currentId) {
          navigateId = result.nextId;
        }
      } else {
        deletedDraftCount += 1;
        if (target.id === currentId) {
          if (result.draftOnly) {
            navigateId = composeReturnTo?.id ?? result.nextId;
          } else if (session.getPublished(target.id)) {
            applyPuzzleToUi(session.getPublished(target.id));
            renderStatus(dom, "Pick 4–16 words.");
          }
        }
      }
    }

    if (deletedDraftCount === 0 && deletedPublishedCount === 0) return;

    if (deletingCurrentPublished && navigateId) {
      try {
        await selectPuzzleById(navigateId);
      } catch (e) {
        console.error(e);
        renderStatus(dom, `Puzzle load error: ${e.message}`);
      }
    } else if (deletingCurrentDraft && navigateId) {
      try {
        await selectPuzzleById(navigateId);
      } catch (e) {
        console.error(e);
        renderStatus(dom, `Puzzle load error: ${e.message}`);
      }
    }

    if (deletedDraftCount > 0 && deletedPublishedCount > 0) {
      showToast(`${deletedDraftCount} draft${deletedDraftCount === 1 ? "" : "s"} and ${deletedPublishedCount} puzzle${deletedPublishedCount === 1 ? "" : "s"} deleted.`);
    } else if (deletedDraftCount > 0) {
      showToast(deletedDraftCount === 1 ? "Draft deleted." : `${deletedDraftCount} drafts deleted.`);
    } else {
      showToast(
        deletedPublishedCount === 1
          ? "Puzzle deleted."
          : `${deletedPublishedCount} puzzles deleted.`
      );
    }
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
