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

export function watchFixedFooter() {
  syncAppShellHeight();
  requestAnimationFrame(syncAppShellHeight);

  window.addEventListener("resize", syncAppShellHeight);
  window.addEventListener("load", syncAppShellHeight, { once: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncAppShellHeight);
  }
}
