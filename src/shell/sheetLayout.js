function getAppViewportHeight() {
  const viewport = window.visualViewport;
  if (viewport?.height > 0) {
    return viewport.height;
  }
  return window.innerHeight || document.documentElement.clientHeight;
}

/** Pin fixed footer bottom to the visual viewport bottom (iOS standalone). */
export function syncFooterPin() {
  const footer = document.getElementById("fixed-footer");
  const viewport = window.visualViewport;
  if (!footer) return;

  if (!viewport) {
    footer.style.top = "";
    footer.style.bottom = "";
    return;
  }

  const visualBottom = viewport.offsetTop + viewport.height;
  footer.style.top = `${Math.round(visualBottom - footer.offsetHeight)}px`;
  footer.style.bottom = "auto";
}

export function syncAppShellHeight() {
  document.documentElement.style.setProperty(
    "--app-height",
    `${Math.round(getAppViewportHeight())}px`
  );
}

/** Reserve in-flow space so scroll content clears the fixed footer. */
export function syncFooterReserve() {
  const footer = document.getElementById("fixed-footer");
  if (!footer) return;
  document.documentElement.style.setProperty(
    "--bottom-sheet-reserved",
    `${footer.offsetHeight}px`
  );
}

export function syncFixedFooterLayout() {
  syncFooterPin();
  syncAppShellHeight();
  syncFooterReserve();
}

export function watchFixedFooter() {
  syncFixedFooterLayout();
  requestAnimationFrame(syncFixedFooterLayout);
  requestAnimationFrame(() => requestAnimationFrame(syncFixedFooterLayout));

  window.addEventListener("resize", syncFixedFooterLayout);
  window.addEventListener("scroll", syncFixedFooterLayout, { passive: true });
  window.addEventListener("load", syncFixedFooterLayout, { once: true });

  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener("resize", syncFixedFooterLayout);
    viewport.addEventListener("scroll", syncFixedFooterLayout);
  }

  const footer = document.getElementById("fixed-footer");
  if (footer && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncFixedFooterLayout).observe(footer);
  }
}
