function validateColors(colors, label, fail) {
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
    fail(`${label}.colors must be an object`);
  }
  for (const key of ["text", "bg", "border"]) {
    if (colors[key] != null && typeof colors[key] !== "string") {
      fail(`${label}.colors.${key} must be a string (hex) if present`);
    }
  }
}

export function validatePuzzle(p, fileLabel = "puzzle.json") {
  const fail = (msg) => { throw new Error(`[${fileLabel}] ${msg}`); };

  if (!p || typeof p !== "object") fail("Puzzle must be an object");
  if (typeof p.id !== "string" || !p.id.trim()) fail("Puzzle must have a non-empty string id");
  if (typeof p.title !== "string" || !p.title.trim()) fail("Puzzle must have a non-empty string title");
  if (typeof p.vignette !== "string") fail("Puzzle must have a vignette string");

  if (!Array.isArray(p.groups)) fail("Puzzle must have 'groups' array");
  if (p.groups.length !== 4) fail(`Puzzle must have 4 groups, got ${p.groups.length}`);

  const allWords = [];
  const seenTitles = new Set();

  p.groups.forEach((g, gi) => {
    if (!g || typeof g !== "object") fail(`groups[${gi}] must be an object`);

    if (typeof g.title !== "string" || !g.title.trim()) {
      fail(`groups[${gi}].title must be a non-empty string`);
    }
    if (seenTitles.has(g.title)) fail(`Duplicate group title: "${g.title}"`);
    seenTitles.add(g.title);

    validateColors(g.colors, `groups[${gi}]`, fail);

    if (!Array.isArray(g.words)) fail(`groups[${gi}].words must be an array`);
    if (g.words.length !== 4) fail(`groups[${gi}] must have 4 words, got ${g.words.length}`);

    g.words.forEach((w, wi) => {
      if (!w || typeof w !== "object") fail(`groups[${gi}].words[${wi}] must be an object`);
      if (typeof w.text !== "string" || !w.text.trim()) {
        fail(`groups[${gi}].words[${wi}].text must be a non-empty string`);
      }
      if (w.definitions != null) {
        if (!Array.isArray(w.definitions)) {
          fail(`groups[${gi}].words[${wi}].definitions must be an array if present`);
        }
        w.definitions.forEach((def, di) => {
          if (typeof def !== "string") {
            fail(`groups[${gi}].words[${wi}].definitions[${di}] must be a string`);
          }
        });
      }
      allWords.push(w.text.trim());
    });
  });

  if (allWords.length !== 16) fail(`Puzzle must contain 16 words total, got ${allWords.length}`);

  const counts = new Map();
  for (const w of allWords) counts.set(w, (counts.get(w) ?? 0) + 1);
  const dups = Array.from(counts.entries()).filter(([, c]) => c > 1);
  if (dups.length) {
    fail(`Duplicate word(s): ${dups.map(([w, c]) => `"${w}" x${c}`).join(", ")}`);
  }

  return true;
}

export function validatePuzzleIndex(index, fileLabel = "index.json") {
  const fail = (msg) => { throw new Error(`[${fileLabel}] ${msg}`); };

  if (!index || typeof index !== "object") fail("Index must be an object");
  if (!Array.isArray(index.puzzles)) fail("Index must contain puzzles: []");

  index.puzzles.forEach((p, i) => {
    if (!p || typeof p !== "object") fail(`puzzles[${i}] must be an object`);
    if (typeof p.id !== "string" || !p.id.trim()) fail(`puzzles[${i}].id must be a non-empty string`);
    if (typeof p.file !== "string" || !p.file.trim()) fail(`puzzles[${i}].file must be a non-empty string`);
  });

  const ids = index.puzzles.map((p) => p.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) fail(`Duplicate puzzle id(s): ${Array.from(new Set(dupIds)).join(", ")}`);

  return true;
}
