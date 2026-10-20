import { playout } from './playout';
import type { Lanes, Slots } from './types';

export interface Snap { grid: Int8Array; W: number; H: number; slots: Slots; lanes: Lanes }
export interface SearchOpts { budgetMs: number; rng: () => number }

/** The recorded winning lane for the next tap, only while the player is on the line and idle. */
export function lineHint(onLine: boolean, idle: boolean, line: number[], taps: number): number | null {
  return onLine && idle ? (line[taps] ?? null) : null;
}

const SLICE_MS = 24;
const SOFT_MS = 1400;

/** Chunked Monte-Carlo search (prototype hint): best lane by playout win rate, or null if none wins. */
export function searchHint(snap: Snap, opts: SearchOpts): Promise<number | null> {
  const open = snap.lanes.map((_, k) => k).filter((k) => snap.lanes[k].length);
  if (!open.length) return Promise.resolve(null);
  if (open.length === 1) return Promise.resolve(open[0]);
  const hardMs = Math.min(3000, opts.budgetMs), softMs = Math.min(SOFT_MS, hardMs);
  const wins = open.map(() => 0), runs = open.map(() => 0);
  const t0 = performance.now();
  let k = 0;
  return new Promise((resolve) => {
    const step = () => {
      const until = performance.now() + SLICE_MS;
      while (performance.now() < until) {
        const j = k++ % open.length;
        if (playout(snap.grid, snap.W, snap.H, snap.slots, snap.lanes, opts.rng, open[j])) wins[j]++;
        runs[j]++;
      }
      const minR = Math.min(...runs), el = performance.now() - t0;
      if (!(minR >= 10 || (el > softMs && minR >= 3) || el > hardMs)) { setTimeout(step, 0); return; }
      let best = 0;
      for (let j = 1; j < open.length; j++) if (wins[j] / runs[j] > wins[best] / runs[best]) best = j;
      resolve(wins[best] ? open[best] : null);
    };
    step();
  });
}
