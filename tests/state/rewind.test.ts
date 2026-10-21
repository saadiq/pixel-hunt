import { describe, expect, test } from 'bun:test';
import { sceneLevel } from '../../src/core/board';
import { mulberry } from '../../src/core/rng';
import { options } from '../../src/core/solve';
import type { Meta } from '../../src/core/types';
import { SCENES } from '../../src/scenes';
import { type Game, newGame, status, tapLane, tick } from '../../src/state/game';
import { applyRewind, findRewind, verdictAt } from '../../src/state/rewind';
import { fromRun, toRun } from '../../src/state/save';

const id = 'fireworks-harbor';
const meta: Meta = { kind: 'campaign', id };
const level = sceneLevel(SCENES[id]);
const settle = (g: Game): void => { while (tick(g)); };
const now = (): Promise<void> => Promise.resolve();

/** Taps random lanes whose colour can be eaten now, settling between taps, until the board ends. */
function playCareless(seed: number): Game {
  const g = newGame(meta, level, seed), rng = mulberry(seed);
  while (status(g) === 'playing') {
    settle(g);
    if (status(g) !== 'playing') break;
    const { open, eatable } = options(g.board, g.lanes, { g: g.grid, slots: g.slots, pos: g.lanes.map(() => 0) });
    const pool = eatable.size ? [...eatable] : open;
    if (!pool.length || tapLane(g, pool[Math.floor(rng() * pool.length)]) !== 'ok') break;
  }
  return g;
}

/** First seed whose careless game gets stuck. */
function stuckGame(): [Game, number] {
  for (let seed = 1; ; seed++) {
    const g = playCareless(seed);
    if (status(g) === 'stuck') return [g, seed];
  }
}

describe('rewind', () => {
  test('lands on the last winnable position and points at the tap that lost it', async () => {
    const [g, seed] = stuckGame();
    const hist = g.hist.slice();
    const r = await findRewind(g, seed, () => true, now);
    if (!r) throw new Error('cancelled');
    const k = r.keep;
    expect(r.to).toBe(hist[k]);
    if (k + 1 < hist.length) {
      expect(verdictAt(g, hist[k + 1])).toBe('dead');
      expect(hist[k + 1].lanes[r.lane].length).toBe(hist[k].lanes[r.lane].length - 1);
    }
    applyRewind(g, r);
    expect(g).toMatchObject({ rewound: true, taps: k, stuck: false });
    expect(g.hist.length).toBe(k);
    settle(g);
    expect(status(g)).toBe('playing');
  }, 60_000);

  test('with no history in reach, lands on the opening of the same deal', async () => {
    const g = newGame(meta, level, 1);
    const r = await findRewind(g, 1, () => true, now);
    expect(r).toMatchObject({ keep: 0, lane: -1 });
    expect(r?.to.grid).toEqual(g.grid);
    expect(r?.to.lanes).toEqual(g.lanes);
  });

  test('stops when no longer live', async () => {
    const [g, seed] = stuckGame();
    expect(await findRewind(g, seed, () => false, now)).toBeNull();
  }, 60_000);

  test('saves keep the spent rewind', () => {
    const [g, seed] = stuckGame();
    g.rewound = true;
    const back = fromRun(JSON.parse(JSON.stringify(toRun(g, seed))), SCENES) as Game;
    expect(back.rewound).toBe(true);
  }, 60_000);
});
