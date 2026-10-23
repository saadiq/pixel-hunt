import { mkdirSync, writeFileSync } from 'node:fs';
import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import { renderScene } from './scene-png';

const OUT = 'out/scenes';
const SCALE = 12;
const THUMB = 64;

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
mkdirSync(OUT, { recursive: true });
for (const id of ids.length ? ids : MANIFEST) {
  const s = SCENES[id];
  if (!s) { console.error(`unknown scene id: ${id}`); process.exitCode = 1; continue; }
  writeFileSync(`${OUT}/${id}.png`, renderScene(s, s.rows[0].length * SCALE));
  writeFileSync(`${OUT}/${id}-thumb.png`, renderScene(s, THUMB));
  console.log(`wrote ${OUT}/${id}.png and ${id}-thumb.png`);
}
