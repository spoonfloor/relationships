import fs from 'node:fs/promises';
import path from 'node:path';
import { hexToRgb, rgbToLab, rgbToHex, deltaE } from '../public/src/color.js';

const PUZZLES_DIR = './public/puzzles';
const MIN_DELTA_E = 20;
const ADJUSTMENT_FACTOR = 0.1;

async function adjustColorsInPuzzles() {
  const files = await fs.readdir(PUZZLES_DIR);
  const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');

  console.log(`Checking ${jsonFiles.length} puzzle files for color contrast...`);

  for (const file of jsonFiles) {
    const filePath = path.join(PUZZLES_DIR, file);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const puzzle = JSON.parse(content);
      let modified = false;

      for (const group of puzzle.groups ?? []) {
        const colors = group.colors;
        if (!colors?.text || !colors?.bg) continue;

        const textRgb = hexToRgb(colors.text);
        const bgRgb = hexToRgb(colors.bg);

        if (!textRgb || !bgRgb) {
          console.warn(`Skipping ${file} - invalid hex code in group "${group.title}"`);
          continue;
        }

        const textLab = rgbToLab(textRgb);
        const bgLab = rgbToLab(bgRgb);
        const dE = deltaE(textLab, bgLab);

        if (dE < MIN_DELTA_E) {
          console.log(`  ${file} - Group "${group.title}" (text: ${colors.text}, bg: ${colors.bg}) has Delta E of ${dE.toFixed(2)}. Adjusting text.`);

          let newTextRgb = { ...textRgb };
          let newTextLab = { ...textLab };
          const targetLab = { ...bgLab };

          if (textLab.L <= bgLab.L) {
            targetLab.L = Math.max(0, bgLab.L - MIN_DELTA_E);
          } else {
            targetLab.L = Math.min(100, bgLab.L + MIN_DELTA_E);
          }

          for (let i = 0; i < 20; i++) {
            newTextLab.L += (targetLab.L - newTextLab.L) * ADJUSTMENT_FACTOR;
            newTextRgb = rgbToHex(newTextLab);
            const adjustedLab = rgbToLab(newTextRgb);
            if (deltaE(adjustedLab, bgLab) >= MIN_DELTA_E) break;
          }

          colors.text = rgbToHex(newTextLab);
          modified = true;
        }
      }

      if (modified) {
        await fs.writeFile(filePath, JSON.stringify(puzzle, null, 2) + '\n');
        console.log(`  Updated ${file}`);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err.message);
    }
  }
}

adjustColorsInPuzzles();
