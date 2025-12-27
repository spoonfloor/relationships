export async function loadPuzzle(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  const puzzle = await res.json();
  validatePuzzle(puzzle, url);
  return puzzle;
}

export async function loadPuzzleIndex(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status} ${res.statusText}`);
  const index = await res.json();
  validatePuzzleIndex(index, url);
  return index;
}

function validatePuzzle(p, fileLabel = "puzzle.json") {
  const fail = (msg) => { throw new Error(`[${fileLabel}] ${msg}`); };

  if (!p || typeof p !== "object") fail("Puzzle must be an object");
  if (typeof p.id !== "string" || !p.id.trim()) fail("Puzzle must have a non-empty string id");
  if (!Array.isArray(p.groups)) fail("Puzzle must have 'groups' array");
  if (p.groups.length !== 4) fail(`Puzzle must have 4 groups, got ${p.groups.length}`);

  const allowedColors = new Set(["yellow", "green", "blue", "purple"]);
  const allWords = [];
  const seenGroups = new Set();

  p.groups.forEach((g, gi) => {
    if (!g || typeof g !== "object") fail(`groups[${gi}] must be an object`);
    if (typeof g.category !== "string" || !g.category.trim()) fail(`groups[${gi}].category must be a non-empty string`);
    if (seenGroups.has(g.category)) fail(`Duplicate category: "${g.category}"`);
    seenGroups.add(g.category);

    if (typeof g.color !== "string" || !allowedColors.has(g.color)) {
      fail(`groups[${gi}].color must be one of ${Array.from(allowedColors).join(", ")} (got "${g.color}")`);
    }

    if (!Array.isArray(g.words)) fail(`groups[${gi}].words must be an array`);
    if (g.words.length !== 4) fail(`groups[${gi}] must have 4 words, got ${g.words.length}`);

    g.words.forEach((w, wi) => {
      if (typeof w !== "string" || !w.trim()) fail(`groups[${gi}].words[${wi}] must be a non-empty string`);
      allWords.push(w.trim());
    });
  });

  if (allWords.length !== 16) fail(`Puzzle must contain 16 words total, got ${allWords.length}`);

  const counts = new Map();
  for (const w of allWords) counts.set(w, (counts.get(w) ?? 0) + 1);
  const dups = Array.from(counts.entries()).filter(([, c]) => c > 1);
  if (dups.length) fail(`Duplicate word(s): ${dups.map(([w, c]) => `"${w}" x${c}`).join(", ")}`);

  return true;
}

function validatePuzzleIndex(index, fileLabel = "index.json") {
  const fail = (msg) => { throw new Error(`[${fileLabel}] ${msg}`); };

  if (!index || typeof index !== "object") fail("Index must be an object");
  if (!Array.isArray(index.puzzles)) fail("Index must contain puzzles: []");

  index.puzzles.forEach((p, i) => {
    if (!p || typeof p !== "object") fail(`puzzles[${i}] must be an object`);
    if (typeof p.id !== "string" || !p.id.trim()) fail(`puzzles[${i}].id must be a non-empty string`);
    if (typeof p.file !== "string" || !p.file.trim()) fail(`puzzles[${i}].file must be a non-empty string`);
  });

  const ids = index.puzzles.map(p => p.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) fail(`Duplicate puzzle id(s): ${Array.from(new Set(dupIds)).join(", ")}`);

  return true;
}

