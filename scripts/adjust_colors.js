import fs from 'node:fs/promises';
import path from 'node:path';
import { hexToRgb, rgbToLab, rgbToHex, deltaE } from '../public/src/color.js';

const PUZZLES_DIR = './public/puzzles';
const MIN_DELTA_E = 20; // Threshold for perceived color difference
const ADJUSTMENT_FACTOR = 0.1; // Modest adjustment for L component

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

      if (puzzle.palette) {
        for (const key in puzzle.palette) {
          const entry = puzzle.palette[key];
          if (entry.fg && entry.bg) {
            const fgRgb = hexToRgb(entry.fg);
            const bgRgb = hexToRgb(entry.bg);

            if (!fgRgb || !bgRgb) {
              console.warn(`Skipping ${file} - invalid hex code in palette entry ${key}`);
              continue;
            }

            const fgLab = rgbToLab(fgRgb);
            const bgLab = rgbToLab(bgRgb);
            const dE = deltaE(fgLab, bgLab);

            if (dE < MIN_DELTA_E) {
              console.log(`  ${file} - Palette entry "${key}" (FG: ${entry.fg}, BG: ${entry.bg}) has Delta E of ${dE.toFixed(2)}. Adjusting FG.`);

              // Adjust foreground color slightly to increase contrast
              let newFgRgb = { ...fgRgb };
              let newFgLab = { ...fgLab };

              // Try to increase lightness difference
              if (fgLab.l > bgLab.l) {
                // FG is lighter, try to make it even lighter
                newFgLab.l = Math.min(100, fgLab.l + (100 - fgLab.l) * ADJUSTMENT_FACTOR);
              } else {
                // FG is darker, try to make it even darker
                newFgLab.l = Math.max(0, fgLab.l - (fgLab.l) * ADJUSTMENT_FACTOR);
              }
              
              // Simple conversion from LAB to RGB (approximation, full conversion is complex)
              // For a simple adjustment, we'll just try to change the L value and convert back.
              // This is a simplified approach, a full LAB-to-RGB conversion is more involved.
              // For this task, we will make a small adjustment to the RGB values directly,
              // as a full LAB-RGB conversion might be too complex to implement here directly
              // without a proper library.
              // Instead, we will directly adjust the RGB values in a direction that
              // increases contrast based on initial lightness comparison.

              const lDiff = fgLab.l - bgLab.l;

              // Adjust RGB components to move lightness away from background
              newFgRgb.r = Math.max(0, Math.min(255, fgRgb.r + (lDiff > 0 ? 255 - fgRgb.r : -fgRgb.r) * ADJUSTMENT_FACTOR));
              newFgRgb.g = Math.max(0, Math.min(255, fgRgb.g + (lDiff > 0 ? 255 - fgRgb.g : -fgRgb.g) * ADJUSTMENT_FACTOR));
              newFgRgb.b = Math.max(0, Math.min(255, fgRgb.b + (lDiff > 0 ? 255 - fgRgb.b : -fgRgb.b) * ADJUSTMENT_FACTOR));

              const adjustedFgHex = rgbToHex(
                Math.round(newFgRgb.r),
                Math.round(newFgRgb.g),
                Math.round(newFgRgb.b)
              );
              
              const newDE = deltaE(rgbToLab(hexToRgb(adjustedFgHex)), bgLab);
              console.log(`    Adjusted FG to ${adjustedFgHex}, new Delta E: ${newDE.toFixed(2)}`);

              entry.fg = adjustedFgHex;
              modified = true;
            }
          }
        }
      }

      if (modified) {
        await fs.writeFile(filePath, JSON.stringify(puzzle, null, 2), 'utf8');
        console.log(`  ${file} modified.`);
      } else {
        console.log(`  ${file} no changes needed.`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }
  console.log('Color adjustment process complete.');
}

adjustColorsInPuzzles();
