// The once-per-board rewind: back to the last tap from which the board could still be cleared.
import { type SolveState, solve, type Verdict } from '../core/solve';
import { copySlots } from '../core/squads';
import { settle } from '../core/step';
import type { Lanes } from '../core/types';
import { type Game, newGame, restore, type Snapshot, snapshot } from './game';

// Losing positions are proved in a few ms; a winnable one near the stuck point takes up to ~0.5s on desktop.
// Past this budget a position counts as unproven and the walk goes further back.
const BUDGET = 20000;
// Unproven positions cost the full budget each, so after this many the walk settles for the deal's opening.
const MAX_UNKNOWN = 3;

/** Where a rewind lands: `keep` snapshots stay in the history, and `lane` is the tap made next from `to` last time (-1 for none). */
export interface Rewind { to: Snapshot; keep: number; lane: number }

/** The verdict for snapshot h, once the ants already out have finished. */
export function verdictAt(g: Game, h: Snapshot): Verdict {
  const s: SolveState = { g: h.grid.slice(), slots: copySlots(h.slots), pos: h.lanes.map(() => 0) };
  settle(s.g, g.board.W, g.board.H, s.slots);
  return solve(g.board, h.lanes, s, BUDGET);
}

/** Lanes only lose their front squad, so the tapped lane is the one that got shorter. */
const tappedLane = (before: Lanes, after: Lanes): number => before.findIndex((q, k) => q.length !== after[k].length);

const nextFrame = (): Promise<void> => new Promise((r) => setTimeout(r));

/**
 * Walks back from the newest snapshot to the first that is winnable (a board only gets worse, so that is the
 * latest one). With none in reach (a save keeps only the last few), lands on the deal's opening, which always
 * is. Yields between checks; resolves null if `live` turns false meanwhile.
 */
export async function findRewind(g: Game, seed: number, live = (): boolean => true, pause = nextFrame): Promise<Rewind | null> {
  const hist = g.hist.slice(), lanes = g.lanes;
  let unknown = 0;
  for (let k = hist.length - 1; k >= 0 && unknown < MAX_UNKNOWN; k--) {
    const v = verdictAt(g, hist[k]);
    if (v === 'win') return { to: hist[k], keep: k, lane: tappedLane(hist[k].lanes, (hist[k + 1] ?? { lanes }).lanes) };
    if (v === 'unknown') unknown++;
    await pause();
    if (!live()) return null;
  }
  return { to: snapshot(newGame(g.meta, g.level, seed)), keep: 0, lane: -1 };
}

/** Restores the rewind's position, drops the taps after it and spends the rewind. */
export function applyRewind(g: Game, r: Rewind): void {
  restore(g, r.to);
  g.hist.length = r.keep;
  g.rewound = true;
}
