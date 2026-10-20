// makeScene: a seeded palette, a patterned background and one centerpiece (ported from the prototype).
import type { Art } from '../core/types';
import { ACCENTS, makeCtx } from './backgrounds';
import { MOTIFS } from './motifs';
import { PALETTES, SCENE_NOUNS, SCENE_TYPES, type SceneType } from './palettes';

const CHARS = 'abcdefghijklmnop';
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function makeScene(seed: number, size: number, forceType?: SceneType): Art & { name: string; type: string } {
  const x = makeCtx(seed, size);
  const { W, H, g, pick, shuffle, inb } = x;
  const P = pick(PALETTES), cols = [P.dark, P.light, ...shuffle(P.acc)];
  const type = forceType ?? pick(SCENE_TYPES);
  MOTIFS[type](x, shuffle(ACCENTS), size);
  // Tidy: fold specks (<4 cells) into a neighbor color.
  const count = (): number[] => {
    const n = new Array<number>(cols.length).fill(0);
    for (const v of g) n[v]++;
    return n;
  };
  let n = count();
  for (let c = 0; c < cols.length; c++) {
    if (n[c] === 0 || n[c] >= 4) continue;
    for (let i = 0; i < W * H; i++) {
      if (g[i] !== c) continue;
      const px = i % W, py = (i / W) | 0;
      for (const [a, b] of N4) {
        if (inb(px + a, py + b) && g[(py + b) * W + px + a] !== c) { g[i] = g[(py + b) * W + px + a]; break; }
      }
    }
  }
  n = count();
  const pal: Record<string, string> = {}, map: string[] = [];
  [...n.keys()].filter((c) => n[c] > 0).forEach((c, k) => { map[c] = CHARS[k]; pal[CHARS[k]] = cols[c]; });
  const rows: string[] = [];
  for (let y = 0; y < H; y++) {
    let s = '';
    for (let px = 0; px < W; px++) s += map[g[y * W + px]];
    rows.push(s);
  }
  return { rows, pal, type, name: `${P.name} ${pick(SCENE_NOUNS[type])}` };
}
