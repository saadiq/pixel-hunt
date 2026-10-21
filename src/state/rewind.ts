// The once-per-board rewind: back to the last tap from which the board could still be cleared.
import { type SolveState, solve, type Verdict } from '../core/solve';
import { copySlots } from '../core/squads';
import { settle } from '../core/step';
import type { Board, Lanes } from '../core/types';
import { type Game, gridAt, lanePos, opening, restore, type Snapshot } from './game';

// Losing positions are proved in a few ms; a winnable one near the stuck point takes up to ~0.5s on desktop.
// Past this budget a position counts as unproven and the walk goes further back.
const BUDGET = 20000;
// Unproven positions cost the full budget each, so after this many the walk settles for the deal's opening.
const MAX_UNKNOWN = 5;

/** What the search needs, as plain data so it can be posted to a worker. */
export interface RewindInput { board: Board; deal: Lanes; eaten: number[]; total: number; hist: Snapshot[]; pos: number[]; opening: Snapshot }

/**
 * Where a rewind lands: `keep` snapshots stay in the history. `lane` is the tap made next from `to` last time,
 * set only when the position after that tap was proved lost, so it surely is the tap that lost the board.
 */
export interface Rewind { to: Snapshot; keep: number; lane: number }

export const rewindInput = (g: Game): RewindInput =>
  ({ board: g.board, deal: g.deal, eaten: g.eaten, total: g.total, hist: g.hist, pos: lanePos(g), opening: opening(g) });

/** The verdict for snapshot h, once the ants already out have finished. */
export function verdictAt(inp: RewindInput, h: Snapshot, dead?: Set<string>): Verdict {
  const s: SolveState = { g: gridAt(inp.board, inp.eaten, inp.total, h), slots: copySlots(h.slots), pos: h.pos.slice() };
  settle(s.g, inp.board.W, inp.board.H, s.slots);
  return solve(inp.board, inp.deal, s, BUDGET, dead);
}

/**
 * Walks back from the newest snapshot to the first that is winnable (a board only gets worse, so that is the
 * latest one). With none proved in reach, lands on the deal's opening, which always is. Positions are keyed by
 * absolute lane positions, so what one check proves lost the next one reuses.
 */
export function searchRewind(inp: RewindInput): Rewind {
  const dead = new Set<string>(), { hist } = inp;
  let unknown = 0, next: Verdict = 'dead'; // the stuck position itself is lost
  for (let k = hist.length - 1; k >= 0 && unknown < MAX_UNKNOWN; k--) {
    const v = verdictAt(inp, hist[k], dead);
    if (v === 'win') {
      const after = hist[k + 1]?.pos ?? inp.pos;
      return { to: hist[k], keep: k, lane: next === 'dead' ? hist[k].pos.findIndex((p, l) => p !== after[l]) : -1 };
    }
    if (v === 'unknown') unknown++;
    next = v;
  }
  return { to: inp.opening, keep: 0, lane: -1 };
}

/** Restores the rewind's position, drops the taps after it and spends the rewind. */
export function applyRewind(g: Game, r: Rewind): void {
  restore(g, r.to);
  g.hist.length = r.keep;
  g.rewound = true;
}
