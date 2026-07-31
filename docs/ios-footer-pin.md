# iOS fixed footer pin on first paint

Verified checkpoint: `checkpoint/ios-footer-pin` (`c1d4cfd`).

The game shell keeps CTAs in a fixed footer (`#fixed-footer.bottom-sheet`) while the puzzle scrolls above it. On iPhone home-screen apps, that footer used to sit too high until the user scrolled once. A long vignette masked the bug because it made the page scrollable.

The real fix is two parts:

1. Measure the **full-bleed viewport height** correctly on cold start.
2. Make the document **1px taller than that height** so iOS treats the page as scrollable and pins `position: fixed; bottom: 0` on first paint.

## The bug

Two issues interact:

1. **Wrong height on cold start.** In iOS standalone (Add to Home Screen), `100dvh`, `window.innerHeight`, and `visualViewport.height` all under-report by roughly the status bar / Dynamic Island area (~59px). They agree on the same wrong short number, so `Math.max(...)` does not help.
2. **Page not scrollable.** When `document.documentElement.scrollHeight === document.documentElement.clientHeight`, iOS handles `position: fixed; bottom: 0` differently. Short puzzles never overflow the viewport, so the footer does not pin until scroll forces a viewport recalc.

Scrolling "fixes" the footer because it both promotes iOS to the large viewport and makes the page scrollable.

## Full-bleed viewport measurement

Full bleed requires `viewport-fit=cover` in the meta viewport tag (see `public/index.html`) plus safe-area padding on interactive UI via `env(safe-area-inset-*)`.

For **height**, do not trust JS viewport APIs in standalone mode. Probe CSS directly:

```js
function measureLargeViewportHeight() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;height:100vh;height:100lvh;";
  document.documentElement.appendChild(probe);
  const height = probe.offsetHeight;
  probe.remove();
  return height;
}
```

Why this works:

- `100vh` / `100lvh` return the true large viewport in iOS standalone — edge-to-edge under `viewport-fit=cover`.
- `offsetHeight` converts that CSS unit into a concrete pixel value.
- In regular Safari, `visualViewport.height` is still the right choice (toolbar-aware).
- Standalone is detected via `navigator.standalone` or `(display-mode: standalone)`.

Implementation: `public/src/ctaLayout.js` (`getAppViewportHeight`, `syncAppShellHeight`).

The measured value is written to the CSS custom property `--app-height`. CSS also has a standalone fallback before JS runs:

```css
@media (display-mode: standalone) {
  :root {
    --app-height: 100vh;
  }
}
```

### Mode cheat sheet

| Context | Full-bleed height |
|---|---|
| Home-screen app (standalone) | `100vh` / `100lvh` (probed to px) |
| Safari browser with toolbar | `100dvh` or `visualViewport.height` |
| Keyboard open | `visualViewport.height` (updates on resize) |

## Making the page "long enough"

Once `--app-height` is correct, force the document root to be exactly 1px taller than the screen:

```css
html,
body {
  min-height: calc(var(--app-height) + 1px);
}
```

This guarantees `scrollHeight > clientHeight` regardless of content length — the invisible equivalent of a long vignette, without a scrollable blank void.

Implementation: `public/styles.css`.

## What failed first

An early attempt added a 1px `::after` pseudo-element **inside** `.app-shell`, which already had `min-height: var(--app-height)`. The extra pixel lived inside an already-full-height box, so the document never grew past the viewport. The +1px must be relative to **screen height**, not content height.

## Re-sync hooks

Viewport measurement re-runs when the layout settles:

- On load and `requestAnimationFrame`
- `window.resize`
- `document.fonts.ready`
- `visualViewport` `resize` and `scroll`
- After puzzle render in `main.js` (`syncAppShellHeight` + `syncBottomSheetReserve`)

## Debugging

`public/src/layoutDebug.js` overlays layout metrics including `pinDelta` (footer bottom vs `visualViewport` bottom). On first paint before user scroll, check:

1. **Scroll slack:** `body scrollHeight > doc clientHeight`
2. **Footer pinned:** `pinDelta ≈ 0`

## Related files

| File | Role |
|---|---|
| `public/src/ctaLayout.js` | Viewport measurement, footer reserve, watchers |
| `public/styles.css` | `--app-height`, root `min-height + 1px`, footer styles |
| `public/index.html` | `viewport-fit=cover`, standalone meta tags |
| `public/src/main.js` | Calls `watchBottomSheet()` at bootstrap |
| `public/src/layoutDebug.js` | Temporary layout probe overlay |
