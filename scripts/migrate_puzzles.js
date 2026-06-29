import fs from 'node:fs/promises';
import path from 'node:path';

const PUZZLES_DIR = './public/puzzles';

function migratePuzzle(old) {
  const glossary = old.glossary ?? {};

  if (old.groups?.[0]?.colors && old.groups[0].words?.[0]?.text) {
    return old;
  }

  return {
    id: old.id,
    title: old.title,
    vignette: old.vignette,
    ...(old.url ? { url: old.url } : {}),
    groups: old.groups.map((g) => {
      const pal = old.palette[g.palette];
      return {
        title: g.category,
        colors: {
          text: pal.fg,
          bg: pal.bg,
          border: pal.accent,
        },
        words: g.words.map((text) => ({
          text,
          definitions: glossary[text] ?? [],
        })),
      };
    }),
  };
}

async function migrateIndex(oldIndex) {
  return {
    defaultId: oldIndex.defaultId,
    puzzles: oldIndex.puzzles.map(({ num, id, file }) => ({ num, id, file })),
  };
}

async function main() {
  const indexPath = path.join(PUZZLES_DIR, 'index.json');
  const index = JSON.parse(await fs.readFile(indexPath, 'utf8'));
  await fs.writeFile(indexPath, JSON.stringify(await migrateIndex(index), null, 2) + '\n');

  const files = await fs.readdir(PUZZLES_DIR);
  for (const file of files.filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const filePath = path.join(PUZZLES_DIR, file);
    const old = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const migrated = migratePuzzle(old);
    await fs.writeFile(filePath, JSON.stringify(migrated, null, 2) + '\n');
    console.log(`Migrated ${file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
