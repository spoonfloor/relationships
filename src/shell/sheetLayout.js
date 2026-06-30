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

/**
 * MDN VisualViewport recipe: simulate position fixed to the visual viewport.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport#simulating_position_device-fixed
 */
export function syncFooterPin() {
  const footer = document.getElementById("fixed-footer");
  const viewport = window.visualViewport;
  if (!footer || !viewport) return;

  const layoutHeight = document.documentElement.getBoundingClientRect().height;
  const offsetLeft = viewport.offsetLeft;
  const offsetTop = viewport.height - layoutHeight + viewport.offsetTop;

  footer.style.transform = `translate(${offsetLeft}px, ${offsetTop}px) scale(${
    1 / viewport.scale
  })`;
}

export function syncFixedFooterLayout() {
  if (document.documentElement.dataset.footerLayout !== "flex") {
    syncFooterPin();
    syncFooterReserve();
  }
  syncAppShellHeight();
}

export function watchFixedFooter() {
  const update = () => syncFixedFooterLayout();

  update();
  requestAnimationFrame(update);

  window.addEventListener("resize", update);
  window.addEventListener("load", update, { once: true });

  const viewport = window.visualViewport;
  if (viewport && document.documentElement.dataset.footerLayout !== "flex") {
    viewport.addEventListener("scroll", update);
    viewport.addEventListener("resize", update);
  } else if (viewport) {
    viewport.addEventListener("resize", update);
  }

  const footer = document.getElementById("fixed-footer");
  if (footer && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(update).observe(footer);
  }
}
