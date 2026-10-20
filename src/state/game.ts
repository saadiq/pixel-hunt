import { parseArt } from '../core/board';
import { deal } from '../core/deal';
import { stepSlots } from '../core/step';
import type { BiteFn, Board, Lanes, Level, Meta, Slots, Squad } from '../core/types';

export interface Snapshot { grid: Int8Array; lanes: Lanes; slots: Slots; remaining: number; taps: number; onLine: boolean }

export interface Game {
  meta: Meta; level: Level; board: Board; grid: Int8Array; lanes: Lanes; slots: Slots;
  hist: Snapshot[]; undos: number; hints: number; usedUndo: number; usedHint: number;
  taps: number; remaining: number; stuck: boolean; idle: boolean; line: number[]; onLine: boolean;
}

const HIST_MAX = 40;
const copy = (s: Squad): Squad => ({ ...s });
const copyLanes = (l: Lanes): Lanes => l.map((q) => q.map(copy));
const copySlots = (s: Slots): Slots => s.map((q) => (q ? copy(q) : null));

export function newGame(meta: Meta, level: Level, seed: number): Game {
  const board = parseArt(level);
  const d = deal(level, board, seed);
  const grid = board.grid.slice();
  return {
    meta, level, board, grid, lanes: d.lanes, slots: Array(level.slots).fill(null),
    hist: [], undos: 3, hints: 3, usedUndo: 0, usedHint: 0, taps: 0,
    remaining: grid.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0),
    stuck: false, idle: true, line: d.line, onLine: true,
  };
}

function snapshot(g: Game): Snapshot {
  return { grid: g.grid.slice(), lanes: copyLanes(g.lanes), slots: copySlots(g.slots), remaining: g.remaining, taps: g.taps, onLine: g.onLine };
}

export function tapLane(g: Game, lane: number): 'ok' | 'full' | 'empty' {
  const q = g.lanes[lane];
  if (!q || !q.length) return 'empty';
  const free = g.slots.indexOf(null);
  if (free < 0) return 'full';
  g.hist.push(snapshot(g));
  if (g.hist.length > HIST_MAX) g.hist.shift();
  g.slots[free] = copy(q.shift() as Squad);
  g.onLine = g.onLine && g.idle && g.line[g.taps] === lane;
  g.taps++;
  g.idle = false;
  g.stuck = false;
  return 'ok';
}

/** One stepSlots; sets idle = !ate and stuck. */
export function tick(g: Game, onBite?: BiteFn): boolean {
  const { W, H } = g.board;
  const ate = stepSlots(g.grid, W, H, g.slots, (...a) => { g.remaining--; onBite?.(...a); });
  g.idle = !ate;
  g.stuck = !ate && g.slots.every(Boolean) && g.remaining > 0;
  return ate;
}

export function undo(g: Game): boolean {
  if (g.undos <= 0 || !g.hist.length) return false;
  const h = g.hist.pop() as Snapshot;
  g.grid = h.grid;
  g.lanes = h.lanes;
  g.slots = h.slots;
  g.remaining = h.remaining;
  g.taps = h.taps;
  g.onLine = h.onLine;
  g.undos--;
  g.usedUndo++;
  g.stuck = false;
  g.idle = true;
  return true;
}

export function status(g: Game): 'playing' | 'won' | 'stuck' {
  if (g.remaining === 0) return 'won';
  return g.stuck ? 'stuck' : 'playing';
}
