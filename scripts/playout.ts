import { fieldOf } from '../src/core/field';
import { copyLanes, copySlots } from '../src/core/squads';
import { cleared, stepSlots } from '../src/core/step';
import type { Lanes, Slots } from '../src/core/types';

/**
 * Plays the board forward from a state with a light random policy (the prototype's playout): it taps a lane
 * whose colour can be eaten right now 85% of the time. Returns true if the board clears. Inputs are not mutated.
 */
export function playout(grid: Int8Array, W: number, H: number, slots: Slots, lanes: Lanes, rng: () => number): boolean {
  const g = grid.slice(), sl = copySlots(slots), ln = copyLanes(lanes);
  for (let step = 0; step < 20000; step++) {
    if (stepSlots(g, W, H, sl)) continue;
    if (cleared(g)) return true;
    const free = sl.indexOf(null);
    if (free < 0) return false;
    const open: number[] = [];
    ln.forEach((l, k) => { if (l.length) open.push(k); });
    if (!open.length) return false;
    const exposed = fieldOf(g, W, H).exposed;
    const good = open.filter((k) => exposed[ln[k][0].color]?.length);
    const pool = good.length && rng() < 0.85 ? good : open;
    sl[free] = ln[pool[Math.floor(rng() * pool.length)]].shift() ?? null;
  }
  return false;
}
