import { describe, expect, test } from 'bun:test';
import { sceneLevel } from '../../src/core/board';
import { fieldOf } from '../../src/core/field';
import { mulberry } from '../../src/core/rng';
import type { Meta } from '../../src/core/types';
import { SCENES } from '../../src/scenes';
import { type Game, newGame, status, tapLane, tick } from '../../src/state/game';
import { applyRewind, findRewind, winnableAt } from '../../src/state/rewind';
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
    const exposed = fieldOf(g.grid, g.board.W, g.board.H).exposed;
    const open = g.lanes.map((q, k) => (q.length ? k : -1)).filter((k) => k >= 0);
    const eat = open.filter((k) => exposed[g.lanes[k][0].color]?.length);
    const pool = eat.length ? eat : open;
    if (!pool.length || tapLane(g, pool[Math.floor(rng() * pool.length)]) !== 'ok') break;
  }
  return g;
}

/** First seed whose careless game gets stuck. */
function stuckGame(): Game {
  for (let seed = 1; ; seed++) {
    const g = playCareless(seed);
    if (status(g) === 'stuck') return g;
  }
}

describe('rewind', () => {
  test('lands on the last winnable position and points at the tap that lost it', async () => {
    const g = stuckGame();
    const taps = g.hist.length, lanes = g.hist.map((h) => h.lane);
    const k = await findRewind(g, now);
    expect(k).toBeGreaterThanOrEqual(0);
    if (k + 1 < taps) expect(winnableAt(g, g.hist[k + 1])).toBe(false);
    const lane = applyRewind(g, k);
    expect(lane).toBe(lanes[k]);
    expect(g).toMatchObject({ rewound: true, taps: k, stuck: false });
    expect(g.hist.length).toBe(k);
    settle(g);
    expect(status(g)).toBe('playing');
  }, 60_000);

  test('finds nothing in an empty history', async () => {
    expect(await findRewind(newGame(meta, level, 1), now)).toBe(-1);
  });

  test('saves keep the spent rewind, the last few snapshots and their lanes', () => {
    const g = stuckGame();
    g.rewound = true;
    const back = fromRun(JSON.parse(JSON.stringify(toRun(g, 1))), SCENES) as Game;
    expect(back.rewound).toBe(true);
    expect(back.hist.map((h) => h.lane)).toEqual(g.hist.slice(-3).map((h) => h.lane));
  }, 60_000);
});
