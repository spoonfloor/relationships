/** Temporary layout probe — always on until CTA pin bug is diagnosed. */

function readSafeAreaInsets() {
  const probe = document.createElement("div");
  probe.style.cssText = [
    "position:fixed",
    "inset:0",
    "padding:env(safe-area-inset-top) env(safe-area-inset-right)",
    "         env(safe-area-inset-bottom) env(safe-area-inset-left)",
    "visibility:hidden",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

function isStandalone() {
  if (window.navigator.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function measure(eventLabel) {
  const app = document.querySelector(".app");
  const board = document.getElementById("board");
  const cta = document.querySelector(".cta-stack");
  if (!app || !board || !cta) {
    return { event: eventLabel, error: "missing .app, #board, or .cta-stack" };
  }

  const appStyle = getComputedStyle(app);
  const appRect = app.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  const ctaRect = cta.getBoundingClientRect();
  const vv = window.visualViewport;
  const vvHeight = vv?.height ?? window.innerHeight;
  const vvOffsetTop = vv?.offsetTop ?? 0;
  const safe = readSafeAreaInsets();
  const appPaddingBottom = parseFloat(appStyle.paddingBottom) || 0;
  const expectedCtaBottom = appRect.bottom - appPaddingBottom;
  const gap = Math.round(ctaRect.top - boardRect.bottom);
  const pinDelta = Math.round(ctaRect.bottom - expectedCtaBottom);

  return {
    event: eventLabel,
    standalone: isStandalone(),
    appHeight: appStyle.height,
    appMinHeight: appStyle.minHeight,
    appRectBottom: Math.round(appRect.bottom),
    bodyScrollH: document.body.scrollHeight,
    docClientH: document.documentElement.clientHeight,
    innerHeight: window.innerHeight,
    vvHeight: Math.round(vvHeight),
    vvOffsetTop: Math.round(vvOffsetTop),
    safeBottom: Math.round(safe.bottom),
    boardBottom: Math.round(boardRect.bottom),
    ctaTop: Math.round(ctaRect.top),
    gap,
    ctaBottom: Math.round(ctaRect.bottom),
    expectedCtaBottom: Math.round(expectedCtaBottom),
    pinDelta,
    pinOk: Math.abs(pinDelta) <= 8,
  };
}

function formatMetrics(m) {
  if (m.error) return `${m.event}\nERROR: ${m.error}`;
  const pin = m.pinOk ? "YES" : "NO";
  return [
    `event: ${m.event}`,
    `standalone: ${m.standalone}`,
    `app height: ${m.appHeight}`,
    `app min-height: ${m.appMinHeight}`,
    `app rect bottom: ${m.appRectBottom}`,
    `body scrollHeight: ${m.bodyScrollH}`,
    `doc clientHeight: ${m.docClientH}`,
    `innerHeight: ${m.innerHeight}`,
    `visualViewport: ${m.vvHeight} (offset ${m.vvOffsetTop})`,
    `safe-area bottom: ${m.safeBottom}`,
    `board bottom: ${m.boardBottom}`,
    `cta top: ${m.ctaTop}`,
    `gap: ${m.gap}`,
    `cta bottom: ${m.ctaBottom}`,
    `expected cta bottom: ${m.expectedCtaBottom}`,
    `pin delta: ${m.pinDelta}`,
    `pin ok: ${pin}`,
  ].join("\n");
}

export function initLayoutDebug() {
  const overlay = document.createElement("pre");
  overlay.id = "layout-debug-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.cssText = [
    "position:fixed",
    "top:max(8px, env(safe-area-inset-top))",
    "left:max(8px, env(safe-area-inset-left))",
    "right:max(8px, env(safe-area-inset-right))",
    "z-index:99999",
    "margin:0",
    "padding:8px 10px",
    "font:11px/1.35 ui-monospace, Menlo, monospace",
    "color:#0f0",
    "background:rgba(0,0,0,0.82)",
    "border:1px solid #333",
    "border-radius:8px",
    "white-space:pre-wrap",
    "word-break:break-word",
    "pointer-events:none",
    "max-height:55vh",
    "overflow:auto",
  ].join(";");
  document.body.appendChild(overlay);

  let eventCount = 0;

  function refresh(eventLabel = "manual") {
    eventCount += 1;
    const label = `${eventLabel} #${eventCount}`;
    overlay.textContent = formatMetrics(measure(label));
  }

  refresh("init");

  requestAnimationFrame(() => {
    refresh("rAF-1");
    requestAnimationFrame(() => refresh("rAF-2"));
  });

  window.addEventListener("load", () => refresh("load"), { once: true });

  if (window.visualViewport) {
    for (const type of ["resize", "scroll"]) {
      window.visualViewport.addEventListener(type, () => refresh(`vv-${type}`));
    }
  }

  window.addEventListener("resize", () => refresh("resize"));

  return { refresh };
}
