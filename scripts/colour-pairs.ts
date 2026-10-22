// Closest colour pairs (CIEDE2000), across every scene and random palette, to calibrate MIN_DE00.
// Usage: bun run colour-pairs
import { PALETTES } from '../src/random/palettes';
import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import { deltaE2000, MIN_DE00 } from './checks';

interface Pair { where: string; a: string; b: string; ha: string; hb: string; d: number }

function pairs(where: string, names: string[], hexes: string[]): Pair[] {
  const out: Pair[] = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      out.push({ where, a: names[i], b: names[j], ha: hexes[i], hb: hexes[j], d: deltaE2000(hexes[i], hexes[j]) });
    }
  }
  return out.sort((x, y) => x.d - y.d);
}

const scenePairs = MANIFEST.map((id) => {
  const s = SCENES[id], used = [...new Set(s.rows.join(''))];
  return pairs(id, used, used.map((ch) => s.pal[ch]));
});
const palettePairs = PALETTES.map((p) => {
  const hexes = [p.dark, p.light, ...p.acc];
  return pairs(`random:${p.name}`, hexes, hexes);
});
const all = [...scenePairs, ...palettePairs];

console.log('Closest 3 pairs per scene or palette, closest first:');
all.flatMap((ps) => ps.slice(0, 3)).sort((x, y) => x.d - y.d)
  .forEach((p) => console.log(`${p.d.toFixed(1).padStart(5)}  ${p.where.padEnd(22)} ${p.a}=${p.ha}  ${p.b}=${p.hb}`));

console.log(`\nScenes/palettes flagged at each threshold (current ${MIN_DE00}):`);
for (const t of [8, 10, 12, 15, 18]) {
  const hit = all.filter((ps) => ps[0] && ps[0].d < t).map((ps) => ps[0].where);
  console.log(`  < ${String(t).padEnd(3)} ${hit.length}: ${hit.join(', ')}`);
}
