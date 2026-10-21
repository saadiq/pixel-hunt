import { parseArt } from '../core/board';
import { deal } from '../core/deal';
import { copyLanes, copySlots } from '../core/squads';
import { stepSlots } from '../core/step';
import type { BiteFn, Board, Lanes, Level, Meta, Slots, Squad } from '../core/types';

export interface Snapshot { grid: Int8Array; lanes: Lanes; slots: Slots; remaining: number; taps: number }

export interface Game {
  meta: Meta; level: Level; board: Board; grid: Int8Array; lanes: Lanes; slots: Slots;
  /** Every tap this session, for the rewind; saves keep only the last HIST_MAX. */
  hist: Snapshot[]; undos: number; usedUndo: number;
  taps: number; remaining: number; stuck: boolean;
  /** The one rewind to the last winnable point has been spent. */
  rewound: boolean;
}

export const HIST_MAX = 3; // only 3 undos per board, so saves keep no more (older ones only serve the rewind)

export function newGame(meta: Meta, level: Level, seed: number): Game {
  const board = parseArt(level);
  const d = deal(level, board, seed);
  const grid = board.grid.slice();
  return {
    meta, level, board, grid, lanes: d.lanes, slots: Array(level.slots).fill(null),
    hist: [], undos: 3, usedUndo: 0, taps: 0,
    remaining: grid.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0),
    stuck: false, rewound: false,
  };
}

export function snapshot(g: Game): Snapshot {
  return { grid: g.grid.slice(), lanes: copyLanes(g.lanes), slots: copySlots(g.slots), remaining: g.remaining, taps: g.taps };
}

export function tapLane(g: Game, lane: number): 'ok' | 'full' | 'empty' {
  const q = g.lanes[lane];
  if (!q || !q.length) return 'empty';
  const free = g.slots.indexOf(null);
  if (free < 0) return 'full';
  g.hist.push(snapshot(g));
  g.slots[free] = { ...(q.shift() as Squad) };
  g.taps++;
  g.stuck = false;
  return 'ok';
}

/** One stepSlots; sets stuck; returns whether a squad ate. */
export function tick(g: Game, onBite?: BiteFn): boolean {
  const { W, H } = g.board;
  const ate = stepSlots(g.grid, W, H, g.slots, (...a) => { g.remaining--; onBite?.(...a); });
  g.stuck = !ate && g.slots.every(Boolean) && g.remaining > 0;
  return ate;
}

/** Puts the board back to snapshot h. */
export function restore(g: Game, h: Snapshot): void {
  g.grid = h.grid;
  g.lanes = h.lanes;
  g.slots = h.slots;
  g.remaining = h.remaining;
  g.taps = h.taps;
  g.stuck = false;
}

export const canUndo = (g: Game): boolean => g.undos > 0 && g.hist.length > 0;
export const canRewind = (g: Game): boolean => !g.rewound;

export function undo(g: Game): boolean {
  if (!canUndo(g)) return false;
  restore(g, g.hist.pop() as Snapshot);
  g.undos--;
  g.usedUndo++;
  return true;
}

export function status(g: Game): 'playing' | 'won' | 'stuck' {
  if (g.remaining === 0) return 'won';
  return g.stuck ? 'stuck' : 'playing';
}
