import { parseArt } from '../core/board';
import { deal } from '../core/deal';
import { copyLanes, copySlots } from '../core/squads';
import { stepSlots } from '../core/step';
import type { BiteFn, Board, Lanes, Level, Meta, Slots, Squad } from '../core/types';

/**
 * The board just before a tap, kept small so a save can hold the whole history: lanes are the deal's from
 * `pos` on, and the grid is the opening one minus the first `total - remaining` cells of the game's `eaten`.
 */
export interface Snapshot { pos: number[]; slots: Slots; remaining: number; taps: number }

export interface Game {
  meta: Meta; level: Level; board: Board; grid: Int8Array; lanes: Lanes; slots: Slots;
  /** The lanes as dealt; never changed. */
  deal: Lanes;
  /** Every cell eaten so far, in order. */
  eaten: number[];
  /** Pixels on the opening board. */
  total: number;
  /** Every tap, for undo and the rewind. */
  hist: Snapshot[]; undos: number; usedUndo: number;
  taps: number; remaining: number; stuck: boolean;
  /** The one rewind to the last winnable point has been spent. */
  rewound: boolean;
}

export const countCells = (g: Int8Array): number => g.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0);

export function newGame(meta: Meta, level: Level, seed: number): Game {
  const board = parseArt(level);
  const d = deal(level, board, seed);
  const total = countCells(board.grid);
  return {
    meta, level, board, grid: board.grid.slice(), lanes: copyLanes(d.lanes), slots: Array(level.slots).fill(null),
    deal: d.lanes, eaten: [], total,
    hist: [], undos: 3, usedUndo: 0, taps: 0, remaining: total,
    stuck: false, rewound: false,
  };
}

/** How far into each dealt lane the player has tapped. */
export const lanePos = (g: Game): number[] => g.deal.map((q, l) => q.length - g.lanes[l].length);

export const snapshot = (g: Game): Snapshot => ({ pos: lanePos(g), slots: copySlots(g.slots), remaining: g.remaining, taps: g.taps });

/** The opening position of the deal. */
export const opening = (g: Game): Snapshot => ({ pos: g.deal.map(() => 0), slots: g.slots.map(() => null), remaining: g.total, taps: 0 });

/** The grid at snapshot h. */
export function gridAt(board: Board, eaten: number[], total: number, h: Snapshot): Int8Array {
  const grid = board.grid.slice();
  for (let k = 0; k < total - h.remaining; k++) grid[eaten[k]] = -1;
  return grid;
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
  const ate = stepSlots(g.grid, W, H, g.slots, (...a) => { g.remaining--; g.eaten.push(a[0]); onBite?.(...a); });
  g.stuck = !ate && g.slots.every(Boolean) && g.remaining > 0;
  return ate;
}

/** Puts the board back to snapshot h. */
export function restore(g: Game, h: Snapshot): void {
  g.grid = gridAt(g.board, g.eaten, g.total, h);
  g.eaten.length = g.total - h.remaining;
  g.lanes = copyLanes(g.deal.map((q, l) => q.slice(h.pos[l])));
  g.slots = copySlots(h.slots);
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
