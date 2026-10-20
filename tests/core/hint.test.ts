import { describe, expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { deal } from '../../src/core/deal';
import { lineHint, searchHint } from '../../src/core/hint';
import { playout } from '../../src/core/playout';
import { mulberry } from '../../src/core/rng';
import type { Lanes, Slots } from '../../src/core/types';
import { bridge } from '../fixtures/proto';

const level = sceneLevel(bridge);
const board = parseArt(level);
const emptySlots = (): Slots => Array(level.slots).fill(null);

describe('lineHint', () => {
  test('returns line[taps] only when on the line and idle', () => {
    expect(lineHint(true, true, [2, 0, 1], 1)).toBe(0);
    expect(lineHint(false, true, [2, 0, 1], 1)).toBeNull();
    expect(lineHint(true, false, [2, 0, 1], 1)).toBeNull();
    expect(lineHint(true, true, [2, 0, 1], 3)).toBeNull();
  });
});

describe('searchHint', () => {
  test('resolves to a lane with squads from a fresh deal', async () => {
    const d = deal(level, board, 5);
    const snap = { grid: board.grid, W: board.W, H: board.H, slots: emptySlots(), lanes: d.lanes };
    const lane = await searchHint(snap, { budgetMs: 1500, rng: mulberry(1) });
    expect(lane).not.toBeNull();
    expect(d.lanes[lane as number].length).toBeGreaterThan(0);
  }, 10_000);

  test('resolves to the only non-empty lane', async () => {
    const d = deal(level, board, 5);
    const lanes: Lanes = d.lanes.map((l, k) => (k === 1 ? l : []));
    const snap = { grid: board.grid, W: board.W, H: board.H, slots: emptySlots(), lanes };
    expect(await searchHint(snap, { budgetMs: 200, rng: mulberry(1) })).toBe(1);
  });

  test('budgetMs bounds total time and inputs are not mutated', async () => {
    const d = deal(level, board, 5);
    const before = JSON.stringify(d.lanes);
    const grid = board.grid.slice();
    const t0 = performance.now();
    await searchHint({ grid, W: board.W, H: board.H, slots: emptySlots(), lanes: d.lanes }, { budgetMs: 60, rng: mulberry(2) });
    expect(performance.now() - t0).toBeLessThan(500);
    expect(JSON.stringify(d.lanes)).toBe(before);
    expect(Array.from(grid)).toEqual(Array.from(board.grid));
  });
});

describe('playout', () => {
  test('wins from the start of a fresh deal for at least one seed in 1..20', () => {
    const wins = Array.from({ length: 20 }, (_, i) => i + 1).filter((s) => {
      const d = deal(level, board, s);
      return playout(board.grid, board.W, board.H, emptySlots(), d.lanes, mulberry(s), d.line[0]);
    });
    expect(wins.length).toBeGreaterThan(0);
  });
});
