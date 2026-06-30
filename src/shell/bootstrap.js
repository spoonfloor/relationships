import { mountSlots } from "./mountSlots.js";
import { watchFixedFooter } from "./sheetLayout.js";

const footerOnly = new URLSearchParams(window.location.search).has("footerOnly");

async function bootstrapShell() {
  if (footerOnly) {
    document.body.classList.add("footer-only-debug");
  }

  const slots = [
    { selector: "#fixed-footer", url: "./partials/fixed-footer.html" },
  ];
  if (!footerOnly) {
    slots.unshift({
      selector: "#scroll-content",
      url: "./partials/scroll-content.html",
    });
  }

  await mountSlots(slots);
  watchFixedFooter();

  if (!footerOnly) {
    const { bootstrap } = await import("../main.js");
    await bootstrap();
  }
}

bootstrapShell().catch((err) => {
  console.error("App bootstrap failed:", err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p style="padding:24px;color:#900;font-family:system-ui,sans-serif">Failed to load app: ${err.message}</p>`
  );
});
