import { parseArt, sceneLevel } from '../src/core/board';
import { deal, replayLine } from '../src/core/deal';
import { playout } from '../src/core/playout';
import { mulberry } from '../src/core/rng';
import type { Scene } from '../src/core/types';
import { HEIGHT_RANGE, TARGETS } from './targets';

const MAX_COLORS = 9;
const MIN_CELLS = 4;
const MIN_DELTA_E = 10;
const HEX = /^#[0-9a-f]{6}$/i;

function checkSize(s: Scene, W: number): string[] {
  const errs: string[] = [];
  const [wlo, whi] = TARGETS[s.band].width;
  if (W < wlo || W > whi) errs.push(`width ${W} outside ${s.band} band ${wlo}-${whi}`);
  const [hlo, hhi] = HEIGHT_RANGE;
  if (s.rows.length < hlo || s.rows.length > hhi) errs.push(`height ${s.rows.length} outside ${hlo}-${hhi}`);
  return errs;
}

/** Structural errors: shape, characters, palette, params, band size. */
export function checkStructure(s: Scene): string[] {
  const errs: string[] = [];
  if (!s.rows.length) return ['no rows'];
  const W = s.rows[0].length;
  s.rows.forEach((row, r) => { if (row.length !== W) errs.push(`ragged row ${r}: ${row.length} wide, expected ${W}`); });
  const unknown = new Set<string>();
  for (const row of s.rows) for (const ch of row) if (!(ch in s.pal)) unknown.add(ch);
  if (unknown.size) errs.push(`unknown chars: ${[...unknown].map((c) => JSON.stringify(c)).join(' ')}`);
  for (const [ch, hex] of Object.entries(s.pal)) if (!HEX.test(hex)) errs.push(`bad colour for "${ch}": ${hex}`);
  errs.push(...checkSize(s, W), ...checkParams(s));
  return errs;
}

function checkParams(s: Scene): string[] {
  const errs: string[] = [];
  const [slo, shi] = TARGETS[s.band].slots;
  if (!Number.isInteger(s.slots) || s.slots < 1) errs.push(`bad slots ${s.slots}`);
  else if (s.slots < slo || s.slots > shi) errs.push(`slots ${s.slots} outside ${s.band} band ${slo}-${shi}`);
  if (!Number.isInteger(s.lanes) || s.lanes < 1) errs.push(`bad lanes ${s.lanes}`);
  if (s.chunk[0] < 1 || s.chunk[1] < s.chunk[0]) errs.push(`bad chunk ${s.chunk.join('-')}`);
  return errs;
}

type Lab = [number, number, number];

function toLab(hex: string): Lab {
  const lin = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = lin;
  const xyz = [
    (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047,
    0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883,
  ].map((t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

/** CIE76 colour difference between two #rrggbb colours. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a), [l2, a2, b2] = toLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Colour errors: palette size, tiny colours, near-identical pairs. */
export function checkColors(s: Scene): string[] {
  const errs: string[] = [];
  const counts: Record<string, number> = {};
  for (const row of s.rows) for (const ch of row) counts[ch] = (counts[ch] ?? 0) + 1;
  const used = Object.keys(counts).filter((ch) => ch in s.pal && HEX.test(s.pal[ch]));
  if (used.length > MAX_COLORS) errs.push(`too many colours: ${used.length} (max ${MAX_COLORS})`);
  for (const ch of used) if (counts[ch] < MIN_CELLS) errs.push(`colour "${ch}" has ${counts[ch]} cells (min ${MIN_CELLS})`);
  for (let i = 0; i < used.length; i++) {
    for (let j = i + 1; j < used.length; j++) {
      const d = deltaE(s.pal[used[i]], s.pal[used[j]]);
      if (d < MIN_DELTA_E) errs.push(`colours "${used[i]}" and "${used[j]}" too similar (dE ${d.toFixed(1)})`);
    }
  }
  return errs;
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((x, y) => x - y), m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Deals seeds 1..n. A failure is a deal that throws or whose recorded line does not clear the board. Taps = squad count. */
export function checkDeals(s: Scene, n: number): { failures: number; medianTaps: number; medianMs: number } {
  const level = sceneLevel(s), board = parseArt(s);
  let failures = 0;
  const taps: number[] = [], ms: number[] = [];
  for (let seed = 1; seed <= n; seed++) {
    const t0 = performance.now();
    try {
      const d = deal(level, board, seed);
      ms.push(performance.now() - t0);
      taps.push(d.lanes.reduce((a, l) => a + l.length, 0));
      if (!replayLine(level, board, d)) failures++;
    } catch {
      failures++;
    }
  }
  return { failures, medianTaps: median(taps), medianMs: median(ms) };
}

/** Fraction of n fresh deals (seeds 1..n) that a random-policy playout clears. */
export function estimateWinRate(s: Scene, n: number): number {
  const level = sceneLevel(s), board = parseArt(s);
  let wins = 0;
  for (let seed = 1; seed <= n; seed++) {
    try {
      const d = deal(level, board, seed);
      const rng = mulberry(seed * 7919 + 1);
      if (playout(board.grid, board.W, board.H, Array(level.slots).fill(null), d.lanes, rng, null)) wins++;
    } catch {
      // a throwing deal counts as a loss
    }
  }
  return n ? wins / n : 0;
}
