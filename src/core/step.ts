import { eat, fieldOf, nearest } from './field';
import { tracePath } from './path';
import type { BiteFn, Slots } from './types';

/** One tick: each occupied slot takes one bite of its nearest reachable block. */
export function stepSlots(g: Int8Array, W: number, H: number, slots: Slots, onBite?: BiteFn): boolean {
  let ate = false;
  const f = fieldOf(g, W, H);
  slots.forEach((sq, si) => {
    if (!sq) return;
    const i = nearest(f, sq.color);
    if (i < 0) return;
    if (onBite) onBite(i, sq.color, tracePath(f.dist, i, W, H));
    eat(f, g, i);
    sq.cap--;
    ate = true;
    if (sq.cap <= 0) slots[si] = null;
  });
  return ate;
}

/** Ticks until no slot can eat. */
export function settle(g: Int8Array, W: number, H: number, slots: Slots): void {
  while (stepSlots(g, W, H, slots));
}

export const cleared = (g: Int8Array): boolean => g.every((v) => v < 0);
