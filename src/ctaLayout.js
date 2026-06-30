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
