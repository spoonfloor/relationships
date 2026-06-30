/** Reserve in-flow space so main content clears the fixed bottom sheet. */
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
  syncBottomSheetReserve();
  window.addEventListener("resize", syncBottomSheetReserve);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncBottomSheetReserve);
  }
}
