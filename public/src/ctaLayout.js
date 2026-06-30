/** Measure fixed CTA stack and reserve in-flow space so the board clears it. */
export function syncCtaReserve() {
  const cta = document.querySelector(".cta-stack");
  if (!cta) return;
  document.documentElement.style.setProperty(
    "--cta-stack-reserved",
    `${cta.offsetHeight}px`
  );
}

export function watchCtaReserve() {
  syncCtaReserve();
  window.addEventListener("resize", syncCtaReserve);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncCtaReserve);
  }
}
