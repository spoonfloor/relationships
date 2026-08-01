import {
  hexDisplayDigits,
  normalizeHex,
  parseHexInput,
  sanitizeHexDigits,
} from "./color.js";
import { applyColorSampleWithText, applyCompositeColorPreview } from "./colorSample.js";
import { resolveGroupColors } from "./groupColors.js";
import { mountInlineColorPicker } from "./inlineColorPicker.js";
import { openModal } from "./modal.js";

/** @typedef {"bg" | "text"} ColorTarget */

/**
 * @param {object} options
 * @param {number} options.groupIndex 0-based set index
 * @param {() => { colors?: { text?: string, bg?: string, border?: string } } | null | undefined} options.getGroup
 * @param {(colors: { text: string, bg: string }) => void} options.onSelect
 */
export function openColorPaletteModal({ groupIndex, getGroup, onSelect }) {
  const setNumber = groupIndex + 1;
  const resolved = resolveGroupColors(getGroup());
  /** @type {{ text: string, bg: string }} */
  let draft = {
    text: normalizeHex(resolved.text),
    bg: normalizeHex(resolved.bg),
  };
  const applied = {
    text: draft.text,
    bg: draft.bg,
  };
  /** @type {ColorTarget} */
  let target = "bg";

  /** @type {ReturnType<typeof mountInlineColorPicker> | null} */
  let picker = null;
  /** @type {HTMLElement | null} */
  let previewBgLeftEl = null;
  /** @type {HTMLElement | null} */
  let previewBgRightEl = null;
  /** @type {HTMLButtonElement | null} */
  let previewBgButtonEl = null;
  /** @type {HTMLButtonElement | null} */
  let previewTextButtonEl = null;
  /** @type {HTMLElement | null} */
  let previewTextLeftEl = null;
  /** @type {HTMLElement | null} */
  let previewTextRightEl = null;
  /** @type {HTMLInputElement | null} */
  let bgSwatchInputEl = null;
  /** @type {HTMLInputElement | null} */
  let textSwatchInputEl = null;
  /** @type {HTMLInputElement | null} */
  let bgRadio = null;
  /** @type {HTMLInputElement | null} */
  let textRadio = null;
  /** @type {HTMLElement | null} */
  let previewWrapEl = null;

  function pickerValue() {
    return target === "bg" ? draft.bg : draft.text;
  }

  function pickerAriaLabel() {
    return target === "bg" ? "Background color picker" : "Text color picker";
  }

  function syncPickerToTarget() {
    picker?.setValue(pickerValue());
    picker?.setAriaLabel(pickerAriaLabel());
  }

  /**
   * @param {HTMLInputElement | null} inputEl
   * @param {string} hex
   * @param {string} label
   */
  function updateSwatchInput(inputEl, hex, label) {
    if (!inputEl) return;
    const wrap = inputEl.closest(".color-palette-modal__swatch");
    if (wrap instanceof HTMLElement) {
      applyColorSampleWithText(wrap, hex, {
        surface: "modal",
      });
    }
    if (document.activeElement !== inputEl) {
      inputEl.value = hexDisplayDigits(hex);
    }
    inputEl.setAttribute("aria-label", `${label} color hex code`);
  }

  function syncPreview() {
    if (!previewWrapEl || !previewBgLeftEl || !previewBgRightEl) return;
    applyCompositeColorPreview(
      previewWrapEl,
      { left: draft.bg, right: applied.bg },
      {
        leftEl: previewBgLeftEl,
        rightEl: previewBgRightEl,
        surface: "modal",
      },
    );
    if (previewTextLeftEl) previewTextLeftEl.style.color = draft.text;
    if (previewTextRightEl) previewTextRightEl.style.color = applied.text;
  }

  function syncAll() {
    syncPreview();
    updateSwatchInput(bgSwatchInputEl, draft.bg, "Background");
    updateSwatchInput(textSwatchInputEl, draft.text, "Text");
    syncPickerToTarget();
  }

  function setTarget(nextTarget) {
    target = nextTarget;
    syncPickerToTarget();
  }

  /**
   * @param {ColorTarget} colorTarget
   * @param {string} hex
   */
  function applyColor(colorTarget, hex) {
    const normalized = normalizeHex(hex);
    if (colorTarget === "bg") {
      draft.bg = normalized;
    } else {
      draft.text = normalized;
    }
    syncPreview();
    updateSwatchInput(bgSwatchInputEl, draft.bg, "Background");
    updateSwatchInput(textSwatchInputEl, draft.text, "Text");
    if (target === colorTarget) {
      syncPickerToTarget();
    }
  }

  function setDraftColor(hex) {
    applyColor(target, hex);
  }

  /**
   * @param {HTMLInputElement} inputEl
   * @param {ColorTarget} colorTarget
   */
  function commitHexInput(inputEl, colorTarget) {
    const parsed = parseHexInput(inputEl.value);
    if (parsed) {
      applyColor(colorTarget, parsed);
      return;
    }
    inputEl.value = hexDisplayDigits(colorTarget === "bg" ? draft.bg : draft.text);
  }

  /**
   * @param {HTMLInputElement} inputEl
   * @param {ColorTarget} colorTarget
   */
  function onHexInput(inputEl, colorTarget) {
    inputEl.value = sanitizeHexDigits(inputEl.value);
    if (inputEl.value.length === 6) {
      const parsed = parseHexInput(inputEl.value);
      if (parsed) applyColor(colorTarget, parsed);
    }
  }

  /**
   * @param {HTMLInputElement} inputEl
   * @param {ColorTarget} colorTarget
   */
  function mountHexSwatchInput(inputEl, colorTarget) {
    inputEl.addEventListener("focus", () => {
      if (colorTarget === "bg") {
        if (bgRadio) bgRadio.checked = true;
      } else if (textRadio) {
        textRadio.checked = true;
      }
      setTarget(colorTarget);
      inputEl.select();
    });

    inputEl.addEventListener("input", () => {
      onHexInput(inputEl, colorTarget);
    });

    inputEl.addEventListener("paste", (event) => {
      event.preventDefault();
      const pasted = event.clipboardData?.getData("text") ?? "";
      const digits = sanitizeHexDigits(pasted);
      if (!digits) return;

      const selectionStart = inputEl.selectionStart ?? inputEl.value.length;
      const selectionEnd = inputEl.selectionEnd ?? inputEl.value.length;
      const merged = sanitizeHexDigits(
        inputEl.value.slice(0, selectionStart) + digits + inputEl.value.slice(selectionEnd),
      );
      inputEl.value = merged;
      onHexInput(inputEl, colorTarget);

      const caret = Math.min(merged.length, selectionStart + digits.length);
      inputEl.setSelectionRange(caret, caret);
    });

    inputEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitHexInput(inputEl, colorTarget);
        inputEl.blur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        inputEl.value = hexDisplayDigits(colorTarget === "bg" ? draft.bg : draft.text);
        inputEl.blur();
      }
    });

    inputEl.addEventListener("blur", () => {
      commitHexInput(inputEl, colorTarget);
    });
  }

  /**
   * @param {string} label
   * @returns {{ column: HTMLDivElement, input: HTMLInputElement }}
   */
  function createSwatchColumn(label) {
    const column = document.createElement("div");
    column.className = "color-palette-modal__swatch-column";

    const swatch = document.createElement("div");
    swatch.className = "color-sample color-palette-modal__swatch";

    const hash = document.createElement("span");
    hash.className = "color-palette-modal__swatch-hash";
    hash.textContent = "#";
    hash.setAttribute("aria-hidden", "true");

    const input = document.createElement("input");
    input.type = "text";
    input.className = "color-palette-modal__swatch-input";
    input.inputMode = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.maxLength = 6;
    input.setAttribute("aria-label", `${label} color hex code`);

    swatch.appendChild(hash);
    swatch.appendChild(input);

    const caption = document.createElement("span");
    caption.className = "color-palette-modal__swatch-label";
    caption.textContent = label;

    column.appendChild(swatch);
    column.appendChild(caption);

    return { column, input };
  }

  openModal({
    title: "Color palette",
    onClose: () => {
      picker?.destroy();
      picker = null;
    },
    content(bodyEl) {
      const intro = document.createElement("p");
      intro.textContent = `Select text & background colors for set ${setNumber}.`;
      bodyEl.appendChild(intro);

      const targetRow = document.createElement("div");
      targetRow.className = "color-palette-modal__target-row";

      const fieldset = document.createElement("fieldset");
      fieldset.className = "color-palette-modal__radios";

      const legend = document.createElement("legend");
      legend.className = "color-palette-modal__radios-legend";
      legend.textContent = "Edit";
      fieldset.appendChild(legend);

      const bgLabel = document.createElement("label");
      bgLabel.className = "color-palette-modal__radio-label";
      bgRadio = document.createElement("input");
      bgRadio.type = "radio";
      bgRadio.name = "color-palette-target";
      bgRadio.value = "bg";
      bgRadio.checked = true;
      bgLabel.appendChild(bgRadio);
      bgLabel.append("Background");

      const textLabel = document.createElement("label");
      textLabel.className = "color-palette-modal__radio-label";
      textRadio = document.createElement("input");
      textRadio.type = "radio";
      textRadio.name = "color-palette-target";
      textRadio.value = "text";
      textLabel.appendChild(textRadio);
      textLabel.append("Text");

      fieldset.appendChild(bgLabel);
      fieldset.appendChild(textLabel);

      const previewWrap = document.createElement("div");
      previewWrap.className = "color-sample color-palette-modal__preview";
      previewWrapEl = previewWrap;

      previewBgLeftEl = document.createElement("span");
      previewBgLeftEl.className =
        "color-palette-modal__preview-bg color-palette-modal__preview-bg--left";
      previewBgLeftEl.setAttribute("aria-hidden", "true");

      previewBgRightEl = document.createElement("span");
      previewBgRightEl.className =
        "color-palette-modal__preview-bg color-palette-modal__preview-bg--right";
      previewBgRightEl.setAttribute("aria-hidden", "true");

      previewBgButtonEl = document.createElement("button");
      previewBgButtonEl.type = "button";
      previewBgButtonEl.className = "color-palette-modal__preview-bg-hit";
      previewBgButtonEl.setAttribute("aria-label", "Edit background color");

      previewTextButtonEl = document.createElement("button");
      previewTextButtonEl.type = "button";
      previewTextButtonEl.className = "color-palette-modal__preview-text";
      previewTextButtonEl.setAttribute("aria-label", "Edit text color");

      previewTextLeftEl = document.createElement("span");
      previewTextLeftEl.className =
        "color-palette-modal__preview-text-half color-palette-modal__preview-text-half--left";
      previewTextLeftEl.textContent = "Preview";
      previewTextLeftEl.setAttribute("aria-hidden", "true");

      previewTextRightEl = document.createElement("span");
      previewTextRightEl.className =
        "color-palette-modal__preview-text-half color-palette-modal__preview-text-half--right";
      previewTextRightEl.textContent = "Preview";
      previewTextRightEl.setAttribute("aria-hidden", "true");

      previewTextButtonEl.appendChild(previewTextLeftEl);
      previewTextButtonEl.appendChild(previewTextRightEl);

      previewWrap.appendChild(previewBgLeftEl);
      previewWrap.appendChild(previewBgRightEl);
      previewWrap.appendChild(previewBgButtonEl);
      previewWrap.appendChild(previewTextButtonEl);

      targetRow.appendChild(fieldset);
      targetRow.appendChild(previewWrap);
      bodyEl.appendChild(targetRow);

      const pickerWrap = document.createElement("div");
      pickerWrap.className = "color-palette-modal__picker-wrap";
      bodyEl.appendChild(pickerWrap);

      picker = mountInlineColorPicker(pickerWrap, {
        value: pickerValue(),
        ariaLabel: pickerAriaLabel(),
        onChange: setDraftColor,
      });

      const swatches = document.createElement("div");
      swatches.className = "color-palette-modal__swatches";

      const bgSwatch = createSwatchColumn("Background");
      bgSwatchInputEl = bgSwatch.input;
      mountHexSwatchInput(bgSwatchInputEl, "bg");

      const textSwatch = createSwatchColumn("Text");
      textSwatchInputEl = textSwatch.input;
      mountHexSwatchInput(textSwatchInputEl, "text");

      swatches.appendChild(bgSwatch.column);
      swatches.appendChild(textSwatch.column);
      bodyEl.appendChild(swatches);

      bgRadio.addEventListener("change", () => {
        if (bgRadio.checked) setTarget("bg");
      });

      textRadio.addEventListener("change", () => {
        if (textRadio.checked) setTarget("text");
      });

      function focusBackgroundTarget() {
        if (bgRadio) bgRadio.checked = true;
        setTarget("bg");
      }

      previewBgButtonEl.addEventListener("click", focusBackgroundTarget);

      function focusTextTarget() {
        if (textRadio) textRadio.checked = true;
        setTarget("text");
      }

      previewTextButtonEl.addEventListener("click", focusTextTarget);

      syncAll();
    },
    actions: [
      { label: "Cancel", variant: "secondary" },
      {
        label: "Select",
        variant: "primary",
        onClick: () => {
          onSelect({ text: draft.text, bg: draft.bg });
        },
      },
    ],
  });
}
