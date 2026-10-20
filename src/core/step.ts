import { distField, holeCol, pickNear } from './path';
import type { BiteFn, Slots } from './types';

/** One tick: each occupied slot takes one bite of its nearest reachable block. */
export function stepSlots(g: Int8Array, W: number, H: number, slots: Slots, onBite?: BiteFn): boolean {
  let ate = false;
  slots.forEach((sq, si) => {
    if (!sq) return;
    const d = distField(g, W, H, holeCol(si, slots.length, W));
    const i = pickNear(g, W, H, sq.color, d);
    if (i < 0) return;
    if (onBite) onBite(si, i, sq.color, d);
    g[i] = -1;
    sq.cap--;
    ate = true;
    if (sq.cap <= 0) slots[si] = null;
  });
  return ate;
}
