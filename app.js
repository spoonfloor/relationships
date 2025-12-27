// --- Minimal Connections-style prototype ---
// You can replace these with your real puzzle data later.
// For now, we keep a "truth set" list so Submit can validate.

const PUZZLES = [
  {
    id: "demo-1",
    groups: [
      { color: "yellow", category: "DOG BREEDS", words: ["BEAGLE", "POODLE", "BASSET", "BOXER"] },
      { color: "green",  category: "UNIT TEST TERMS", words: ["MOCK", "STUB", "FIXTURE", "ASSERT"] },
      { color: "blue",   category: "THINGS YOU CAN DEPLOY", words: ["SERVICE", "FUNCTION", "CONTAINER", "PIPELINE"] },
      { color: "purple", category: "WORDS WITH SILENT 'K'", words: ["KNIFE", "KNEE", "KNOT", "KNIGHT"] },
    ],
  },
];

// A larger pool to randomize "display 16 chosen words".
// In real life you'd pick a puzzle and use its 16, but this keeps it flexible.
const WORD_POOL = [
  "BEAGLE","POODLE","BASSET","BOXER",
  "MOCK","STUB","FIXTURE","ASSERT",
  "SERVICE","FUNCTION","CONTAINER","PIPELINE",
  "KNIFE","KNEE","KNOT","KNIGHT",
  // extras (unused in demo but helpful if you want random selection later)
  "CACHE","QUEUE","TOPIC","VECTOR","SPARK","ELIXIR","RUST","SWIFT"
];

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const foundEl = document.getElementById("foundGroups");

const newGameBtn = document.getElementById("newGameBtn");
const shuffleBtn = document.getElementById("shuffleBtn");
const clearBtn = document.getElementById("clearBtn");
const submitBtn = document.getElementById("submitBtn");
const hintCategoryBtn = document.getElementById("hintCategoryBtn");
const hintWordBtn = document.getElementById("hintWordBtn");

let activePuzzle = PUZZLES[0];
let boardWords = [];              // { word, lockedColor:null|color }
let selected = new Set();         // word strings
let foundGroups = [];             // groups found (same shape as activePuzzle.groups)
let revealedCategories = new Set(); // group indices

function shuffle(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setStatus(msg){
  statusEl.textContent = msg;
}

function pick16Words(){
  // For now: use the puzzle's exact 16 words (so validation makes sense).
  const w = activePuzzle.groups.flatMap(g => g.words);
  return shuffle(w);
}

function initGame(){
  foundGroups = [];
  revealedCategories.clear();
  selected.clear();
  foundEl.innerHTML = "";

  boardWords = pick16Words().map(word => ({ word, lockedColor: null }));

  renderBoard();
  setStatus("Pick 4 words.");
}

function renderBoard(){
  boardEl.innerHTML = "";
  for (const item of boardWords){
    const btn = document.createElement("button");
    btn.className = "word";
    btn.type = "button";
    btn.textContent = item.word;

    if (selected.has(item.word)) btn.classList.add("selected");

    if (item.lockedColor){
      btn.classList.add("locked", `lock-${item.lockedColor}`);
      btn.disabled = true;
    } else {
      btn.addEventListener("click", () => toggleSelect(item.word));
    }

    boardEl.appendChild(btn);
  }
}

function toggleSelect(word){
  if (selected.has(word)) {
    selected.delete(word);
  } else {
    if (selected.size >= 4) {
      setStatus("You can only select 4 at a time.");
      return;
    }
    selected.add(word);
  }
  setStatus(`${selected.size} selected.`);
  renderBoard();
}

function getGroupBySelectedWords(wordsArr){
  const sel = new Set(wordsArr);
  return activePuzzle.groups.find(g => g.words.every(w => sel.has(w)));
}

function lockWords(wordsArr, color){
  for (const item of boardWords){
    if (wordsArr.includes(item.word)){
      item.lockedColor = color;
    }
  }
}

function addFoundGroupCard(group){
  const card = document.createElement("div");
  card.className = "groupCard";
  const title = document.createElement("div");
  title.className = "groupTitle";
  title.textContent = `${group.category} (${group.color.toUpperCase()})`;
  const words = document.createElement("div");
  words.className = "groupWords";
  words.textContent = group.words.join(" · ");
  card.appendChild(title);
  card.appendChild(words);
  foundEl.appendChild(card);
}

function submitSelection(){
  if (selected.size !== 4){
    setStatus("Select exactly 4 words.");
    return;
  }

  const words = Array.from(selected);
  const group = getGroupBySelectedWords(words);

  if (!group) {
    setStatus("Nope — those 4 don't form a group (in this demo puzzle).");
    return;
  }

  // Already found?
  const already = foundGroups.some(g => g.category === group.category);
  if (already){
    setStatus("You already found that group.");
    selected.clear();
    renderBoard();
    return;
  }

  foundGroups.push(group);
  lockWords(group.words, group.color);
  addFoundGroupCard(group);

  selected.clear();
  renderBoard();

  if (foundGroups.length === 4){
    setStatus("Solved! 🎉");
  } else {
    setStatus(`Correct! ${4 - foundGroups.length} groups left.`);
  }
}

function assignColorToSelection(color){
  // This is a lightweight UX feature: in the NYT game colors are difficulty tiers.
  // Here we let you "tag" a found group manually only if it's correct.
  if (selected.size !== 4){
    setStatus("Select exactly 4 words to assign a color.");
    return;
  }
  const words = Array.from(selected);
  const group = getGroupBySelectedWords(words);
  if (!group){
    setStatus("That selection isn't a correct group (demo).");
    return;
  }
  // Force color assignment (optional behavior)
  const forced = { ...group, color };
  // mark as found
  const already = foundGroups.some(g => g.category === group.category);
  if (!already){
    foundGroups.push(forced);
    lockWords(forced.words, forced.color);
    addFoundGroupCard(forced);
  }
  selected.clear();
  renderBoard();
  setStatus(`Locked as ${color.toUpperCase()}.`);
}

function hintRevealCategory(){
  // Reveal one not-yet-revealed category name
  const remaining = activePuzzle.groups
    .map((g, idx) => ({ g, idx }))
    .filter(({ g, idx }) => !foundGroups.some(f => f.category === g.category) && !revealedCategories.has(idx));

  if (remaining.length === 0){
    setStatus("No categories left to reveal.");
    return;
  }

  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  revealedCategories.add(pick.idx);
  setStatus(`Hint: One category is “${pick.g.category}”.`);
}

function hintRevealWord(){
  // Reveal (auto-select) one word that belongs to a not-yet-found group.
  // If you already have 4 selected, clear first.
  if (selected.size >= 4) selected.clear();

  const remainingGroups = activePuzzle.groups.filter(
    g => !foundGroups.some(f => f.category === g.category)
  );

  if (remainingGroups.length === 0){
    setStatus("No words left to reveal.");
    return;
  }

  const g = remainingGroups[Math.floor(Math.random() * remainingGroups.length)];
  const unlockedWords = g.words.filter(w => {
    const item = boardWords.find(b => b.word === w);
    return item && !item.lockedColor;
  });

  if (unlockedWords.length === 0){
    setStatus("No revealable words in remaining groups.");
    return;
  }

  const w = unlockedWords[Math.floor(Math.random() * unlockedWords.length)];
  selected.add(w);
  renderBoard();
  setStatus(`Hint: selected “${w}”.`);
}

// --- Wire up UI ---
newGameBtn.addEventListener("click", initGame);
shuffleBtn.addEventListener("click", () => {
  // only shuffle unlocked words positions
  const locked = boardWords.filter(b => b.lockedColor);
  const unlocked = shuffle(boardWords.filter(b => !b.lockedColor));
  boardWords = shuffle([...unlocked, ...locked]); // simple: keep locked at end; tweak if you want
  renderBoard();
  setStatus("Shuffled.");
});
clearBtn.addEventListener("click", () => {
  selected.clear();
  renderBoard();
  setStatus("Selection cleared.");
});
submitBtn.addEventListener("click", submitSelection);

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => assignColorToSelection(chip.dataset.color));
});

hintCategoryBtn.addEventListener("click", hintRevealCategory);
hintWordBtn.addEventListener("click", hintRevealWord);

// Start
initGame();

