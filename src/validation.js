/**
 * @fileoverview Copyright 2025 Ed Korthof and Cristie Henry
 */

export function validatePuzzle(p, fileLabel = "puzzle.json") {
  const fail = (msg) => { throw new Error(`[${fileLabel}] ${msg}`); };

  if (!p || typeof p !== "object") fail("Puzzle must be an object");
  if (typeof p.id !== "string" || !p.id.trim()) fail("Puzzle must have a non-empty string id");

  // Palette must exist (object of named entries)
  if (!p.palette || typeof p.palette !== "object" || Array.isArray(p.palette)) {
    fail("Puzzle must have a palette object (e.g. {\"a\": {\"bg\":\"#...\",\"fg\":\"#...\"}, ...})");
  }

  const paletteKeys = Object.keys(p.palette);
  if (paletteKeys.length < 1) fail("palette must have at least one entry");

  // Validate palette entries (lightweight; you can tighten later)
  for (const [k, entry] of Object.entries(p.palette)) {
    if (!k || typeof k !== "string") fail("palette keys must be strings");
    if (!entry || typeof entry !== "object") fail(`palette["${k}"] must be an object`);
    if (entry.bg != null && typeof entry.bg !== "string") fail(`palette["${k}"].bg must be a string (hex) if present`);
    if (entry.fg != null && typeof entry.fg !== "string") fail(`palette["${k}"].fg must be a string (hex) if present`);
    if (entry.name != null && typeof entry.name !== "string") fail(`palette["${k}"].name must be a string if present`);
  }

  if (!Array.isArray(p.groups)) fail("Puzzle must have 'groups' array");
  if (p.groups.length !== 4) fail(`Puzzle must have 4 groups, got ${p.groups.length}`);

  const allWords = [];
  const seenCategories = new Set();

  p.groups.forEach((g, gi) => {
    if (!g || typeof g !== "object") fail(`groups[${gi}] must be an object`);

    if (typeof g.category !== "string" || !g.category.trim()) {
      fail(`groups[${gi}].category must be a non-empty string`);
    }
    if (seenCategories.has(g.category)) fail(`Duplicate category: "${g.category}"`);
    seenCategories.add(g.category);

    // Your schema: group.palette references a key in puzzle.palette
    if (typeof g.palette !== "string" || !g.palette.trim()) {
      fail(`groups[${gi}].palette must be a non-empty string (palette key)`);
    }
    if (!(g.palette in p.palette)) {
      fail(`groups[${gi}].palette="${g.palette}" not found in puzzle.palette keys: ${paletteKeys.join(", ")}`);
    }

    if (!Array.isArray(g.words)) fail(`groups[${gi}].words must be an array`);
    if (g.words.length !== 4) fail(`groups[${gi}] must have 4 words, got ${g.words.length}`);

    g.words.forEach((w, wi) => {
      if (typeof w !== "string" || !w.trim()) {
        fail(`groups[${gi}].words[${wi}] must be a non-empty string`);
      }
      allWords.push(w.trim());
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
