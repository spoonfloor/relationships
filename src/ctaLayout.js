/** See docs/ios-footer-pin.md for the iOS standalone viewport + scroll-slack story. */
function isStandalone() {
  if (window.navigator.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** Full-bleed height in iOS standalone (100dvh/innerHeight lie on cold start). */
function measureLargeViewportHeight() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;height:100vh;height:100lvh;";
  document.documentElement.appendChild(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}

function getAppViewportHeight() {
  if (isStandalone()) {
    return measureLargeViewportHeight();
  }

  const viewport = window.visualViewport;
  if (viewport?.height > 0) {
    return viewport.height;
  }

  return window.innerHeight;
}

export function syncAppShellHeight() {
  document.documentElement.style.setProperty(
    "--app-height",
    `${Math.round(getAppViewportHeight())}px`
  );
}

/** Reserve in-flow space so scroll content clears the fixed footer. */
export function syncBottomSheetReserve() {
  const footer = document.getElementById("fixed-footer");
  if (!footer) return;
  document.documentElement.style.setProperty(
    "--bottom-sheet-reserved",
    `${footer.offsetHeight}px`
  );
}

export function watchBottomSheet() {
  const update = () => {
    syncAppShellHeight();
    syncBottomSheetReserve();
    syncAllCtaRows();
  };

  update();
  requestAnimationFrame(update);
  window.addEventListener("resize", update);
  document.fonts?.ready.then(update);

  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
  }
}

/** @param {HTMLElement} row */
function visibleRowButtons(row) {
  return [...row.querySelectorAll(":scope > .btn")].filter(
    (btn) => !btn.hidden && getComputedStyle(btn).display !== "none"
  );
}

/** @param {HTMLElement} row */
function getRowGap(row) {
  const style = getComputedStyle(row);
  return parseFloat(style.columnGap || style.gap) || 0;
}

/** @param {HTMLElement} row */
function getComfortMinWidth(row) {
  const style = getComputedStyle(row);
  const value = parseFloat(style.getPropertyValue("--cta-comfort-min-width"));
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 120;
}

/** @param {number} available @param {number} count @param {number} gap */
function equalColumnWidth(available, count, gap) {
  return (available - gap * (count - 1)) / count;
}

/** @param {number[]} widths @param {number} available @param {number} gap */
function totalRowWidth(widths, gap) {
  return widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
}

/** @param {number[]} targets @param {number} available @param {number} gap */
function applyEqualPainShrink(targets, available, gap) {
  const total = totalRowWidth(targets, gap);
  if (total <= available) {
    return targets;
  }
  const pain = (total - available) / targets.length;
  return targets.map((width) => Math.max(0, width - pain));
}

/** @param {HTMLElement} btn */
function measureNaturalWidth(btn) {
  const label = btn.textContent ?? "";
  if (
    btn.dataset.ctaLabelWidthFor === label &&
    btn.dataset.ctaNaturalWidth != null
  ) {
    return parseFloat(btn.dataset.ctaNaturalWidth);
  }

  const saved = {
    flex: btn.style.flex,
    width: btn.style.width,
    maxWidth: btn.style.maxWidth,
    overflow: btn.style.overflow,
    position: btn.style.position,
    visibility: btn.style.visibility,
  };

  btn.style.flex = "none";
  btn.style.width = "max-content";
  btn.style.maxWidth = "none";
  btn.style.overflow = "visible";
  btn.style.position = "absolute";
  btn.style.visibility = "hidden";

  const width = btn.getBoundingClientRect().width;

  btn.style.flex = saved.flex;
  btn.style.width = saved.width;
  btn.style.maxWidth = saved.maxWidth;
  btn.style.overflow = saved.overflow;
  btn.style.position = saved.position;
  btn.style.visibility = saved.visibility;

  btn.dataset.ctaLabelWidthFor = label;
  btn.dataset.ctaNaturalWidth = String(width);
  return width;
}

/** @param {HTMLElement[]} buttons */
function measureNaturalWidths(buttons) {
  return buttons.map((btn) => measureNaturalWidth(btn));
}

/** @param {number} natural @param {number} comfortMin */
function applyComfortFloor(natural, comfortMin) {
  return natural < comfortMin ? comfortMin : natural;
}

/** @param {HTMLElement[]} buttons @param {number[]} widths */
function applyCtaRowWidths(buttons, widths) {
  const unchanged = buttons.every((btn, index) => {
    const match = btn.style.flex.match(/^0 0 ([\d.]+)px$/);
    return match && Math.abs(parseFloat(match[1]) - widths[index]) < 0.5;
  });
  if (unchanged) return;

  buttons.forEach((btn, index) => {
    btn.style.flex = `0 0 ${widths[index]}px`;
    btn.style.width = "";
    btn.style.maxWidth = "";
  });
}

/** @param {HTMLElement} row */
function isComfortRow(row) {
  return (
    row.classList.contains("cta-row--comfort") ||
    row.classList.contains("modal__actions")
  );
}

/**
 * Footer fill rows: equal-width columns across the row.
 * Comfort rows (modals/sheets): independent widths — comfort floor for short
 * labels only, full natural width for long labels; equal-pain shrink when tight.
 *
 * @param {HTMLElement} row
 */
export function syncCtaRow(row) {
  const buttons = visibleRowButtons(row);
  if (!buttons.length) return;

  if (row.clientWidth <= 0) return;

  const gap = getRowGap(row);
  const available = row.clientWidth;
  const count = buttons.length;

  if (row.classList.contains("cta-row--fill")) {
    const width = equalColumnWidth(available, count, gap);
    applyCtaRowWidths(
      buttons,
      buttons.map(() => width)
    );
    return;
  }

  if (isComfortRow(row)) {
    const comfortMin = getComfortMinWidth(row);
    const naturals = measureNaturalWidths(buttons);
    const targets = naturals.map((width) => applyComfortFloor(width, comfortMin));
    applyCtaRowWidths(buttons, applyEqualPainShrink(targets, available, gap));
    return;
  }

  const naturals = measureNaturalWidths(buttons);
  applyCtaRowWidths(buttons, applyEqualPainShrink(naturals, available, gap));
}

export function syncAllCtaRows() {
  document.querySelectorAll(".cta-row").forEach((row) => {
    if (row instanceof HTMLElement) {
      syncCtaRow(row);
    }
  });
}

const ctaRowObservers = new WeakMap();

/** @param {HTMLElement} row */
export function watchCtaRow(row) {
  if (ctaRowObservers.has(row)) return;
  const observer = new ResizeObserver(() => syncCtaRow(row));
  observer.observe(row);
  ctaRowObservers.set(row, observer);
  syncCtaRow(row);
}

export function watchCtaRows() {
  document.querySelectorAll(".cta-row").forEach((row) => {
    if (row instanceof HTMLElement) {
      watchCtaRow(row);
    }
  });
}
