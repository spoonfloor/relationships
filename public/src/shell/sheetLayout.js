function getAppViewportHeight() {
  const viewport = window.visualViewport;
  const candidates = [
    window.innerHeight,
    document.documentElement.clientHeight,
    viewport?.height ?? 0,
  ];

  return Math.max(...candidates.filter((height) => height > 0));
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

export function watchFixedFooter() {
  const update = () => {
    syncAppShellHeight();
    syncFooterReserve();
  };

  update();
  requestAnimationFrame(update);
  window.addEventListener("resize", update);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", update);
  }
}
