import { formatDisplayText } from "./typography.js";

export { formatDisplayText } from "./typography.js";

/** The only way to assign user-visible text in the app. */
export function setDisplayText(element, text) {
  element.textContent = formatDisplayText(text);
}

/** Apply smart quotes to static markup (buttons, labels, headings, aria-labels). */
export function formatStaticUi(root = document.body) {
  for (const el of root.querySelectorAll("[aria-label]")) {
    const label = el.getAttribute("aria-label");
    if (label) el.setAttribute("aria-label", formatDisplayText(label));
  }
  for (const el of root.querySelectorAll("button, label, h1, h2, h3, h4, span.label")) {
    if (el.querySelector(".material-icons")) continue;
    setDisplayText(el, el.textContent);
  }
}
