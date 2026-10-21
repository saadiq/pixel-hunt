// Decision metrics: how often a careful player's tap actually matters. The model player settles
// the board fully before each tap (waits for the ants to finish), which is the hardest case for
// a board to create pressure in, so a board that scores here scores in real play too.
import { parseArt, sceneLevel } from '../src/core/board';
import { deal } from '../src/core/deal';
import { mulberry } from '../src/core/rng';
import { cloneState as clone, options, solve, type SolveState as State, tapSettled as tap } from '../src/core/solve';
import { cleared, settle } from '../src/core/step';
import type { Board, Lanes, Level, Scene } from '../src/core/types';

const settleState = (b: Board, s: State): void => settle(s.g, b.W, b.H, s.slots);
const won = (s: State): boolean => cleared(s.g);

/** Can the settled state still be won? Budget exhaustion counts as yes (benefit of the doubt). */
const solvable = (b: Board, lanes: Lanes, s: State): boolean => solve(b, lanes, s) !== 'dead';

export interface Choices {
  /** Share of turns with 2+ options where at least one option loses the board. */
  choice: number;
  /** Average number of such turns per board. */
  decisions: number;
  /** Share of turns where an option that looks fine (its colour is eatable now) loses the board. */
  trap: number;
  /** Win rate of a player who always taps a random eatable-looking lane. */
  mindless: number;
}

function walkLine(b: Board, lanes: Lanes, line: number[], slotN: number): { turns: number; choice: number; trap: number } {
  const s: State = { g: b.grid.slice(), slots: Array(slotN).fill(null), pos: lanes.map(() => 0) };
  let turns = 0, choice = 0, trap = 0;
  for (const li of line) {
    settleState(b, s);
    const { open, eatable } = options(b, lanes, s);
    if (open.length > 1) {
      turns++;
      let lose = false, lure = false;
      for (const o of open) {
        if (o === li) continue;
        const n = clone(s);
        if (tap(b, lanes, n, o) && solvable(b, lanes, n)) continue;
        lose = true;
        if (eatable.has(o)) lure = true;
      }
      if (lose) choice++;
      if (lure) trap++;
    }
    tap(b, lanes, s, li);
  }
  return { turns, choice, trap };
}

function mindlessWin(b: Board, lanes: Lanes, slotN: number, rng: () => number): boolean {
  const s: State = { g: b.grid.slice(), slots: Array(slotN).fill(null), pos: lanes.map(() => 0) };
  for (let guard = 0; guard < 2000; guard++) {
    settleState(b, s);
    if (won(s)) return true;
    const { open, eatable } = options(b, lanes, s);
    const pool = eatable.size ? [...eatable] : open;
    if (!pool.length || !tap(b, lanes, s, pool[Math.floor(rng() * pool.length)])) return false;
  }
  return false;
}

/** Decision metrics over deals 1..n: the recorded line is walked, and 4 mindless games are played per deal. */
export function measureChoices(sc: Scene, n: number): Choices {
  return measureLevel(sceneLevel(sc), n);
}

export function measureLevel(level: Level, n: number): Choices {
  const b = parseArt(level);
  let turns = 0, choice = 0, trap = 0, wins = 0, games = 0;
  for (let seed = 1; seed <= n; seed++) {
    const d = deal(level, b, seed);
    const r = walkLine(b, d.lanes, d.line, level.slots);
    turns += r.turns; choice += r.choice; trap += r.trap;
    const rng = mulberry(seed * 104729 + 7);
    for (let k = 0; k < 4; k++, games++) if (mindlessWin(b, d.lanes, level.slots, rng)) wins++;
  }
  return { choice: turns ? choice / turns : 0, decisions: n ? choice / n : 0, trap: turns ? trap / turns : 0, mindless: games ? wins / games : 0 };
}
