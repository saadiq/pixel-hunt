import { describe, expect, test } from 'bun:test';
import { sceneLevel } from '../../src/core/board';
import { mulberry } from '../../src/core/rng';
import { options } from '../../src/core/solve';
import type { Meta } from '../../src/core/types';
import { SCENES } from '../../src/scenes';
import { type Game, gridAt, newGame, status, tapLane, tick } from '../../src/state/game';
import { applyRewind, rewindInput, searchRewind, verdictAt } from '../../src/state/rewind';
import { fromRun, toRun } from '../../src/state/save';

const id = 'fireworks-harbor';
const meta: Meta = { kind: 'campaign', id };
const level = sceneLevel(SCENES[id]);
const settle = (g: Game): void => { while (tick(g)); };

/** Taps random lanes whose colour can be eaten now, settling between taps, until the board ends. */
function playCareless(seed: number, grids: Int8Array[] = []): Game {
  const g = newGame(meta, level, seed), rng = mulberry(seed);
  while (status(g) === 'playing') {
    settle(g);
    if (status(g) !== 'playing') break;
    const { open, eatable } = options(g.board, g.lanes, { g: g.grid, slots: g.slots, pos: g.lanes.map(() => 0) });
    const pool = eatable.size ? [...eatable] : open;
    grids.push(g.grid.slice());
    if (!pool.length || tapLane(g, pool[Math.floor(rng() * pool.length)]) !== 'ok') break;
  }
  return g;
}

/** First seed (of 20) whose careless game gets stuck. */
function stuckGame(grids?: Int8Array[]): [Game, number] {
  for (let seed = 1; seed <= 20; seed++) {
    if (grids) grids.length = 0;
    const g = playCareless(seed, grids);
    if (status(g) === 'stuck') return [g, seed];
  }
  throw new Error('no careless game got stuck');
}

describe('rewind', () => {
  test('lands on the latest winnable snapshot; a lit lane is one proved to lose', () => {
    const [g] = stuckGame();
    const inp = rewindInput(g), hist = g.hist.slice();
    const r = searchRewind(inp);
    expect(verdictAt(inp, r.to)).toBe('win');
    if (r.lane >= 0) {
      const after = hist[r.keep + 1]?.pos ?? inp.pos;
      expect(after[r.lane]).toBe(r.to.pos[r.lane] + 1);
      if (hist[r.keep + 1]) expect(verdictAt(inp, hist[r.keep + 1])).toBe('dead');
    }
    applyRewind(g, r);
    expect(g).toMatchObject({ rewound: true, taps: r.to.taps, stuck: false });
    expect(g.hist.length).toBe(r.keep);
    settle(g);
    expect(status(g)).toBe('playing');
  }, 60_000);

  test('compact snapshots rebuild the grid each tap was made on', () => {
    const grids: Int8Array[] = [];
    const [g] = stuckGame(grids);
    g.hist.forEach((h, k) => expect(gridAt(g.board, g.eaten, g.total, h)).toEqual(grids[k]));
  }, 60_000);

  test('with no history, lands on the opening of the deal', () => {
    const g = newGame(meta, level, 1);
    const r = searchRewind(rewindInput(g));
    expect(r).toMatchObject({ keep: 0, lane: -1 });
    applyRewind(g, r);
    expect(g.grid).toEqual(g.board.grid);
    expect(g.lanes).toEqual(g.deal);
  });

  test('a save keeps the whole history, so a reloaded board rewinds to the same place', () => {
    const [g, seed] = stuckGame();
    const back = fromRun(JSON.parse(JSON.stringify(toRun(g, seed))), SCENES) as Game;
    expect(back.hist).toEqual(g.hist);
    expect(searchRewind(rewindInput(back))).toEqual(searchRewind(rewindInput(g)));
  }, 60_000);

  test('saves keep the spent rewind', () => {
    const g = newGame(meta, level, 1);
    g.rewound = true;
    expect(fromRun(JSON.parse(JSON.stringify(toRun(g, 1))), SCENES)?.rewound).toBe(true);
  });
});
