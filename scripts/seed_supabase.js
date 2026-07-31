import fs from "node:fs/promises";
import path from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://luwnxayrthtyxgxdidtf.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUZZLES_DIR = path.join(process.cwd(), "public/puzzles");

if (!SERVICE_ROLE_KEY) {
  console.error(
    "Set SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → API → service_role).\n" +
      "Example: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seed_supabase.js"
  );
  process.exit(1);
}

async function upsertPuzzles(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/puzzles`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upsert failed (${res.status}): ${body}`);
  }
}

async function upsertConfig(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_config`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Config upsert failed (${res.status}): ${body}`);
  }
}

async function main() {
  const indexPath = path.join(PUZZLES_DIR, "index.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf8"));
  const rows = [];

  for (const entry of index.puzzles) {
    const filePath = path.join(PUZZLES_DIR, entry.file);
    const puzzle = JSON.parse(await fs.readFile(filePath, "utf8"));
    rows.push({
      id: entry.id,
      num: entry.num,
      title: puzzle.title,
      published_data: puzzle,
    });
    console.log(`Prepared ${entry.id}`);
  }

  const debugPath = path.join(PUZZLES_DIR, "debug.json");
  const debugPuzzle = JSON.parse(await fs.readFile(debugPath, "utf8"));
  rows.push({
    id: "debug",
    num: 0,
    title: debugPuzzle.title,
    published_data: debugPuzzle,
  });
  console.log("Prepared debug");

  await upsertPuzzles(rows);
  await upsertConfig([
    { key: "default_puzzle_id", value: index.defaultId ?? index.puzzles[0]?.id },
  ]);
  console.log(`Seeded ${rows.length} puzzles as published.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
