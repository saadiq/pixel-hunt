// Exhaustive search over tap orders for a settled board: can it still be cleared?
// The model player lets the ants finish before each tap, the same model the dealer and validator use.
import { fieldOf } from './field';
import { copySlots } from './squads';
import { cleared, settle } from './step';
import type { Board, Lanes, Slots } from './types';

/** A board position: lanes are fixed queues and `pos` is how far into each one the player has tapped. */
export interface SolveState { g: Int8Array; slots: Slots; pos: number[] }
export type Verdict = 'win' | 'dead' | 'unknown';

export const cloneState = (s: SolveState): SolveState => ({ g: s.g.slice(), slots: copySlots(s.slots), pos: s.pos.slice() });

/** Taps lane li (state already settled), then settles. False if the tap is impossible. */
export function tapSettled(b: Board, lanes: Lanes, s: SolveState, li: number): boolean {
  const free = s.slots.indexOf(null), sq = lanes[li][s.pos[li]];
  if (free < 0 || !sq) return false;
  s.slots[free] = { ...sq };
  s.pos[li]++;
  settle(s.g, b.W, b.H, s.slots);
  return true;
}

/** Open lanes, those whose front colour can be eaten right now first. */
export function options(b: Board, lanes: Lanes, s: SolveState): { open: number[]; eatable: Set<number> } {
  const exposed = fieldOf(s.g, b.W, b.H).exposed;
  const open = lanes.map((_, k) => k).filter((k) => s.pos[k] < lanes[k].length);
  const eatable = new Set(open.filter((k) => exposed[lanes[k][s.pos[k]].color]?.length));
  open.sort((a, c) => Number(eatable.has(c)) - Number(eatable.has(a)));
  return { open, eatable };
}

// Different tap orders can reach the same lanes and slots with different cells eaten, so the grid is part of the key.
const gridHash = (g: Int8Array): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < g.length; i++) h = Math.imul(h ^ (g[i] + 1), 0x01000193);
  return h >>> 0;
};
const keyOf = (s: SolveState) => s.pos.join(',') + '|' + s.slots.map((q) => (q ? `${q.color}:${q.cap}` : '-')).join(',') + '|' + gridHash(s.g);

/** Depth-first search from a settled state. 'unknown' when more than `budget` positions would be needed. */
export function solve(b: Board, lanes: Lanes, s: SolveState, budget = 3000): Verdict {
  const dead = new Set<string>();
  let nodes = 0, out = false;
  const go = (st: SolveState): boolean => {
    if (cleared(st.g)) return true;
    if (++nodes > budget) { out = true; return false; }
    const k = keyOf(st);
    if (dead.has(k)) return false;
    if (st.slots.indexOf(null) >= 0) {
      for (const li of options(b, lanes, st).open) {
        const n = cloneState(st);
        if (tapSettled(b, lanes, n, li) && go(n)) return true;
        if (out) return false;
      }
    }
    dead.add(k);
    return false;
  };
  return go(s) ? 'win' : out ? 'unknown' : 'dead';
}
