import { setDisplayText } from "./display.js";
import { syncBottomSheetReserve } from "./ctaLayout.js";

function placeCaretFromPoint(clientX, clientY) {
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (!range) return false;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(clientX, clientY);
    if (!pos) return false;
    const range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  }
  return false;
}

function placeCaretAtEnd(element) {
  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function selectAllText(element) {
  element.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(element);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function isWordChar(char) {
  return /[\p{L}\p{N}'’-]/u.test(char);
}

function selectWordAtPoint(element, clientX, clientY) {
  element.focus({ preventScroll: true });
  if (!placeCaretFromPoint(clientX, clientY)) {
    placeCaretAtEnd(element);
  }

  const sel = window.getSelection();
  if (!sel?.rangeCount) return;

  if (typeof sel.modify === "function") {
    sel.modify("extend", "backward", "word");
    sel.modify("extend", "forward", "word");
    return;
  }

  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return;

  const text = node.textContent ?? "";
  let start = range.startOffset;
  let end = range.startOffset;

  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;

  range.setStart(node, start);
  range.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(range);
}

function insertLineBreakAtSelection() {
  const sel = window.getSelection();
  if (!sel?.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const breakNode = document.createTextNode("\n");
  range.insertNode(breakNode);
  range.setStartAfter(breakNode);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function readTitleText(element) {
  return element.innerText ?? "";
}

function focusTitleAndPlaceCaret(element, clientX, clientY) {
  element.focus({ preventScroll: true });
  if (!placeCaretFromPoint(clientX, clientY)) {
    placeCaretAtEnd(element);
  }
}

/**
 * @param {{
 *   dom: {
 *     puzzleTitleEl: HTMLElement,
 *     ctaStackPlay: HTMLElement,
 *     ctaStackEdit: HTMLElement,
 *     saveExitBtn: HTMLButtonElement,
 *     saveBtn: HTMLButtonElement,
 *     cancelEditBtn: HTMLButtonElement,
 *     editPuzzleBtn: HTMLButtonElement | null,
 *   },
 *   getPuzzle: () => { title?: string },
 *   setTitle: (title: string) => void,
 *   onValidationError: (message: string) => void,
 * }} options
 */
export function initPuzzleEdit({
  dom,
  getPuzzle,
  setTitle,
  onValidationError,
}) {
  const { puzzleTitleEl, ctaStackPlay, ctaStackEdit } = dom;
  const titleWrap = puzzleTitleEl.closest(".puzzle-title-wrap");
  if (!(titleWrap instanceof HTMLElement)) {
    throw new Error("puzzle-title must be wrapped in .puzzle-title-wrap");
  }

  let editMode = false;
  let savedTitle = "";
  let draftTitle = "";
  let pointerGestureActive = false;

  function syncTitleDisplay() {
    setDisplayText(puzzleTitleEl, draftTitle);
  }

  function blurTitleField() {
    if (document.activeElement === puzzleTitleEl) {
      puzzleTitleEl.blur();
    }
  }

  function clearFocusState() {
    puzzleTitleEl.classList.remove("puzzle-title--editing");
    titleWrap.classList.remove("puzzle-title-wrap--focused");
  }

  function clearEditingState() {
    puzzleTitleEl.contentEditable = "false";
    clearFocusState();
  }

  function ensureFocusState() {
    puzzleTitleEl.classList.add("puzzle-title--editing");
    titleWrap.classList.add("puzzle-title-wrap--focused");
  }

  function deactivateTitleField() {
    draftTitle = readTitleText(puzzleTitleEl);
    clearFocusState();
    syncTitleDisplay();
  }

  function activateTitleField(clientX, clientY) {
    ensureFocusState();
    focusTitleAndPlaceCaret(puzzleTitleEl, clientX, clientY);
  }

  function setCtaMode(editing) {
    ctaStackPlay.hidden = editing;
    ctaStackEdit.hidden = !editing;
    syncBottomSheetReserve();
  }

  function enterEditMode() {
    if (editMode) return;
    editMode = true;
    savedTitle = getPuzzle().title ?? "";
    draftTitle = savedTitle;
    syncTitleDisplay();
    puzzleTitleEl.contentEditable = "true";
    document.body.classList.add("edit-mode");
    setCtaMode(true);
  }

  function exitEditMode() {
    if (!editMode) return;
    blurTitleField();
    clearEditingState();
    editMode = false;
    document.body.classList.remove("edit-mode");
    setCtaMode(false);
  }

  function validateAndCommitTitle() {
    const title = readTitleText(puzzleTitleEl).trim();
    if (!title) {
      onValidationError("Puzzle title cannot be empty.");
      return false;
    }
    draftTitle = title;
    savedTitle = title;
    setTitle(title);
    deactivateTitleField();
    syncTitleDisplay();
    return true;
  }

  function cancelEdit() {
    draftTitle = savedTitle;
    blurTitleField();
    clearEditingState();
    syncTitleDisplay();
    editMode = false;
    document.body.classList.remove("edit-mode");
    setCtaMode(false);
  }

  puzzleTitleEl.addEventListener("pointerdown", (event) => {
    if (!editMode || event.button !== 0) return;

    if (event.detail >= 2) {
      event.preventDefault();
      pointerGestureActive = true;
      ensureFocusState();
      const { clientX, clientY, pointerId, detail } = event;
      puzzleTitleEl.setPointerCapture(pointerId);

      const finishMultiClick = (upEvent) => {
        puzzleTitleEl.releasePointerCapture(pointerId);
        upEvent.preventDefault();
        if (detail === 2) {
          selectWordAtPoint(puzzleTitleEl, clientX, clientY);
        } else if (detail >= 3) {
          selectAllText(puzzleTitleEl);
        }
        window.setTimeout(() => {
          pointerGestureActive = false;
        }, 0);
      };

      puzzleTitleEl.addEventListener("pointerup", finishMultiClick, { once: true });
      puzzleTitleEl.addEventListener("pointercancel", () => {
        puzzleTitleEl.releasePointerCapture(pointerId);
        pointerGestureActive = false;
      }, { once: true });
      return;
    }

    if (puzzleTitleEl.classList.contains("puzzle-title--editing")) return;

    event.preventDefault();
    const { clientX, clientY, pointerId } = event;
    puzzleTitleEl.setPointerCapture(pointerId);

    const finishActivation = () => {
      puzzleTitleEl.releasePointerCapture(pointerId);
      activateTitleField(clientX, clientY);
    };

    puzzleTitleEl.addEventListener("pointerup", finishActivation, { once: true });
    puzzleTitleEl.addEventListener("pointercancel", () => {
      puzzleTitleEl.releasePointerCapture(pointerId);
    }, { once: true });
  });

  puzzleTitleEl.addEventListener("keydown", (event) => {
    if (!editMode || !puzzleTitleEl.isContentEditable) return;
    if (event.key !== "Enter") return;

    if (event.shiftKey) {
      event.preventDefault();
      insertLineBreakAtSelection();
      draftTitle = readTitleText(puzzleTitleEl);
      return;
    }

    event.preventDefault();
    validateAndCommitTitle();
  });

  puzzleTitleEl.addEventListener("blur", () => {
    if (!editMode || pointerGestureActive) return;
    deactivateTitleField();
  });

  puzzleTitleEl.addEventListener("input", () => {
    draftTitle = readTitleText(puzzleTitleEl);
  });

  dom.editPuzzleBtn?.addEventListener("click", () => {
    enterEditMode();
  });

  dom.saveBtn.addEventListener("click", () => {
    validateAndCommitTitle();
  });

  dom.saveExitBtn.addEventListener("click", () => {
    if (validateAndCommitTitle()) {
      exitEditMode();
    }
  });

  dom.cancelEditBtn.addEventListener("click", () => {
    cancelEdit();
  });

  return {
    enterEditMode,
    exitEditMode,
    isEditMode: () => editMode,
  };
}
