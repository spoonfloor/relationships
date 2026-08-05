import { bindEditableField } from "./editableField.js";
import { observeTileBoard } from "./display.js";
import { syncBottomSheetReserve, setCtaAvailability } from "./ctaLayout.js";
import { promptEditPassword } from "./auth.js";
import { openColorPaletteModal } from "./colorPaletteModal.js";
import {
  applyGroupColorsToElement,
  isGroupColorsAssigned,
  resolveGroupColors,
  setGroupColors,
} from "./groupColors.js";
import {
  COMPOSE_PLACEHOLDERS,
  createEmptyPuzzle,
  groupTitlePlaceholder,
  isWordPlaceholderValue,
  wordFieldLabel,
  wordPlaceholder,
} from "./puzzleComposeTemplate.js";
import {
  normalizePuzzle,
  normalizedPuzzleSnapshot,
  puzzlesEquivalent,
  validateComposePublish,
} from "./puzzleNormalize.js";
import { commitActiveGlossaryEditor } from "./glossarySheet.js";

/** @typedef {'create' | 'edit'} ComposeVariant */

/**
 * @param {{
 *   dom: {
 *     puzzleTitleEl: HTMLElement | null,
 *     vignetteEl: HTMLElement,
 *     boardEl: HTMLElement,
 *     ctaStackPlay: HTMLElement,
 *     ctaStackEdit: HTMLElement,
 *     saveBtn: HTMLButtonElement,
 *     publishBtn: HTMLButtonElement | null,
 *     cancelEditBtn: HTMLButtonElement,
 *     editPuzzleBtn: HTMLButtonElement | null,
 *     addPuzzleBtn: HTMLButtonElement | null,
 *   },
 *   getPuzzle: () => object,
 *   setPuzzle: (puzzle: object) => void,
 *   onValidationError: (message: string) => void,
 *   onSaveDraft?: (puzzle: object, variant: ComposeVariant) => Promise<{ ok: boolean, error?: string, id?: string } | void>,
 *   onBeforeEnterEdit?: (targetId?: string) => Promise<void>,
 *   onEnterCreate?: (options?: { switching?: boolean }) => void,
 *   onCancelCompose?: (variant: ComposeVariant) => void,
 *   onConfirmDiscard?: () => Promise<boolean>,
 *   onComposeChange?: () => void,
 *   getPublishBaseline?: () => object,
 * }} options
 */
export function initPuzzleCompose({
  dom,
  getPuzzle,
  setPuzzle,
  onValidationError,
  onSaveDraft,
  onBeforeEnterEdit,
  onEnterCreate,
  onCancelCompose,
  onConfirmDiscard,
  onComposeChange,
  getPublishBaseline,
}) {
  const { puzzleTitleEl, vignetteEl, boardEl, ctaStackPlay, ctaStackEdit } = dom;
  const titleWrap =
    puzzleTitleEl instanceof HTMLElement
      ? puzzleTitleEl.closest(".puzzle-title-wrap")
      : null;
  if (puzzleTitleEl && !(titleWrap instanceof HTMLElement)) {
    throw new Error("puzzle-title must be wrapped in .puzzle-title-wrap");
  }
  const vignetteWrap = vignetteEl.closest(".vignette-wrap");
  if (!(vignetteWrap instanceof HTMLElement)) {
    throw new Error("vignette must be wrapped in .vignette-wrap");
  }
  const puzzleStack = boardEl.closest(".puzzle-stack");
  if (!(puzzleStack instanceof HTMLElement)) {
    throw new Error("board must be wrapped in .puzzle-stack");
  }
  const playAreaEl = boardEl.closest(".play-area");
  if (!(playAreaEl instanceof HTMLElement)) {
    throw new Error("board must be wrapped in .play-area");
  }

  /** @type {ComposeVariant | null} */
  let composeVariant = null;
  /** @type {object | null} */
  let composeDraftBaseline = null;
  /** @type {object | null} */
  let composePublishBaseline = null;
  /** @type {import("./editableField.js").ReturnType<typeof bindEditableField>[]} */
  let fieldControllers = [];

  function isComposeMode() {
    return composeVariant != null;
  }

  function isActive() {
    return isComposeMode();
  }

  function setDraftBaseline() {
    composeDraftBaseline = normalizedPuzzleSnapshot(getPuzzle());
  }

  function setPublishBaseline() {
    const source = getPublishBaseline?.() ?? getPuzzle();
    composePublishBaseline = normalizedPuzzleSnapshot(source);
  }

  function setComposeBaselines() {
    setDraftBaseline();
    setPublishBaseline();
  }

  function hasDraftChanges() {
    if (!composeDraftBaseline) return false;
    return !puzzlesEquivalent(getPuzzle(), composeDraftBaseline);
  }

  function hasPublishChanges() {
    if (!composePublishBaseline) return false;
    return !puzzlesEquivalent(getPuzzle(), composePublishBaseline);
  }

  function syncComposeControls() {
    if (!composeVariant) return;
    setCtaAvailability(dom.saveBtn, hasDraftChanges());
    setCtaAvailability(dom.publishBtn, hasPublishChanges());
  }

  function notifyChange() {
    syncComposeWordColors();
    syncComposeControls();
    onComposeChange?.();
  }

  function syncComposeWordColors() {
    if (!composeVariant) return;
    const groupBlocks = playAreaEl.querySelectorAll(":scope > .compose-group");
    groupBlocks.forEach((block, gi) => {
      const group = getPuzzle().groups[gi];
      const colors = isGroupColorsAssigned(group) ? resolveGroupColors(group) : null;
      const hasColors = colors != null;
      for (const wordEl of block.querySelectorAll(".word.compose-word")) {
        if (!(wordEl instanceof HTMLElement)) continue;
        const isFocused = wordEl.classList.contains("editable-field--focused");
        wordEl.classList.toggle("compose-word--has-colors", hasColors);
        applyGroupColorsToElement(wordEl, colors, { paintFill: !isFocused });
      }
    });
  }

  function setCtaMode(composing) {
    ctaStackPlay.hidden = composing;
    ctaStackEdit.hidden = !composing;
    syncBottomSheetReserve();
  }

  function commitAllFields() {
    for (const controller of fieldControllers) {
      controller.commit();
    }
  }

  function clearFieldControllers() {
    for (const controller of fieldControllers) {
      controller.destroy();
    }
    fieldControllers = [];
  }

  function bindField(options) {
    const controller = bindEditableField({
      ...options,
      isActive,
    });
    fieldControllers.push(controller);
    return controller;
  }

  function clearComposeGroups() {
    for (const el of [...playAreaEl.querySelectorAll(":scope > .compose-group")]) {
      el.remove();
    }
  }

  function renderComposeBoard() {
    boardEl.innerHTML = "";
    boardEl.hidden = true;
    clearComposeGroups();

    for (let gi = 0; gi < 4; gi += 1) {
      const block = document.createElement("div");
      block.className = "compose-group";

      const titleRowEl = document.createElement("div");
      titleRowEl.className = "compose-group-title-row";

      const titleWrapEl = document.createElement("div");
      titleWrapEl.className = "compose-group-title-wrap";

      const titleEl = document.createElement("div");
      titleEl.className = "compose-group-title";
      titleEl.setAttribute("role", "textbox");
      titleEl.setAttribute("aria-label", `Set ${gi + 1} title`);
      titleWrapEl.appendChild(titleEl);

      bindField({
        element: titleEl,
        wrap: titleWrapEl,
        placeholder: groupTitlePlaceholder(gi),
        getValue: () => getPuzzle().groups[gi].title ?? "",
        setValue: (value) => {
          getPuzzle().groups[gi].title = value;
          notifyChange();
        },
      });

      const colorsWrapEl = document.createElement("div");
      colorsWrapEl.className = "compose-group-colors-wrap";

      const colorsBtn = document.createElement("button");
      colorsBtn.type = "button";
      colorsBtn.className = "compose-group-colors-btn";
      colorsBtn.setAttribute("aria-label", `Colors for set ${gi + 1}`);
      const colorsIcon = document.createElement("span");
      colorsIcon.className = "material-symbols-outlined";
      colorsIcon.setAttribute("aria-hidden", "true");
      colorsIcon.textContent = "colors";
      colorsBtn.appendChild(colorsIcon);
      colorsBtn.addEventListener("click", () => {
        openColorPaletteModal({
          groupIndex: gi,
          getGroup: () => getPuzzle().groups[gi],
          onSelect: ({ text, bg }) => {
            setGroupColors(getPuzzle().groups[gi], { text, bg });
            notifyChange();
          },
        });
      });
      colorsWrapEl.appendChild(colorsBtn);

      const wordsRow = document.createElement("div");
      wordsRow.className = "compose-group-words";

      for (let wi = 0; wi < 4; wi += 1) {
        const wordWrap = document.createElement("div");
        wordWrap.className = "compose-word-wrap";

        const wordEl = document.createElement("div");
        wordEl.className = "word compose-word";
        wordEl.setAttribute("role", "textbox");
        wordEl.setAttribute("aria-label", wordFieldLabel(gi, wi));
        wordWrap.appendChild(wordEl);

        bindField({
          element: wordEl,
          wrap: wordWrap,
          placeholder: wordPlaceholder(gi, wi),
          tileText: true,
          onFocusChange: () => syncComposeWordColors(),
          getValue: () => {
            const text = getPuzzle().groups[gi].words[wi].text ?? "";
            return isWordPlaceholderValue(text, gi, wi) ? "" : text;
          },
          setValue: (value) => {
            getPuzzle().groups[gi].words[wi].text = value;
            notifyChange();
          },
        });

        wordsRow.appendChild(wordWrap);
      }

      titleRowEl.appendChild(titleWrapEl);
      titleRowEl.appendChild(colorsWrapEl);
      block.appendChild(titleRowEl);
      block.appendChild(wordsRow);
      playAreaEl.appendChild(block);
    }

    observeTileBoard(puzzleStack);
    syncComposeWordColors();
  }

  function syncAllDisplays() {
    for (const controller of fieldControllers) {
      controller.syncDisplay();
    }
  }

  function bindComposeChromeFields() {
    clearFieldControllers();

    if (puzzleTitleEl instanceof HTMLElement && titleWrap instanceof HTMLElement) {
      bindField({
        element: puzzleTitleEl,
        wrap: titleWrap,
        placeholder: COMPOSE_PLACEHOLDERS.PUZZLE_TITLE,
        getValue: () => getPuzzle().title ?? "",
        setValue: (value) => {
          getPuzzle().title = value;
          notifyChange();
        },
      });
    }

    bindField({
      element: vignetteEl,
      wrap: vignetteWrap,
      placeholder: COMPOSE_PLACEHOLDERS.VIGNETTE,
      getValue: () => getPuzzle().vignette ?? "",
      setValue: (value) => {
        getPuzzle().vignette = value;
        notifyChange();
      },
      allowMultiline: true,
    });
  }

  function finishComposeSetup() {
    renderComposeBoard();
    syncAllDisplays();
    setComposeBaselines();
    syncComposeControls();
  }

  function enterComposeMode(variant) {
    if (composeVariant) return;
    composeVariant = variant;

    vignetteEl.classList.add("vignette--compose");
    document.body.classList.add("edit-mode");
    setCtaMode(true);

    bindComposeChromeFields();
    finishComposeSetup();
  }

  /** Switch from edit compose to a blank create compose without leaving compose mode. */
  function switchToCreateVariant() {
    if (!composeVariant || composeVariant === "create") return;

    clearFieldControllers();
    clearComposeGroups();
    composeVariant = "create";
    bindComposeChromeFields();
    finishComposeSetup();
  }

  function exitComposeMode() {
    if (!composeVariant) return;

    clearFieldControllers();
    clearComposeGroups();
    vignetteEl.classList.remove("vignette--compose");

    boardEl.hidden = false;
    boardEl.innerHTML = "";

    composeVariant = null;
    composeDraftBaseline = null;
    composePublishBaseline = null;
    document.body.classList.remove("edit-mode");
    setCtaMode(false);

    if (dom.editPuzzleBtn) {
      dom.editPuzzleBtn.disabled = false;
      dom.editPuzzleBtn.removeAttribute("aria-disabled");
    }
  }

  /** @param {{ force?: boolean }} [options] */
  async function cancelCompose({ force = false } = {}) {
    const variant = composeVariant;
    if (!variant) return true;

    commitAllFields();

    if (!force && hasDraftChanges() && onConfirmDiscard) {
      const confirmed = await onConfirmDiscard();
      if (!confirmed) return false;
    }

    // Tear down bindings before restore so field teardown cannot write into the restored puzzle.
    exitComposeMode();
    onCancelCompose?.(variant);
    return true;
  }

  async function saveDraft() {
    commitAllFields();
    const glossaryCommit = commitActiveGlossaryEditor();
    if (!glossaryCommit.ok) {
      onValidationError(glossaryCommit.error);
      return false;
    }
    const puzzle = getPuzzle();
    normalizePuzzle(puzzle);
    syncAllDisplays();

    if (onSaveDraft) {
      const result = await onSaveDraft(puzzle, composeVariant);
      if (result && result.ok === false) {
        onValidationError(result.error ?? "Could not save draft.");
        return false;
      }
      if (result?.id && composeVariant === "create") {
        composeVariant = "edit";
        setPublishBaseline();
      }
      setDraftBaseline();
      syncComposeControls();
    }
    return true;
  }

  async function beginEdit(targetId) {
    const ok = await promptEditPassword();
    if (!ok) return false;
    try {
      if (onBeforeEnterEdit) await onBeforeEnterEdit(targetId);
      enterComposeMode("edit");
      return true;
    } catch (err) {
      console.error(err);
      onValidationError(err instanceof Error ? err.message : "Could not enter edit mode.");
      return false;
    }
  }

  dom.editPuzzleBtn?.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (isComposeMode()) return;
    await beginEdit();
  });

  async function beginCreate() {
    const ok = await promptEditPassword();
    if (!ok) return false;

    if (!onEnterCreate) {
      throw new Error("Create flow is not configured.");
    }

    const switching = isComposeMode();

    if (switching) {
      commitAllFields();
      const glossaryCommit = commitActiveGlossaryEditor();
      if (!glossaryCommit.ok) {
        onValidationError(glossaryCommit.error);
        return false;
      }
      if (hasDraftChanges() && onConfirmDiscard) {
        const confirmed = await onConfirmDiscard();
        if (!confirmed) return false;
      }
      onEnterCreate({ switching: true });
      switchToCreateVariant();
      return true;
    }

    onEnterCreate({ switching: false });
    enterComposeMode("create");
    return true;
  }

  dom.addPuzzleBtn?.addEventListener("click", async (event) => {
    event.stopPropagation();
    try {
      await beginCreate();
    } catch (err) {
      console.error(err);
      onValidationError(err instanceof Error ? err.message : "Could not start a new puzzle.");
    }
  });

  dom.saveBtn.addEventListener("click", () => {
    if (dom.saveBtn.disabled) return;
    saveDraft().catch((err) => {
      console.error(err);
      onValidationError(err instanceof Error ? err.message : "Could not save draft.");
    });
  });

  dom.cancelEditBtn.addEventListener("click", () => {
    cancelCompose().catch((err) => {
      console.error(err);
      onValidationError(err instanceof Error ? err.message : "Could not close edit mode.");
    });
  });

  return {
    enterComposeMode,
    exitComposeMode,
    cancelCompose,
    beginEdit,
    beginCreate,
    isComposeMode,
    getComposeVariant: () => composeVariant,
    commitAllFields,
    validateComposePublish: (options) => {
      const err = validateComposePublish(getPuzzle(), options);
      syncAllDisplays();
      return err;
    },
    createEmptyPuzzle,
    refreshSurfaceColors: () => syncComposeWordColors(),
    syncComposeControls,
  };
}
