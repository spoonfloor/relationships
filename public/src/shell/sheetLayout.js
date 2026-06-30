function getAppViewportHeight() {
  const viewport = window.visualViewport;
  if (viewport?.height > 0) {
    return viewport.height;
  }
  return window.innerHeight || document.documentElement.clientHeight;
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
  syncAppShellHeight();
  syncFooterReserve();
}

export function watchFixedFooter() {
  syncFixedFooterLayout();
  requestAnimationFrame(syncFixedFooterLayout);

  window.addEventListener("resize", syncFixedFooterLayout);

  const viewport = window.visualViewport;
  if (viewport) {
    viewport.addEventListener("resize", syncFixedFooterLayout);
    viewport.addEventListener("scroll", syncFixedFooterLayout);
  }

  const footer = document.getElementById("fixed-footer");
  if (footer && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(syncFooterReserve).observe(footer);
  }
}
