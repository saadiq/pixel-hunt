// Closest colour pairs (CIEDE2000), across every scene and random palette, to calibrate MIN_DE00.
// Usage: bun run colour-pairs
import { PALETTES } from '../src/random/palettes';
import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import { colourPairs, MIN_DE00, paletteHexes, usedColours } from './checks';

const pairs = (where: string, names: string[], hexes: string[]) =>
  colourPairs(names, hexes).map((p) => ({ where, ...p })).sort((x, y) => x.d - y.d);

const scenePairs = MANIFEST.map((id) => {
  const s = SCENES[id], used = Object.keys(usedColours(s));
  return pairs(id, used, used.map((ch) => s.pal[ch]));
});
const palettePairs = PALETTES.map((p) => {
  const hexes = paletteHexes(p);
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
