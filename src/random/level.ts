import { parseArt } from '../core/board';
import { deal } from '../core/deal';
import type { Band, Level, Params } from '../core/types';
import { makeScene } from './scene';

type BandSpec = Omit<Params, 'chunk'> & { size: number };

export const RANDOM_BANDS: Record<Band, BandSpec> = {
  easy: { size: 42, slots: 5, lanes: 3, wait: 0.3 },
  medium: { size: 48, slots: 4, lanes: 4, wait: 0.5 },
  hard: { size: 54, slots: 3, lanes: 4, wait: 0.85 },
};

export const randomKey = (band: Band, seed: number): string => `r-${band}-${seed}`;

const TARGET = 45;
/** Starting squad-size multiplier per band, from measured calibrations, so most levels need no second pass. */
const START: Record<Band, number> = { easy: 1.5, medium: 1.5, hard: 2.0 };
const chunkFor = (avg: number): [number, number] => [Math.max(1, Math.round(avg * 0.75)), Math.max(1, Math.round(avg * 1.25))];

const PROBES = 4, LO = 36, HI = 54, ATTEMPTS = 2;

interface Built { level: Level; spread: number; ok: boolean; loose: boolean }

/** Builds a level for one scene variant, calibrating squad size so a deal takes about 45 taps. */
function build(band: Band, seed: number, variant: number): Built {
  const { size, slots, lanes, wait } = RANDOM_BANDS[band];
  const art = makeScene(seed + variant * 104729, size);
  const make = (avg: number): Level =>
    ({ key: randomKey(band, seed), name: art.name, band, rows: art.rows, pal: art.pal, slots, lanes, wait, chunk: chunkFor(avg) });
  const board = parseArt(art);
  // A single deal's tap count is noisy, so probe several deals.
  const probe = (l: Level, n: number): number[] => Array.from({ length: n }, (_, k) => deal(l, board, seed + k * 7919).line.length);
  const mean = (t: number[]): number => t.reduce((a, b) => a + b, 0) / t.length;
  const inWindow = (t: number[]): boolean => Math.min(...t) >= LO && Math.max(...t) <= HI;
  let avg = Math.max(1, (size * size * START[band]) / TARGET), level = make(avg), taps = probe(level, PROBES);
  if (!(mean(taps) >= 41 && mean(taps) <= 49 && inWindow(taps))) {
    let m = mean(taps);
    for (let pass = 0; pass < 3; pass++) {
      avg = Math.max(1, Math.round((avg * m) / TARGET));
      level = make(avg);
      if (pass === 2) break;
      m = mean(probe(level, 2));
      if (m >= 41 && m <= 49) break;
    }
    taps = probe(level, PROBES);
  }
  const spread = Math.max(...taps.map((t) => Math.abs(t - TARGET)));
  return { level, spread, ok: inWindow(taps), loose: Math.min(...taps) >= 30 && Math.max(...taps) <= 60 };
}

/**
 * A random scene as a playable level, deterministic per (band, seed). Squad caps are limited by
 * reachable cells, so squad size is calibrated by dealing; a scene whose deals vary too much in
 * length is swapped for another variant of the same seed.
 */
export function randomLevel(band: Band, seed: number): Level {
  let best: Built | null = null;
  for (let v = 0; v < ATTEMPTS; v++) {
    const b = build(band, seed, v);
    if (b.ok || (v === 0 && b.loose)) return b.level;
    if (!best || b.spread < best.spread) best = b;
  }
  return (best as Built).level;
}
