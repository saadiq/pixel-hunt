import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { cubeRects, type Rect } from '../src/render/cube';
import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import type { Scene } from '../src/core/types';

const OUT = 'out/scenes';
const SCALE = 12;
const THUMB = 64;
const BOARD = '#d6dde3'; // prototype --board token (light theme), shows through the gaps

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Paints a fractional rect, blending edge pixels by their coverage. */
function fill(png: PNG, r: Rect): void {
  const [cr, cg, cb] = rgb(r.hex);
  const x1 = Math.min(png.width, r.x + r.w), y1 = Math.min(png.height, r.y + r.h);
  for (let y = Math.floor(r.y); y < y1; y++) {
    const fy = Math.min(y + 1, y1) - Math.max(y, r.y);
    for (let x = Math.floor(r.x); x < x1; x++) {
      const a = fy * (Math.min(x + 1, x1) - Math.max(x, r.x));
      const o = (y * png.width + x) * 4;
      png.data[o] += (cr - png.data[o]) * a;
      png.data[o + 1] += (cg - png.data[o + 1]) * a;
      png.data[o + 2] += (cb - png.data[o + 2]) * a;
    }
  }
}

/** Renders the art as raised cubes to a PNG outW pixels wide (same geometry as the in-app canvas). */
function render(s: Scene, outW: number): Buffer {
  const w = s.rows[0].length, h = s.rows.length, cell = outW / w;
  const png = new PNG({ width: outW, height: Math.max(1, Math.round(h * cell)) });
  fill(png, { x: 0, y: 0, w: png.width, h: png.height, hex: BOARD });
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  s.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      for (const r of cubeRects(x * cell, y * cell, cell, s.pal[ch] ?? '#ff00ff')) fill(png, r);
    });
  });
  return PNG.sync.write(png);
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
mkdirSync(OUT, { recursive: true });
for (const id of ids.length ? ids : MANIFEST) {
  const s = SCENES[id];
  if (!s) { console.error(`unknown scene id: ${id}`); process.exitCode = 1; continue; }
  writeFileSync(`${OUT}/${id}.png`, render(s, s.rows[0].length * SCALE));
  writeFileSync(`${OUT}/${id}-thumb.png`, render(s, THUMB));
  console.log(`wrote ${OUT}/${id}.png and ${id}-thumb.png`);
}
