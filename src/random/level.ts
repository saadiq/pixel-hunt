import { parseArt } from '../core/board';
import { deal } from '../core/deal';
import { tapTarget } from '../core/targets';
import type { Band, Level, Params } from '../core/types';
import { makeScene } from './scene';

type BandSpec = Omit<Params, 'chunk'> & { size: number };

export const RANDOM_BANDS: Record<Band, BandSpec> = {
  easy: { size: 42, slots: 5, lanes: 3, wait: 0.3 },
  medium: { size: 48, slots: 4, lanes: 4, wait: 0.8, waitSlack: 1 },
  hard: { size: 54, slots: 3, lanes: 5, wait: 0.7, waitSlack: 1 },
};

export const randomKey = (band: Band, seed: number): string => `r-${band}-${seed}`;

/** Tap windows as fractions of the band's tap target: `tight` is what calibration aims for, `loose` what it accepts. */
export const TAP_SLACK = { near: 0.09, tight: 0.2, loose: 0.33 };
export const tapWindow = (band: Band, slack: number): [number, number] => [tapTarget(band) * (1 - slack), tapTarget(band) * (1 + slack)];
/** Starting squad-size multiplier per band, from measured calibrations, so most levels need no second pass. */
const START: Record<Band, number> = { easy: 1.5, medium: 1.3, hard: 1.3 };
const chunkFor = (avg: number): [number, number] => [Math.max(1, Math.round(avg * 0.75)), Math.max(1, Math.round(avg * 1.25))];

const PROBES = 4, ATTEMPTS = 2;

interface Built { level: Level; spread: number; ok: boolean; loose: boolean }

/** Builds a level for one scene variant, calibrating squad size so a deal takes about tapTarget(band) taps. */
function build(band: Band, seed: number, variant: number): Built {
  const { size, ...params } = RANDOM_BANDS[band];
  const target = tapTarget(band), [lo, hi] = tapWindow(band, TAP_SLACK.tight), [llo, lhi] = tapWindow(band, TAP_SLACK.loose);
  const near = (m: number): boolean => Math.abs(m - target) <= target * TAP_SLACK.near;
  const art = makeScene(seed + variant * 104729, size);
  const make = (avg: number): Level =>
    ({ key: randomKey(band, seed), name: art.name, band, rows: art.rows, pal: art.pal, ...params, chunk: chunkFor(avg) });
  const board = parseArt(art);
  // A single deal's tap count is noisy, so probe several deals.
  // Deals are deterministic, so taps already probed on this level are kept and only the rest are dealt.
  let known: { level: Level; taps: number[] } | null = null;
  const probe = (l: Level, n: number): number[] => {
    const taps = known?.level === l ? known.taps.slice(0, n) : [];
    for (let k = taps.length; k < n; k++) taps.push(deal(l, board, seed + k * 7919).line.length);
    known = { level: l, taps };
    return taps;
  };
  const mean = (t: number[]): number => t.reduce((a, b) => a + b, 0) / t.length;
  const inWindow = (t: number[]): boolean => Math.min(...t) >= lo && Math.max(...t) <= hi;
  let avg = Math.max(1, (size * size * START[band]) / target), level = make(avg), taps = probe(level, PROBES);
  if (!(near(mean(taps)) && inWindow(taps))) {
    let m = mean(taps);
    for (let pass = 0; pass < 3; pass++) {
      avg = Math.max(1, Math.round((avg * m) / target));
      level = make(avg);
      if (pass === 2) break;
      m = mean(probe(level, 2));
      if (near(m)) break;
    }
    taps = probe(level, PROBES);
  }
  const spread = Math.max(...taps.map((t) => Math.abs(t - target)));
  return { level, spread, ok: inWindow(taps), loose: Math.min(...taps) >= llo && Math.max(...taps) <= lhi };
}

/**
 * A random scene as a playable level, deterministic per (band, seed). Squad caps are limited by
 * reachable cells, so squad size is calibrated by dealing; a scene whose deals vary too much in
 * length is swapped for another variant of the same seed.
 */
export function randomLevel(band: Band, seed: number): Level {
  const key = randomKey(band, seed);
  if (last?.key !== key) last = { key, level: buildLevel(band, seed) };
  return last.level;
}

// Restart and replay ask for the same level again; building one deals up to ~10 times, so keep the last.
let last: { key: string; level: Level } | null = null;

function buildLevel(band: Band, seed: number): Level {
  let best: Built | null = null;
  for (let v = 0; v < ATTEMPTS; v++) {
    const b = build(band, seed, v);
    if (b.ok || (v === 0 && b.loose)) return b.level;
    if (!best || b.spread < best.spread) best = b;
  }
  return (best as Built).level;
}
