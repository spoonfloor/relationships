import {
  focusAndPlaceCaret,
  placeCaretAtEnd,
  placeCaretAtStart,
} from "./caret.js";
import { resetTileTextFit, setTileText } from "./tileText.js";

/**
 * Canonical editable-field lifecycle for compose mode.
 * Owns contentEditable, focus highlight classes, and teardown.
 *
 * Empty fields show the placeholder as real text (styled via class) so the
 * caret can sit on it. The first insert replaces that text entirely —
 * placeholder strings are never committed as values.
 *
 * @param {{
 *   element: HTMLElement,
 *   wrap?: HTMLElement | null,
 *   placeholder: string,
 *   getValue: () => string,
 *   setValue: (value: string) => void,
 *   allowMultiline?: boolean,
 *   isActive?: () => boolean,
 *   tileText?: boolean,
 *   onFocusChange?: (focused: boolean) => void,
 * }} options
 */
export function bindEditableField({
  element,
  wrap = null,
  placeholder,
  getValue,
  setValue,
  allowMultiline = false,
  isActive = () => true,
  tileText = false,
  onFocusChange,
}) {
  const abort = new AbortController();
  const { signal } = abort;
  let pointerGestureActive = false;
  let destroyed = false;
  /** Set when beforeinput clears a placeholder ahead of the paste event. */
  let replacePlaceholderOnPaste = false;

  element.contentEditable = "true";
  element.dataset.placeholder = placeholder;
  element.classList.add("editable-field");
  wrap?.classList.add("editable-field-wrap");

  function showPlaceholder() {
    element.textContent = placeholder;
    if (tileText) resetTileTextFit(element);
    element.classList.add("editable-field--placeholder");
  }

  function syncDisplay() {
    if (destroyed) return;
    const value = getValue();
    const isFocused = document.activeElement === element;
    if (value) {
      if (tileText && !isFocused) {
        setTileText(element, value);
      } else {
        element.textContent = value;
        if (tileText) resetTileTextFit(element);
      }
      element.classList.remove("editable-field--placeholder");
    } else {
      showPlaceholder();
    }
  }

  function clearFocusClasses() {
    const wasFocused = element.classList.contains("editable-field--focused");
    element.classList.remove("editable-field--focused");
    wrap?.classList.remove("editable-field-wrap--focused");
    if (wasFocused) onFocusChange?.(false);
  }

  function ensureFocusClasses() {
    const wasFocused = element.classList.contains("editable-field--focused");
    element.classList.add("editable-field--focused");
    wrap?.classList.add("editable-field-wrap--focused");
    if (!wasFocused) onFocusChange?.(true);
  }

  function isShowingPlaceholder() {
    return element.classList.contains("editable-field--placeholder");
  }

  function readCommittedText() {
    if (isShowingPlaceholder()) return "";
    // textContent reads DOM text as stored; innerText reflects CSS such as text-transform.
    const raw = (element.textContent ?? "").replace(/\n$/, "").trim();
    if (!raw || raw.toLowerCase() === placeholder.toLowerCase()) return "";
    return raw;
  }

  function applyEditedText(text) {
    let next = text ?? "";
    if (!allowMultiline) {
      next = next.replace(/\r?\n/g, " ");
    }
    element.classList.remove("editable-field--placeholder");
    element.textContent = next;
    placeCaretAtEnd(element);
    const committed = readCommittedText();
    setValue(committed);
    if (!committed) {
      showPlaceholder();
      placeCaretAtStart(element);
    }
  }

  function commit() {
    if (destroyed) return;
    replacePlaceholderOnPaste = false;
    const wasFocused = element.classList.contains("editable-field--focused");
    // Fitted tile DOM (multi-line display hyphens) is not authoritative — only
    // flush edited plain text when the user actually focused this field.
    if (!tileText || wasFocused) {
      setValue(readCommittedText());
    }
    clearFocusClasses();
    syncDisplay();
  }

  function blurField() {
    if (document.activeElement === element) {
      element.blur();
    } else {
      clearFocusClasses();
    }
  }

  function activateField(clientX, clientY) {
    ensureFocusClasses();
    if (tileText) resetTileTextFit(element);
    if (!getValue()) {
      showPlaceholder();
      element.focus({ preventScroll: true });
      placeCaretAtStart(element);
      return;
    }
    if (tileText) {
      element.textContent = getValue();
    }
    focusAndPlaceCaret(element, clientX, clientY);
  }

  element.addEventListener(
    "pointerdown",
    (event) => {
      if (!isActive() || event.button !== 0) return;
      if (element.classList.contains("editable-field--focused")) return;

      event.preventDefault();
      const { clientX, clientY, pointerId } = event;
      element.setPointerCapture(pointerId);

      const finishActivation = () => {
        element.releasePointerCapture(pointerId);
        activateField(clientX, clientY);
      };

      element.addEventListener("pointerup", finishActivation, { once: true });
      element.addEventListener(
        "pointercancel",
        () => {
          element.releasePointerCapture(pointerId);
        },
        { once: true }
      );
    },
    { signal }
  );

  element.addEventListener(
    "keydown",
    (event) => {
      if (!isActive()) return;

      if (event.key === "Escape") {
        event.preventDefault();
        blurField();
        return;
      }

      if (event.key !== "Enter") return;

      if (allowMultiline && event.shiftKey) return;

      event.preventDefault();
      commit();
      blurField();
    },
    { signal }
  );

  element.addEventListener(
    "blur",
    () => {
      if (destroyed || pointerGestureActive) return;
      if (!isActive()) {
        clearFocusClasses();
        return;
      }
      commit();
    },
    { signal }
  );

  // Placeholder is real DOM text (so the caret can sit on it). On the first
  // insert, replace that text entirely — never prepend/append into it.
  element.addEventListener(
    "beforeinput",
    (event) => {
      if (!isActive() || !isShowingPlaceholder()) return;

      if (
        event.inputType.startsWith("delete") ||
        event.inputType === "historyUndo" ||
        event.inputType === "historyRedo"
      ) {
        event.preventDefault();
        return;
      }

      if (
        event.inputType === "insertFromPaste" ||
        event.inputType === "insertFromDrop"
      ) {
        // Clipboard text is authoritative on the paste event; clear the shell
        // here so the browser cannot splice into placeholder characters.
        event.preventDefault();
        replacePlaceholderOnPaste = true;
        element.classList.remove("editable-field--placeholder");
        element.textContent = "";
        return;
      }

      if (!event.inputType.startsWith("insert")) return;

      event.preventDefault();
      applyEditedText(event.data ?? "");
    },
    { signal }
  );

  element.addEventListener(
    "paste",
    (event) => {
      if (!isActive()) return;
      if (!replacePlaceholderOnPaste && !isShowingPlaceholder()) return;
      event.preventDefault();
      replacePlaceholderOnPaste = false;
      applyEditedText(event.clipboardData?.getData("text/plain") ?? "");
    },
    { signal }
  );

  element.addEventListener(
    "input",
    () => {
      if (!isActive() || isShowingPlaceholder()) return;
      const committed = readCommittedText();
      if (!committed) {
        showPlaceholder();
        placeCaretAtStart(element);
        setValue("");
        return;
      }
      setValue(committed);
    },
    { signal }
  );

  return {
    syncDisplay,
    commit,
    blur: blurField,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      abort.abort();
      clearFocusClasses();
      if (document.activeElement === element) {
        element.blur();
      }
      element.contentEditable = "false";
      element.classList.remove(
        "editable-field",
        "editable-field--placeholder",
        "editable-field--focused"
      );
      wrap?.classList.remove("editable-field-wrap", "editable-field-wrap--focused");
      delete element.dataset.placeholder;
    },
    setPointerGestureActive(active) {
      pointerGestureActive = active;
    },
  };
}
