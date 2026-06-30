function isStandalone() {
  if (window.navigator.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function getAppViewportHeight() {
  const viewport = window.visualViewport;
  const candidates = [
    window.innerHeight,
    document.documentElement.clientHeight,
    viewport?.height ?? 0,
  ];

  if (isStandalone() && window.innerHeight >= window.innerWidth) {
    candidates.push(window.screen?.height ?? 0);
  }

  return Math.max(...candidates.filter((height) => height > 0));
}

export function syncAppShellHeight() {
  document.documentElement.style.setProperty(
    "--app-height",
    `${Math.round(getAppViewportHeight())}px`
  );
}

/** Reserve in-flow space so main content clears the bottom sheet. */
export function syncBottomSheetReserve() {
  const sheet = document.querySelector(".bottom-sheet");
  if (!sheet) return;
  sheet.style.removeProperty("bottom");
  document.documentElement.style.setProperty(
    "--bottom-sheet-reserved",
    `${sheet.offsetHeight}px`
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
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", update);
  }
}
