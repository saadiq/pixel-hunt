import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import type { Scene } from '../src/core/types';

const OUT = 'out/scenes';
const SCALE = 8;
const THUMB = 64;

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Renders the art to a PNG of outW x outH using nearest-neighbour sampling. */
function render(s: Scene, outW: number, outH: number): Buffer {
  const w = s.rows[0].length, h = s.rows.length;
  const png = new PNG({ width: outW, height: outH });
  for (let y = 0; y < outH; y++) {
    const row = s.rows[Math.min(h - 1, Math.floor((y * h) / outH))];
    for (let x = 0; x < outW; x++) {
      const [r, g, b] = rgb(s.pal[row[Math.min(w - 1, Math.floor((x * w) / outW))]] ?? '#ff00ff');
      const o = (y * outW + x) * 4;
      png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
mkdirSync(OUT, { recursive: true });
for (const id of ids.length ? ids : MANIFEST) {
  const s = SCENES[id];
  if (!s) { console.error(`unknown scene id: ${id}`); process.exitCode = 1; continue; }
  const w = s.rows[0].length, h = s.rows.length;
  writeFileSync(`${OUT}/${id}.png`, render(s, w * SCALE, h * SCALE));
  writeFileSync(`${OUT}/${id}-thumb.png`, render(s, THUMB, Math.max(1, Math.round((THUMB * h) / w))));
  console.log(`wrote ${OUT}/${id}.png and ${id}-thumb.png`);
}
