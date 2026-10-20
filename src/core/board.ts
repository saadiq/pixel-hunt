import type { Art, Board, Level, Scene } from './types';

export function parseArt(a: Art): Board {
  const chars = Object.keys(a.pal);
  const H = a.rows.length;
  const W = a.rows[0].length;
  const grid = new Int8Array(W * H);
  a.rows.forEach((row, r) => [...row].forEach((ch, c) => { grid[r * W + c] = chars.indexOf(ch); }));
  return { W, H, grid, colors: chars.map((ch) => a.pal[ch]) };
}

export function sceneLevel(s: Scene): Level {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the blurb is display-only, not part of a level
  const { id, blurb, ...rest } = s;
  return { key: id, ...rest };
}
