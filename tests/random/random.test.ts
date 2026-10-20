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

  for (const band of BANDS) {
    test(`${band}: the scene-seed deal is 30-60 taps and 3 other seeds stay 25-70`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const lvl = randomLevel(band, seed), board = parseArt(lvl);
        for (const ds of [seed, 1001 + seed, 7777 * seed + 3, 424242 - seed]) {
          const n = deal(lvl, board, ds).line.length;
          const [lo, hi] = ds === seed ? [30, 60] : [25, 70];
          expect(n).toBeGreaterThanOrEqual(lo);
          expect(n).toBeLessThanOrEqual(hi);
        }
      }
    });
  }

  test('every random scene has <= 9 colors, each with >= 4 cells', () => {
    for (const band of BANDS) {
      for (let seed = 1; seed <= 20; seed++) {
        const { rows, pal } = randomLevel(band, seed);
        expect(Object.keys(pal).length).toBeLessThanOrEqual(9);
        const cnt: Record<string, number> = {};
        for (const ch of rows.join('')) cnt[ch] = (cnt[ch] ?? 0) + 1;
        for (const k of Object.keys(pal)) expect(cnt[k]).toBeGreaterThanOrEqual(4);
      }
    }
  });

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
