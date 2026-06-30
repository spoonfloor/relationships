/** Pin bottom sheet to visual viewport and reserve in-flow space for main content. */
export function pinBottomSheet() {
  const sheet = document.querySelector(".bottom-sheet");
  if (!sheet) return;

  const vv = window.visualViewport;
  if (vv) {
    const layoutBottom = window.innerHeight - (vv.offsetTop + vv.height);
    sheet.style.bottom = `${Math.max(0, layoutBottom)}px`;
  } else {
    sheet.style.bottom = "0";
  }
}

export function syncBottomSheetReserve() {
  const sheet = document.querySelector(".bottom-sheet");
  if (!sheet) return;
  document.documentElement.style.setProperty(
    "--bottom-sheet-reserved",
    `${sheet.offsetHeight}px`
  );
}

export function watchBottomSheet() {
  const update = () => {
    pinBottomSheet();
    syncBottomSheetReserve();
  };

  update();
  window.addEventListener("resize", update);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", update);
    window.visualViewport.addEventListener("scroll", update);
  }
}
