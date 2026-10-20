import { describe, expect, test } from 'bun:test';
import { parseArt } from '../../src/core/board';
import { deal, replayLine } from '../../src/core/deal';
import type { Band } from '../../src/core/types';
import { randomLevel } from '../../src/random/level';
import { makeScene } from '../../src/random/scene';
import { newGame } from '../../src/state/game';
import { fromRun, toRun } from '../../src/state/save';

const BANDS: Band[] = ['easy', 'medium', 'hard'];

describe('makeScene', () => {
  test('deterministic per seed, n x n, at most 9 colors', () => {
    for (let s = 1; s <= 40; s++) {
      const a = makeScene(s, 42), b = makeScene(s, 42);
      expect(a).toEqual(b);
      expect(a.rows.length).toBe(42);
      expect(a.rows.every((r) => r.length === 42)).toBe(true);
      expect(Object.keys(a.pal).length).toBeLessThanOrEqual(9);
    }
    expect(makeScene(1, 42).rows).not.toEqual(makeScene(2, 42).rows);
  });
});

describe('randomLevel', () => {
  for (const band of BANDS) {
    test(`${band}: seeds 1..30 deal a replayable winning line`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const lvl = randomLevel(band, seed);
        const board = parseArt(lvl);
        const d = deal(lvl, board, seed);
        expect(replayLine(lvl, board, d)).toBe(true);
      }
    });
  }

  test('a random SavedRun round-trips through fromRun', () => {
    const lvl = randomLevel('hard', 77);
    const g = newGame({ kind: 'random', band: 'hard', seed: 77 }, lvl, 5);
    const back = fromRun(JSON.parse(JSON.stringify(toRun(g, 5))), {});
    expect(back).not.toBeNull();
    expect(back?.level.key).toBe('r-hard-77');
    expect(Array.from(back?.grid ?? [])).toEqual(Array.from(g.grid));
    const bad = JSON.parse(JSON.stringify(toRun(g, 5)));
    bad.grid.pop();
    expect(fromRun(bad, {})).toBeNull();
    bad.meta = { kind: 'random', band: 'nope', seed: 1 };
    expect(fromRun(bad, {})).toBeNull();
  });
});
