import { setDisplayText } from "./display.js";
import { openSheet } from "./sheet.js";
import { formatSecretEmojiPool } from "./solveSummary.js";

/** Section headings for emojibase group indexes (2, “component,” is excluded at build). */
const GROUP_NAMES = {
  0: "Smileys & emotion",
  1: "People & body",
  3: "Animals & nature",
  4: "Food & drink",
  5: "Travel & places",
  6: "Activities",
  7: "Objects",
  8: "Symbols",
  9: "Flags",
};

const MAX_SUGGESTIONS = 8;

const STOP_WORDS = new Set(
  (
    "a about after again all also am an and any are as at be been but by can did do does for from " +
    "get got had has have he her him his how i if in into is it its just like me more my no not " +
    "of off on one or our out over she so some than that the their them then there they this " +
    "to too up us was we were what when where which who why will with would you your"
  ).split(" ")
);

const IRREGULAR_SINGULARS = {
  teeth: "tooth",
  feet: "foot",
  geese: "goose",
  mice: "mouse",
  men: "man",
  women: "woman",
  children: "child",
  people: "person",
};

/**
 * @typedef {{ emoji: string, name: string, nameWords: string[], keywords: string[], group: number, order: number }} EmojiEntry
 */

/** @type {Promise<EmojiEntry[]> | null} */
let emojiDataPromise = null;

/** Loaded on first open; ~38 KB gzipped, so it stays out of page load. */
function loadEmojiData() {
  emojiDataPromise ??= import("./vendor/emoji-data.js").then(({ default: rows }) =>
    rows.map(([emoji, name, keywords, group], order) => ({
      emoji,
      name,
      nameWords: toWords(name),
      keywords: toWords(keywords),
      group,
      order,
    }))
  );
  // Let a later open retry after a failed load.
  emojiDataPromise.catch(() => {
    emojiDataPromise = null;
  });
  return emojiDataPromise;
}

/** @param {string} text */
function toWords(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** The word plus plausible singular forms (teeth → tooth, berries → berry). @param {string} word */
function wordForms(word) {
  const forms = new Set([word]);
  if (IRREGULAR_SINGULARS[word]) forms.add(IRREGULAR_SINGULARS[word]);
  if (word.length > 3) {
    if (word.endsWith("ies")) forms.add(`${word.slice(0, -3)}y`);
    if (word.endsWith("ves")) forms.add(`${word.slice(0, -3)}f`);
    if (word.endsWith("es")) forms.add(word.slice(0, -2));
    if (word.endsWith("s") && !word.endsWith("ss")) forms.add(word.slice(0, -1));
  }
  return forms;
}

/**
 * Emoji that match words in the title. Each title word ranks its own matches
 * (name before keyword, then standard emoji order), and the words take turns
 * filling slots so one word can’t crowd out the rest. Variants such as
 * “person: red hair” are skipped.
 * @param {EmojiEntry[]} entries
 * @param {string} title
 */
export function suggestEmoji(entries, title) {
  const words = [...new Set(toWords(title))].filter((word) => !STOP_WORDS.has(word));
  const candidates = entries.filter((entry) => !entry.name.includes(":"));

  const perWord = words.map((word) => {
    const forms = wordForms(word);
    const scored = [];
    for (const entry of candidates) {
      let score = 0;
      if (entry.nameWords.some((w) => forms.has(w))) score = 2;
      else if (entry.keywords.some((w) => forms.has(w))) score = 1;
      if (score) scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score || a.entry.order - b.entry.order);
    return scored.map(({ entry }) => entry);
  });

  /** @type {EmojiEntry[]} */
  const picked = [];
  const seen = new Set();
  for (let rank = 0; picked.length < MAX_SUGGESTIONS; rank += 1) {
    let any = false;
    for (const list of perWord) {
      const entry = list[rank];
      if (!entry) continue;
      any = true;
      if (seen.has(entry.emoji)) continue;
      seen.add(entry.emoji);
      picked.push(entry);
      if (picked.length === MAX_SUGGESTIONS) break;
    }
    if (!any) break;
  }
  return picked;
}

/**
 * Every query word must prefix-match a name word or keyword.
 * @param {EmojiEntry[]} entries
 * @param {string} query
 */
function searchEmoji(entries, query) {
  const terms = toWords(query);
  if (!terms.length) return [];
  const hits = [];
  for (const entry of entries) {
    let nameHits = 0;
    const matchesAll = terms.every((term) => {
      if (entry.nameWords.some((word) => word.startsWith(term))) {
        nameHits += 1;
        return true;
      }
      return entry.keywords.some((word) => word.startsWith(term));
    });
    if (matchesAll) hits.push({ entry, nameHits });
  }
  hits.sort((a, b) => b.nameHits - a.nameHits || a.entry.order - b.entry.order);
  return hits.map(({ entry }) => entry);
}

/**
 * Pick the secret set’s emoji. Taps and Clear only change the sheet’s draft;
 * Done saves it. ✕, Escape and the backdrop close without saving.
 * @param {object} options
 * @param {string} options.title secret set title, for suggestions
 * @param {string} options.emoji the saved pick; "" when nothing is picked
 * @param {(emoji: string) => void} options.onDone called only when the pick
 *   changed; "" clears it
 * @param {() => void} [options.onClose]
 */
export function openSecretEmojiSheet({ title, emoji: savedEmoji, onDone, onClose }) {
  let draftEmoji = savedEmoji;
  /** @type {Map<string, EmojiEntry>} */
  let byEmoji = new Map();
  /** @type {EmojiEntry[]} */
  let entries = [];

  let sheet;
  sheet = openSheet({
    title: "Secret set emoji",
    className: "sheet--list sheet--emoji",
    onClose,
    content(body) {
      const subtitle = document.createElement("p");
      subtitle.className = "emoji-sheet__subtitle";
      appendTextWithPool(
        subtitle,
        "Pick the emoji players will see when they find the secret set, or don’t pick anything and they’ll see one of these at random: ",
        "."
      );

      // Pinned: the current pick and search never scroll away.
      const pinned = document.createElement("div");
      pinned.className = "emoji-sheet__pinned";

      const pickBar = document.createElement("div");
      pickBar.className = "emoji-sheet__pick";
      pickBar.setAttribute("aria-live", "polite");

      const search = document.createElement("input");
      search.type = "search";
      search.className = "emoji-sheet__search";
      search.placeholder = "Search emoji";
      search.setAttribute("aria-label", "Search emoji");
      search.autocomplete = "off";
      search.spellcheck = false;

      pinned.append(pickBar, search);

      const scroll = document.createElement("div");
      scroll.className = "emoji-sheet__scroll";

      const footer = document.createElement("div");
      footer.className = "emoji-sheet__footer";
      const doneBtn = document.createElement("button");
      doneBtn.type = "button";
      doneBtn.className = "btn btn-primary btn-block";
      setDisplayText(doneBtn, "Done");
      doneBtn.addEventListener("click", () => {
        if (draftEmoji !== savedEmoji) onDone(draftEmoji);
        sheet.close();
      });
      footer.appendChild(doneBtn);

      body.append(subtitle, pinned, scroll, footer);

      function renderPickBar() {
        const emoji = draftEmoji;
        pickBar.replaceChildren();

        const tile = document.createElement("span");
        tile.className = emoji
          ? "emoji-sheet__pick-tile"
          : "emoji-sheet__pick-tile emoji-sheet__pick-tile--empty";
        tile.setAttribute("aria-hidden", "true");
        tile.textContent = emoji || "?";

        const text = document.createElement("span");
        text.className = "emoji-sheet__pick-text";
        const nameEl = document.createElement("span");
        nameEl.className = "emoji-sheet__pick-name";
        const hintEl = document.createElement("span");
        hintEl.className = "emoji-sheet__pick-hint";
        if (emoji) {
          setDisplayText(nameEl, sentenceCase(byEmoji.get(emoji)?.name ?? "Picked"));
          setDisplayText(hintEl, "Players will see this");
        } else {
          setDisplayText(nameEl, "Nothing picked");
          appendTextWithPool(hintEl, "Players will see one of ", "");
        }
        text.append(nameEl, hintEl);
        pickBar.append(tile, text);

        if (emoji) {
          const clearBtn = document.createElement("button");
          clearBtn.type = "button";
          clearBtn.className = "btn emoji-sheet__clear";
          setDisplayText(clearBtn, "Clear");
          clearBtn.addEventListener("click", () => choose(""));
          pickBar.appendChild(clearBtn);
        }
      }

      function syncPickedCells() {
        const emoji = draftEmoji;
        for (const cell of scroll.querySelectorAll(".emoji-sheet__cell")) {
          const picked = cell.dataset.emoji === emoji;
          cell.classList.toggle("emoji-sheet__cell--picked", picked);
          cell.setAttribute("aria-pressed", String(picked));
        }
      }

      /** @param {string} emoji */
      function choose(emoji) {
        draftEmoji = emoji;
        renderPickBar();
        syncPickedCells();
      }

      /** @param {string} label @param {EmojiEntry[]} list */
      function appendSection(label, list) {
        const heading = document.createElement("h3");
        heading.className = "emoji-sheet__section";
        setDisplayText(heading, label);
        const grid = document.createElement("div");
        grid.className = "emoji-sheet__grid";
        for (const entry of list) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "emoji-sheet__cell";
          cell.dataset.emoji = entry.emoji;
          cell.textContent = entry.emoji;
          cell.setAttribute("aria-label", entry.name);
          grid.appendChild(cell);
        }
        scroll.append(heading, grid);
      }

      function renderBrowse() {
        scroll.replaceChildren();
        const suggested = suggestEmoji(entries, title);
        if (suggested.length) appendSection("Suggested", suggested);
        /** @type {Map<number, EmojiEntry[]>} */
        const groups = new Map();
        for (const entry of entries) {
          if (!groups.has(entry.group)) groups.set(entry.group, []);
          groups.get(entry.group).push(entry);
        }
        for (const [group, list] of groups) {
          appendSection(GROUP_NAMES[group] ?? "More", list);
        }
        syncPickedCells();
      }

      function renderSearch(query) {
        scroll.replaceChildren();
        const hits = searchEmoji(entries, query);
        if (!hits.length) {
          const empty = document.createElement("p");
          empty.className = "emoji-sheet__empty";
          setDisplayText(empty, `No emoji match “${query.trim()}.” Try another word.`);
          scroll.appendChild(empty);
          return;
        }
        appendSection(`Results for “${query.trim()}”`, hits);
        syncPickedCells();
      }

      function render() {
        const query = search.value.trim();
        if (query) renderSearch(query);
        else renderBrowse();
        scroll.scrollTop = 0;
      }

      scroll.addEventListener("click", (event) => {
        const cell = event.target instanceof Element
          ? event.target.closest(".emoji-sheet__cell")
          : null;
        if (cell instanceof HTMLElement && cell.dataset.emoji) choose(cell.dataset.emoji);
      });
      search.addEventListener("input", () => {
        if (entries.length) render();
      });

      renderPickBar();
      const loading = document.createElement("p");
      loading.className = "emoji-sheet__empty";
      setDisplayText(loading, "Loading emoji…");
      scroll.appendChild(loading);

      loadEmojiData()
        .then((loaded) => {
          entries = loaded;
          byEmoji = new Map(loaded.map((entry) => [entry.emoji, entry]));
          renderPickBar();
          render();
        })
        .catch((err) => {
          console.error("Emoji data failed to load:", err);
          setDisplayText(loading, "Couldn’t load emoji. Close and try again.");
        });
    },
  });
  return sheet;
}

/**
 * Text followed by the random emoji pool, kept on one line so it never
 * splits mid-pool.
 * @param {HTMLElement} el @param {string} before @param {string} after
 */
function appendTextWithPool(el, before, after) {
  const lead = document.createElement("span");
  setDisplayText(lead, before);
  const pool = document.createElement("span");
  pool.className = "emoji-sheet__pool";
  pool.textContent = `${formatSecretEmojiPool()}${after}`;
  el.replaceChildren(lead, pool);
}

/** @param {string} text */
function sentenceCase(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}
