import { setDisplayText } from "./display.js";
import {
  applyGlossaryText,
  collectGlossaryEntries,
  serializeGlossaryText,
} from "./puzzleSchema.js";
import { openSheet } from "./sheet.js";

const GLOSSARY_PLACEHOLDER =
  "Add glossary terms and definitions. Use regular text for terms. Add hyphens for definitions.";

function classifyGlossaryEditorLine(line) {
  const isDefinition = line.textContent.trim().startsWith("-");
  line.classList.add("glossary-editor__line");
  line.classList.toggle("glossary-editor__line--term", !isDefinition);
  line.classList.toggle("glossary-editor__line--definition", isDefinition);
}

function appendGlossaryEditorLines(editor, text) {
  for (const lineText of text.split(/\r?\n/)) {
    const line = document.createElement("div");
    line.textContent = lineText;
    if (!lineText) line.dataset.placeholder = GLOSSARY_PLACEHOLDER;
    classifyGlossaryEditorLine(line);
    editor.appendChild(line);
  }
}

function normalizeGlossaryEditorLines(editor) {
  for (const node of Array.from(editor.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") {
      classifyGlossaryEditorLine(node);
      continue;
    }

    const line = document.createElement("div");
    editor.insertBefore(line, node);
    if (node.nodeType === Node.TEXT_NODE) line.appendChild(node);
    else node.remove();
    classifyGlossaryEditorLine(line);
  }

  if (!editor.childNodes.length) appendGlossaryEditorLines(editor, "");
  const lines = Array.from(editor.children);
  if (lines.length === 1 && !lines[0].textContent) {
    lines[0].dataset.placeholder = GLOSSARY_PLACEHOLDER;
  }
}

function readGlossaryEditorText(editor) {
  return Array.from(editor.children)
    .filter((line) => line.classList.contains("glossary-editor__line"))
    .map((line) => line.textContent)
    .join("\n");
}

/**
 * @param {HTMLElement} parent
 * @param {string} word
 * @param {string[]} definitions
 */
function appendWordDefinitions(parent, word, definitions) {
  const entry = document.createElement("div");
  entry.className = "glossary-entry";

  const wordEl = document.createElement("p");
  wordEl.className = "glossary-entry__word";
  setDisplayText(wordEl, word);
  entry.appendChild(wordEl);

  const ul = document.createElement("ul");
  ul.className = "glossary-entry__definitions";
  for (const def of definitions) {
    const li = document.createElement("li");
    setDisplayText(li, def);
    ul.appendChild(li);
  }
  entry.appendChild(ul);
  parent.appendChild(entry);
}

/**
 * @param {HTMLElement} parent
 * @param {object} puzzle
 */
function appendFormattedGlossary(parent, puzzle) {
  for (const { word, definitions } of collectGlossaryEntries(puzzle)) {
    appendWordDefinitions(parent, word, definitions);
  }
}

/**
 * @param {HTMLElement} parent
 * @param {object} puzzle
 * @param {() => void} [onChange]
 */
function appendGlossaryEditor(parent, puzzle, onChange) {
  const editor = document.createElement("div");
  editor.className = "glossary-editor";
  editor.tabIndex = 0;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", "Edit glossary");
  editor.setAttribute("aria-multiline", "true");

  let editing = false;
  let draftText = serializeGlossaryText(puzzle);

  function renderFormatted() {
    editing = false;
    editor.contentEditable = "false";
    editor.tabIndex = 0;
    editor.setAttribute("role", "textbox");
    editor.setAttribute("aria-label", "Edit glossary");
    editor.setAttribute("aria-multiline", "true");
    editor.removeAttribute("aria-invalid");
    editor.replaceChildren();
    editor.classList.remove("glossary-editor--editing");
    parent.querySelector(".glossary-editor__error")?.remove();

    if (collectGlossaryEntries(puzzle).length) {
      appendFormattedGlossary(editor, puzzle);
      return;
    }

    const placeholder = document.createElement("p");
    placeholder.className = "glossary-editor__placeholder";
    setDisplayText(placeholder, GLOSSARY_PLACEHOLDER);
    editor.appendChild(placeholder);
  }

  function beginEditing() {
    if (editing) return;
    editing = true;
    draftText = serializeGlossaryText(puzzle);
    editor.replaceChildren();
    editor.classList.add("glossary-editor--editing");
    editor.contentEditable = "true";
    editor.dataset.placeholder = GLOSSARY_PLACEHOLDER;
    appendGlossaryEditorLines(editor, draftText);
    editor.focus({ preventScroll: true });
  }

  editor.addEventListener("input", () => {
    normalizeGlossaryEditorLines(editor);
  });
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") editor.blur();
  });
  editor.addEventListener("blur", () => {
    if (!editing) return;
    draftText = readGlossaryEditorText(editor);
    const { unknownTerms } = applyGlossaryText(puzzle, draftText);
    if (unknownTerms.length) {
      editor.setAttribute("aria-invalid", "true");
      const error = document.createElement("p");
      error.className = "glossary-editor__error";
      setDisplayText(
        error,
        `Glossary terms must match puzzle words: ${unknownTerms.join(", ")}`
      );
      parent.querySelector(".glossary-editor__error")?.remove();
      parent.appendChild(error);
      return;
    }

    draftText = serializeGlossaryText(puzzle);
    onChange?.();
    renderFormatted();
  });
  editor.addEventListener("focus", beginEditing);
  editor.addEventListener("click", beginEditing);
  renderFormatted();
  parent.appendChild(editor);
}

/**
 * @param {object} puzzle
 * @param {{ editable?: boolean, onChange?: () => void }} [options]
 * @returns {{ close: () => void, dialog: HTMLDialogElement } | null}
 */
export function openGlossarySheet(puzzle, { editable = false, onChange } = {}) {
  const entries = collectGlossaryEntries(puzzle);
  if (!editable && !entries.length) return null;

  return openSheet({
    title: "Glossary",
    className: "sheet--glossary",
    content(body) {
      if (editable) {
        appendGlossaryEditor(body, puzzle, onChange);
      } else {
        appendFormattedGlossary(body, puzzle);
      }
    },
  });
}
