import type { Lanes, Slots } from './types';

/** Deep copies: squads are mutated in place while they eat, so every saved or simulated state needs its own. */
export const copyLanes = (l: Lanes): Lanes => l.map((q) => q.map((s) => ({ ...s })));
export const copySlots = (s: Slots): Slots => s.map((q) => (q ? { ...q } : null));
