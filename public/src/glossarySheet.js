import { setDisplayText } from "./display.js";
import {
  applyGlossaryText,
  collectGlossaryEntries,
  serializeGlossaryText,
} from "./puzzleSchema.js";
import { openSheet } from "./sheet.js";

const GLOSSARY_PLACEHOLDER_LINES = [
  "Add glossary terms and definitions.",
  "Use regular text for terms. Add hyphens for definitions.",
];

function createGlossaryPlaceholderElement() {
  const wrap = document.createElement("div");
  wrap.className = "glossary-editor__placeholder";
  for (const line of GLOSSARY_PLACEHOLDER_LINES) {
    const paragraph = document.createElement("p");
    setDisplayText(paragraph, line);
    wrap.appendChild(paragraph);
  }
  return wrap;
}

function syncEditorPlaceholderOverlay(editor) {
  editor.querySelector(".glossary-editor__placeholder--overlay")?.remove();
  if (readGlossaryEditorText(editor).trim()) return;
  const overlay = createGlossaryPlaceholderElement();
  overlay.classList.add("glossary-editor__placeholder--overlay");
  editor.appendChild(overlay);
}

const NULL_TERM_LABEL = "—";

/** @type {(() => { ok: true }) | null} */
let activeGlossaryCommit = null;

/**
 * Apply in-progress glossary editor text before save/publish.
 * @returns {{ ok: true }}
 */
export function commitActiveGlossaryEditor() {
  if (!activeGlossaryCommit) return { ok: true };
  return activeGlossaryCommit();
}

function clearActiveGlossaryEditor() {
  activeGlossaryCommit = null;
}

function classifyGlossaryEditorLine(line) {
  const isDefinition = line.textContent.trim().startsWith("-");
  line.classList.add("glossary-editor__line");
  line.classList.toggle("glossary-editor__line--term", !isDefinition);
  line.classList.toggle("glossary-editor__line--definition", isDefinition);
}

function appendGlossaryEditorLines(editor, text) {
  if (!text) {
    const line = document.createElement("div");
    classifyGlossaryEditorLine(line);
    editor.appendChild(line);
    syncEditorPlaceholderOverlay(editor);
    return;
  }

  for (const lineText of text.split(/\r?\n/)) {
    const line = document.createElement("div");
    line.textContent = lineText;
    classifyGlossaryEditorLine(line);
    editor.appendChild(line);
  }
}

function hasGlossaryEditorLines(editor) {
  return Array.from(editor.children).some((node) =>
    node.classList.contains("glossary-editor__line")
  );
}

function normalizeGlossaryEditorLines(editor) {
  for (const node of Array.from(editor.childNodes)) {
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      node.classList.contains("glossary-editor__placeholder")
    ) {
      continue;
    }

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

  if (!hasGlossaryEditorLines(editor)) appendGlossaryEditorLines(editor, "");
  else syncEditorPlaceholderOverlay(editor);
}

function readGlossaryEditorText(editor) {
  return Array.from(editor.children)
    .filter((line) => line.classList.contains("glossary-editor__line"))
    .map((line) => line.textContent)
    .join("\n");
}

/**
 * @param {HTMLElement} parent
 * @param {string | null} term
 * @param {string[]} definitions
 * @param {number} index
 * @param {{ collapsible?: boolean }} [options]
 */
function appendGlossaryEntry(parent, term, definitions, index, { collapsible = true } = {}) {
  const entry = document.createElement("div");
  entry.className = "glossary-entry";

  const definitionsId = `glossary-hint-def-${index}`;
  const label = term != null && term !== "" ? term : NULL_TERM_LABEL;

  const wordEl = document.createElement("span");
  wordEl.className = "glossary-entry__word";
  setDisplayText(wordEl, label);

  const ul = document.createElement("ul");
  ul.id = definitionsId;
  ul.className = "glossary-entry__definitions";
  for (const def of definitions) {
    const li = document.createElement("li");
    setDisplayText(li, def);
    ul.appendChild(li);
  }

  if (collapsible) {
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "glossary-entry__trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", definitionsId);
    trigger.appendChild(wordEl);

    const chevron = document.createElement("span");
    chevron.className = "material-icons glossary-entry__chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "expand_more";
    trigger.appendChild(chevron);

    ul.hidden = true;

    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!expanded));
      ul.hidden = expanded;
    });

    entry.appendChild(trigger);
  } else {
    const header = document.createElement("div");
    header.className = "glossary-entry__header";
    header.appendChild(wordEl);
    entry.appendChild(header);
  }

  entry.appendChild(ul);
  parent.appendChild(entry);
}

/**
 * Read-only glossary list. Collapsible with chevrons in play mode; expanded in edit view.
 * @param {HTMLElement} parent
 * @param {object} puzzle
 * @param {{ collapsible?: boolean }} [options]
 */
function appendHintGlossary(parent, puzzle, { collapsible = true } = {}) {
  parent.classList.add("sheet__body--hints");
  if (!collapsible) {
    parent.classList.add("sheet__body--hints-expanded");
  }
  for (const [index, { term, definitions }] of collectGlossaryEntries(puzzle).entries()) {
    appendGlossaryEntry(parent, term, definitions, index, { collapsible });
  }
}

/**
 * @param {HTMLElement} parent
 * @param {object} puzzle
 * @param {() => void} [onChange]
 */
function appendGlossaryEditor(parent, puzzle, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "glossary-editor-wrap";

  const view = document.createElement("div");
  view.className = "glossary-editor__view";
  view.setAttribute("aria-label", "Edit glossary");

  const editor = document.createElement("div");
  editor.className = "glossary-editor";
  editor.hidden = true;
  editor.setAttribute("role", "textbox");
  editor.setAttribute("aria-label", "Edit glossary");
  editor.setAttribute("aria-multiline", "true");

  const actions = document.createElement("div");
  actions.className = "glossary-editor__actions cta-row";
  actions.hidden = true;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-secondary btn-block-half";
  setDisplayText(cancelBtn, "Cancel");

  const applyBtn = document.createElement("button");
  applyBtn.type = "button";
  applyBtn.className = "btn btn-primary btn-block-half";
  setDisplayText(applyBtn, "Apply");

  actions.appendChild(cancelBtn);
  actions.appendChild(applyBtn);

  wrap.appendChild(view);
  wrap.appendChild(editor);
  wrap.appendChild(actions);

  let editing = false;
  let cancelPending = false;

  function showView() {
    editing = false;
    activeGlossaryCommit = () => ({ ok: true });
    view.hidden = false;
    editor.hidden = true;
    actions.hidden = true;
    editor.contentEditable = "false";
    editor.classList.remove("glossary-editor--editing", "editable-field", "editable-field--focused");
    editor.removeAttribute("aria-invalid");

    view.replaceChildren();
    view.classList.remove("sheet__body--hints", "sheet__body--hints-expanded");
    if (collectGlossaryEntries(puzzle).length) {
      appendHintGlossary(view, puzzle, { collapsible: false });
      return;
    }

    view.appendChild(createGlossaryPlaceholderElement());
  }

  function beginEditing() {
    if (editing) return;
    editing = true;
    view.hidden = true;
    editor.hidden = false;
    actions.hidden = false;
    editor.replaceChildren();
    editor.classList.add("glossary-editor--editing", "editable-field", "editable-field--focused");
    editor.contentEditable = "true";
    appendGlossaryEditorLines(editor, serializeGlossaryText(puzzle));
    activeGlossaryCommit = applyEditorText;
    editor.focus({ preventScroll: true });
  }

  function cancelEditing() {
    cancelPending = false;
    showView();
    if (document.activeElement === editor) {
      editor.blur();
    }
  }

  function applyEditorText() {
    if (!editing) return { ok: true };
    applyGlossaryText(puzzle, readGlossaryEditorText(editor));
    onChange?.();
    showView();
    return { ok: true };
  }

  function applyEditing() {
    applyEditorText();
    if (document.activeElement === editor) {
      editor.blur();
    }
  }

  function keepEditorFocused(event) {
    event.preventDefault();
  }

  cancelBtn.addEventListener("pointerdown", (event) => {
    cancelPending = true;
    keepEditorFocused(event);
  });
  cancelBtn.addEventListener("click", cancelEditing);
  applyBtn.addEventListener("pointerdown", keepEditorFocused);
  applyBtn.addEventListener("click", applyEditing);

  editor.addEventListener("input", () => {
    normalizeGlossaryEditorLines(editor);
    syncEditorPlaceholderOverlay(editor);
  });
  editor.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelPending = true;
      cancelEditing();
    }
  });
  editor.addEventListener("blur", () => {
    if (!editing) return;
    if (cancelPending) {
      cancelPending = false;
      return;
    }
    applyEditorText();
  });

  view.addEventListener("click", () => {
    beginEditing();
  });

  showView();
  parent.appendChild(wrap);
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
    onClose: clearActiveGlossaryEditor,
    content(body) {
      if (editable) {
        appendGlossaryEditor(body, puzzle, onChange);
      } else {
        appendHintGlossary(body, puzzle);
      }
    },
  });
}
