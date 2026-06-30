# Agent guide: app shell and swappable slots

This app uses a **fixed shell** with two swappable content regions:

1. **Scroll content** — the main page (word grid, vignette, debug UI)
2. **Fixed footer** — the three-button CTA stack pinned to the bottom

Game logic, puzzles, and styles for the board live outside the shell. Agents can replace either slot without touching layout code.

## Quick start for agents

| Task | Edit this file |
|------|----------------|
| Replace scrolling main page | `public/partials/scroll-content.html` |
| Replace fixed bottom CTAs | `public/partials/fixed-footer.html` |
| Change scroll/footer layout | `public/styles/shell.css` (avoid unless fixing layout) |
| Change board, tiles, modals | `public/styles/content.css` |
| Change game behavior | `public/src/main.js` and related modules |

After editing a partial, reload the page. Partials are fetched at startup — no build step.

**Requires a static server.** Slot loading uses `fetch()`. Open via `python3 app.py` (port 5001), not `file://`.

## Architecture

```
public/
├── index.html                 # Shell wrappers only (#app-shell, #scroll-content, #fixed-footer)
├── partials/
│   ├── scroll-content.html    # SLOT 1 — main scroll area (inner HTML)
│   └── fixed-footer.html      # SLOT 2 — CTA stack (inner HTML)
├── styles/
│   ├── shell.css              # Layout: scroll + fixed footer (do not add game styles)
│   └── content.css            # Game UI: board, buttons, modals, etc.
├── src/
│   ├── shell/
│   │   ├── bootstrap.js       # Mounts partials, starts layout watch, loads main.js
│   │   ├── mountSlots.js      # Fetches partial HTML into slot containers
│   │   └── ctaLayout.js       # Syncs --app-height and --bottom-sheet-reserved
│   └── main.js                # Game bootstrap (exported, not self-executing)
└── styles.css                 # Legacy import shim → shell.css + content.css
```

### Load order

1. `index.html` defines empty `#scroll-content` and `#fixed-footer` wrappers
2. `bootstrap.js` fetches both partials and injects their HTML
3. `watchBottomSheet()` measures the footer and sets CSS variables so content is not hidden
4. `main.js` `bootstrap()` wires up game logic

## Shell contract (do not break)

These elements and IDs are required by the shell and game code:

### Wrappers (in `index.html` — do not remove)

| Element | ID | Classes | Role |
|---------|-----|---------|------|
| Shell root | `app-shell` | `app-shell` | Page frame |
| Scroll area | `scroll-content` | `app` | Grows with content; page scrolls |
| Fixed footer | `fixed-footer` | `bottom-sheet` | Pinned to viewport bottom |

### Scroll content IDs (in `partials/scroll-content.html`)

Required for the game to run:

- `vignette` — puzzle title / intro text
- `board` — word grid mount point
- `submitBtn` is **not** here — it lives in the footer partial

Debug UI (hidden in production via `.debug-ui { display: none }`):

- `paletteChips`, `newGameBtn`, `status`, `hintCategoryBtn`, `hintWordBtn`, `glossaryBtn`
- `most-recent-guess`, `foundGroups`, `guesses`, `puzzleSelect`, `uploader-container`

See `public/src/dom.js` for the full DOM contract.

### Footer IDs (in `partials/fixed-footer.html`)

Required — `main.js` attaches click handlers to these:

- `submitBtn` — primary CTA (Submit / Solve with Option held)
- `shuffleBtn` — shuffle unlocked tiles
- `clearBtn` — reset selection

Keep the `.cta-stack` > `.cta-row` structure unless you also update `public/styles/shell.css` and re-test footer height reservation.

## Replacing slot content

### Replace the scrolling page

Edit `public/partials/scroll-content.html`. Put **inner HTML only** — do not add a `<main>` tag (the shell provides `#scroll-content`).

Preserve any element IDs that `dom.js` or `main.js` reference, or update those modules to match your new markup.

### Replace the footer

Edit `public/partials/fixed-footer.html`. Put **inner HTML only** — do not add a `<footer>` tag.

The default content is the three-button stack:

```html
<div class="cta-stack">
  <button id="submitBtn" class="btn btn-primary btn-block">Submit</button>
  <div class="cta-row">
    <button id="shuffleBtn" class="btn btn-block-half">Shuffle</button>
    <button id="clearBtn" class="btn btn-secondary btn-block-half">Clear</button>
  </div>
</div>
```

If the footer height changes, `ctaLayout.js` recalculates automatically on resize. No manual padding edits needed.

## Files agents should not modify (unless fixing shell bugs)

- `public/src/shell/mountSlots.js`
- `public/src/shell/bootstrap.js`
- `public/src/shell/ctaLayout.js`
- `public/index.html` shell structure (`#app-shell`, `#scroll-content`, `#fixed-footer`)

## Styling guidelines

| Concern | File |
|---------|------|
| Footer position, safe areas, bottom padding reserve | `shell.css` |
| Phone vs desktop frame width | `shell.css` |
| Word tiles, board grid, modals, tooltips | `content.css` |
| Button colors and typography | `content.css` |

Link order in `index.html`: `shell.css` first, then `content.css`.

## Local development

```sh
python3 app.py
```

Visit `http://localhost:5001`. See `.cursor/rules/dev-server.mdc` — do not start/stop the server unless the user asks.

## Verification checklist

After changing a slot:

1. Page loads without console errors
2. Main content scrolls on a narrow viewport
3. Footer stays fixed at the bottom
4. Last row of the board is not covered by the footer
5. Submit, Shuffle, and Clear buttons work
6. On wide viewports, shell is centered with phone-aspect frame

## Related projects

- **`fixed-sheet`** — separate PNG prototype of a scroll + fixed-overlay shell. This repo (`relationships`) is the canonical interactive app; use the slot pattern here rather than porting game code into `fixed-sheet`.
