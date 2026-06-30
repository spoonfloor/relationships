import { mountSlots } from "./mountSlots.js";
import { watchBottomSheet } from "./ctaLayout.js";

async function bootstrapShell() {
  await mountSlots([
    { selector: "#scroll-content", url: "./partials/scroll-content.html" },
    { selector: "#fixed-footer", url: "./partials/fixed-footer.html" },
  ]);

  watchBottomSheet();

  const { bootstrap } = await import("../main.js");
  await bootstrap();
}

bootstrapShell().catch((err) => {
  console.error(err);
  const status = document.getElementById("status");
  if (status) {
    status.textContent = `Startup error: ${err.message}`;
  }
});
