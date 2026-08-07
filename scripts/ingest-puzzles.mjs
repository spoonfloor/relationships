#!/usr/bin/env node
/**
 * Parse puzzles-for-upload-formatted.txt and upsert into Supabase.
 * Usage: node scripts/ingest-puzzles.mjs [path-to-formatted.txt]
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SUPABASE_URL = "https://luwnxayrthtyxgxdidtf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_aCema0LZQvoWiXViaU0o2g_zggnBjoY";
const DEBUG_ID = "debug";
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const inputPath =
  process.argv[2] ?? "/Users/erichenry/Desktop/puzzles-for-upload-formatted.txt";

function slugFromTitle(title) {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "puzzle";
}

function uniqueSlug(base, taken) {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function parseGlossaryText(text) {
  const entries = [];
  let current = null;

  function pushCurrent() {
    if (!current) return;
    entries.push(current);
    current = null;
  }

  for (const line of String(text ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("-")) {
      const definition = trimmed.slice(1).trim();
      if (!definition) continue;
      if (!current) current = { term: null, definitions: [] };
      current.definitions.push(definition);
      continue;
    }

    pushCurrent();
    current = { term: trimmed, definitions: [] };
  }

  pushCurrent();
  entries.sort((a, b) =>
    (a.term ?? "").localeCompare(b.term ?? "", undefined, { sensitivity: "base" })
  );
  return entries;
}

function parseDocument(text) {
  const puzzles = [];
  for (const block of text.split("===")) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    const lines = trimmed.split(/\r?\n/);
    const titleLine = lines[0];
    if (!titleLine.startsWith("### ")) {
      throw new Error(`Expected ### title, got: ${titleLine.slice(0, 60)}`);
    }
    const title = titleLine.slice(4).trim();

    let i = 1;
    const vignetteLines = [];
    while (i < lines.length && !lines[i].startsWith("## ")) {
      vignetteLines.push(lines[i]);
      i += 1;
    }
    const vignette = vignetteLines.join("\n").trim();

    const sets = [];
    while (i < lines.length) {
      if (lines[i].startsWith("# Glossary")) break;
      if (!lines[i].startsWith("## ")) {
        i += 1;
        continue;
      }

      const setTitle = lines[i].slice(3).trim();
      i += 1;
      if (i >= lines.length || !lines[i].startsWith("bg:")) {
        throw new Error(`Set "${setTitle}" missing bg: line`);
      }
      const bg = lines[i].slice(3).trim();
      i += 1;
      if (i >= lines.length || !lines[i].startsWith("text:")) {
        throw new Error(`Set "${setTitle}" missing text: line`);
      }
      const textColor = lines[i].slice(5).trim();
      i += 1;

      const words = [];
      while (
        i < lines.length &&
        !lines[i].startsWith("## ") &&
        !lines[i].startsWith("# Glossary")
      ) {
        const word = lines[i].trim();
        if (word) words.push(word);
        i += 1;
      }

      if (words.length !== 4) {
        throw new Error(
          `Set "${setTitle}" in "${title}" has ${words.length} words (expected 4)`
        );
      }
      if (!HEX_RE.test(bg) || !HEX_RE.test(textColor)) {
        throw new Error(
          `Set "${setTitle}" in "${title}" has invalid colors: bg=${bg} text=${textColor}`
        );
      }

      sets.push({ title: setTitle, bg, text: textColor, words });
    }

    if (sets.length !== 4) {
      throw new Error(`"${title}" has ${sets.length} sets (expected 4)`);
    }

    let glossary = [];
    if (i < lines.length && lines[i].startsWith("# Glossary")) {
      i += 1;
      const glossaryBody = lines.slice(i).join("\n");
      glossary = parseGlossaryText(glossaryBody);
    }

    puzzles.push({ title, vignette, sets, glossary });
  }

  return puzzles;
}

function toPublishedData(puzzle, id) {
  return {
    id,
    title: puzzle.title,
    vignette: puzzle.vignette,
    glossary: puzzle.glossary,
    groups: puzzle.sets.map((set) => ({
      title: set.title,
      colors: { text: set.text, bg: set.bg },
      words: set.words.map((text) => ({ text, definitions: [] })),
    })),
  };
}

async function supabaseRequest(path, { method = "GET", body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`${method} ${path} failed (${res.status}): ${detail}`);
  }

  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const raw = readFileSync(inputPath, "utf8");
  const parsed = parseDocument(raw);
  console.log(`Parsed ${parsed.length} puzzles from ${inputPath}`);

  const taken = new Set([DEBUG_ID]);
  const rows = parsed.map((puzzle, index) => {
    const base = slugFromTitle(puzzle.title);
    const id = uniqueSlug(base, taken);
    taken.add(id);
    const published_data = toPublishedData(puzzle, id);
    return {
      id,
      num: index + 1,
      title: puzzle.title,
      published_data,
      draft_data: null,
      draft_updated_at: null,
    };
  });

  for (const row of rows) {
    const words = row.published_data.groups.flatMap((g) =>
      g.words.map((w) => w.text)
    );
    const dup = words.find((w, i) => words.indexOf(w) !== i);
    if (dup) {
      throw new Error(`Duplicate tile "${dup}" in puzzle "${row.title}"`);
    }
  }

  console.log("Deleting non-debug puzzles…");
  await supabaseRequest(`puzzles?id=neq.${encodeURIComponent(DEBUG_ID)}`, {
    method: "DELETE",
    prefer: "return=minimal",
  });

  console.log(`Inserting ${rows.length} puzzles…`);
  const batchSize = 10;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await supabaseRequest("puzzles", {
      method: "POST",
      body: batch,
      prefer: "return=minimal",
    });
    console.log(`  inserted ${Math.min(i + batchSize, rows.length)}/${rows.length}`);
  }

  const verify = await supabaseRequest("puzzles?select=id");
  const debugKept = (verify ?? []).some((r) => r.id === DEBUG_ID);
  console.log(`\nDone. ${rows.length} puzzles uploaded.`);
  console.log(`Total rows in DB: ${verify?.length ?? 0} (debug kept: ${debugKept})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
