// The once-per-board rewind: back to the last tap from which the board could still be cleared.
import { type SolveState, solve } from '../core/solve';
import { copySlots } from '../core/squads';
import { settle } from '../core/step';
import { type Game, restore, type Snapshot } from './game';

// Losing positions are proved in a few ms; a winnable one near the stuck point takes up to ~0.5s on desktop.
// Past this budget a position counts as unproven and the walk goes further back.
const BUDGET = 20000;

/** Whether the board can be cleared from snapshot h, once the ants already out have finished. */
export function winnableAt(g: Game, h: Snapshot): boolean {
  const s: SolveState = { g: h.grid.slice(), slots: copySlots(h.slots), pos: h.lanes.map(() => 0) };
  settle(s.g, g.board.W, g.board.H, s.slots);
  return solve(g.board, h.lanes, s, BUDGET) === 'win';
}

const nextFrame = (): Promise<void> => new Promise((r) => setTimeout(r));

/**
 * Index of the latest snapshot that is still winnable, or -1 when none in the history is (a save keeps only
 * the last few). A board only gets worse, so the walk stops at the first win; it yields between checks.
 */
export async function findRewind(g: Game, pause: () => Promise<void> = nextFrame): Promise<number> {
  for (let k = g.hist.length - 1; k >= 0; k--) {
    if (winnableAt(g, g.hist[k])) return k;
    await pause();
  }
  return -1;
}

/** Restores snapshot k, drops the taps after it and spends the rewind. Returns the lane tapped next last time. */
export function applyRewind(g: Game, k: number): number {
  const h = g.hist[k];
  restore(g, h);
  g.hist.length = k;
  g.rewound = true;
  return h.lane;
}
