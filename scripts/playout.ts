import { exposedMask } from './path';
import { stepSlots } from './step';
import type { Lanes, Slots } from './types';

/**
 * Plays the board forward from a state with a light random policy (prototype playout).
 * `first` is the lane to tap right now. Returns true if the board clears. Inputs are not mutated.
 */
export function playout(
  grid: Int8Array, W: number, H: number, slots: Slots, lanes: Lanes, rng: () => number, first: number | null,
): boolean {
  const g = grid.slice();
  const sl: Slots = slots.map((s) => (s ? { ...s } : null));
  const ln: Lanes = lanes.map((l) => l.map((s) => ({ ...s })));
  let pending = first;
  for (let step = 0; step < 20000; step++) {
    if (pending == null && stepSlots(g, W, H, sl)) continue;
    if (g.every((v) => v < 0)) return true;
    const free = sl.indexOf(null);
    if (free < 0) return false;
    let li = pending;
    pending = null;
    if (li == null) {
      const open: number[] = [];
      ln.forEach((l, k) => { if (l.length) open.push(k); });
      if (!open.length) return false;
      const exp = exposedMask(g, W, H), has = new Set<number>();
      for (let i = 0; i < g.length; i++) if (exp[i]) has.add(g[i]);
      const good = open.filter((k) => has.has(ln[k][0].color));
      const pool = good.length && rng() < 0.85 ? good : open;
      li = pool[Math.floor(rng() * pool.length)];
    }
    const sq = ln[li]?.shift();
    if (!sq) return false;
    sl[free] = sq;
  }
  return false;
}
