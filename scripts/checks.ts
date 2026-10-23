import { parseArt, sceneLevel } from '../src/core/board';
import { deal, replayLine } from '../src/core/deal';
import { mulberry } from '../src/core/rng';
import { hexRgb } from '../src/render/cube';
import type { Palette } from '../src/random/palettes';
import type { Scene } from '../src/core/types';
import { playout } from './playout';
import { HEIGHT_RANGE, TARGETS, WIDTH_RANGE } from '../src/core/targets';

const MAX_COLORS = 9;
const MIN_CELLS = 4;
/**
 * Lowest CIEDE2000 difference between two colours of one board. A lane tile and a cube's face both
 * show the colour's own hex, so that is the pair a player compares. Provisional: set at the checkpoint.
 */
export const MIN_DE00 = 12;
const HEX = /^#[0-9a-f]{6}$/i;

function checkSize(s: Scene, W: number): string[] {
  const errs: string[] = [];
  const [wlo, whi] = WIDTH_RANGE;
  if (W < wlo || W > whi) errs.push(`width ${W} outside ${wlo}-${whi}`);
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
  else if (s.slots < slo || s.slots > shi) errs.push(`slots ${s.slots} outside ${s.band} band ${slo === shi ? slo : `${slo}-${shi}`}`);
  if (!Number.isInteger(s.lanes) || s.lanes < 1) errs.push(`bad lanes ${s.lanes}`);
  if (s.chunk[0] < 1 || s.chunk[1] < s.chunk[0]) errs.push(`bad chunk ${s.chunk.join('-')}`);
  if (s.waitSlack !== undefined && (!Number.isInteger(s.waitSlack) || s.waitSlack < 0)) errs.push(`bad waitSlack ${s.waitSlack}`);
  return errs;
}

type Lab = [number, number, number];

function toLab(hex: string): Lab {
  const lin = hexRgb(hex).map((c) => {
    const v = c / 255;
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

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => { const d = (r * 180) / Math.PI; return d < 0 ? d + 360 : d; };

/** CIEDE2000 difference between two CIELAB colours (Sharma, Wu and Dalal, 2005). */
export function labDelta2000([L1, a1, b1]: Lab, [L2, a2, b2]: Lab): number {
  const C7 = (((Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2) ** 7);
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + 25 ** 7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp1 = Cp1 ? deg(Math.atan2(b1, ap1)) : 0, hp2 = Cp2 ? deg(Math.atan2(b2, ap2)) : 0;
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = 0;
  if (Cp1 * Cp2) dh = Math.abs(hp2 - hp1) <= 180 ? hp2 - hp1 : hp2 - hp1 > 180 ? hp2 - hp1 - 360 : hp2 - hp1 + 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin(rad(dh / 2));
  const Lm = (L1 + L2) / 2, Cm = (Cp1 + Cp2) / 2;
  let hm = hp1 + hp2;
  if (Cp1 * Cp2) hm = Math.abs(hp1 - hp2) <= 180 ? hm / 2 : hm < 360 ? (hm + 360) / 2 : (hm - 360) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hm - 30)) + 0.24 * Math.cos(rad(2 * hm)) + 0.32 * Math.cos(rad(3 * hm + 6)) - 0.2 * Math.cos(rad(4 * hm - 63));
  const Cm7 = Cm ** 7, RC = 2 * Math.sqrt(Cm7 / (Cm7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), SC = 1 + 0.045 * Cm, SH = 1 + 0.015 * Cm * T;
  const RT = -Math.sin(rad(60 * Math.exp(-(((hm - 275) / 25) ** 2)))) * RC;
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH));
}

/** CIEDE2000 difference between two #rrggbb colours. */
export const deltaE2000 = (a: string, b: string): number => labDelta2000(toLab(a), toLab(b));

export interface ColourPair { a: string; b: string; ha: string; hb: string; d: number }

/** Every pair of colours with its CIEDE2000 difference, in input order. */
export function colourPairs(names: string[], hexes: string[]): ColourPair[] {
  const out: ColourPair[] = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      out.push({ a: names[i], b: names[j], ha: hexes[i], hb: hexes[j], d: deltaE2000(hexes[i], hexes[j]) });
    }
  }
  return out;
}

/** Pairs of colours too close to tell apart as drawn, as error strings. */
const similarPairs = (names: string[], hexes: string[]): string[] => colourPairs(names, hexes)
  .filter((p) => p.d < MIN_DE00).map((p) => `colours "${p.a}" and "${p.b}" too similar (dE00 ${p.d.toFixed(1)})`);

/** Cell count per palette letter a scene actually draws with (letters with a valid hex only). */
export function usedColours(s: Scene): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of s.rows) for (const ch of row) if (ch in s.pal && HEX.test(s.pal[ch])) counts[ch] = (counts[ch] ?? 0) + 1;
  return counts;
}

/** A random-mode palette's colours. */
export const paletteHexes = (p: Palette): string[] => [p.dark, p.light, ...p.acc];

/** Colour errors: palette size, tiny colours, pairs too close to tell apart (background included). */
export function checkColors(s: Scene): string[] {
  const errs: string[] = [];
  const counts = usedColours(s), used = Object.keys(counts);
  if (used.length > MAX_COLORS) errs.push(`too many colours: ${used.length} (max ${MAX_COLORS})`);
  for (const ch of used) if (counts[ch] < MIN_CELLS) errs.push(`colour "${ch}" has ${counts[ch]} cells (min ${MIN_CELLS})`);
  return [...errs, ...similarPairs(used, used.map((ch) => s.pal[ch]))];
}

/** Random-mode palette errors: any two of its colours too close to tell apart. */
export function checkPalette(p: Palette): string[] {
  const hexes = paletteHexes(p);
  return similarPairs(hexes, hexes);
}

export function median(xs: number[]): number {
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
      taps.push(d.line.length);
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
      if (playout(board.grid, board.W, board.H, Array(level.slots).fill(null), d.lanes, rng)) wins++;
    } catch {
      // a throwing deal counts as a loss
    }
  }
  return n ? wins / n : 0;
}
