import { formatDisplayText } from "./typography.js";

export { formatDisplayText } from "./typography.js";
export {
  formatTileText,
  fitTileText,
  resetTileTextFit,
  setTileText,
  observeTileBoard,
} from "./tileText.js";

/** The only way to assign user-visible text in the app. */
export function setDisplayText(element, text) {
  if (!element) return;
  element.textContent = formatDisplayText(text);
}

/**
 * Glossary-style inline emphasis: *italic*, **bold**, ***bold italic***.
 * Unmatched markers stay literal. Builds DOM nodes (not innerHTML).
 */
export function setInlineMarkupText(element, text) {
  if (!element) return;
  element.replaceChildren();
  const source = String(text ?? "");
  if (!source) return;

  const token = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  while ((match = token.exec(source))) {
    if (match.index > lastIndex) {
      element.appendChild(
        document.createTextNode(formatDisplayText(source.slice(lastIndex, match.index)))
      );
    }
    if (match[1] != null) {
      const strong = document.createElement("strong");
      const em = document.createElement("em");
      em.textContent = formatDisplayText(match[1]);
      strong.appendChild(em);
      element.appendChild(strong);
    } else if (match[2] != null) {
      const strong = document.createElement("strong");
      strong.textContent = formatDisplayText(match[2]);
      element.appendChild(strong);
    } else {
      const em = document.createElement("em");
      em.textContent = formatDisplayText(match[3]);
      element.appendChild(em);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < source.length) {
    element.appendChild(document.createTextNode(formatDisplayText(source.slice(lastIndex))));
  }
}

/** Apply smart quotes to static markup (buttons, labels, headings, aria-labels). */
export function formatStaticUi(root = document.body) {
  for (const el of root.querySelectorAll("[aria-label]")) {
    const label = el.getAttribute("aria-label");
    if (label) el.setAttribute("aria-label", formatDisplayText(label));
  }
  for (const el of root.querySelectorAll("button, label, h1, h2, h3, h4, span.label")) {
    if (el.querySelector(".material-icons, .material-symbols-outlined")) continue;
    // Preserve compound controls (e.g. dark-mode switch label + checkbox).
    if (el.querySelector("input, select, textarea")) continue;
    setDisplayText(el, el.textContent);
  }
}
