import { describe, expect, test } from 'bun:test';
import { dailyPick, isUnlocked, nextScene, todayKey } from '../../src/state/progress';

describe('progress', () => {
  test('unlock follows predecessor', () => {
    const c = new Set(['a']);
    expect(isUnlocked('a', ['a', 'b', 'c'], c)).toBe(true);
    expect(isUnlocked('b', ['a', 'b', 'c'], c)).toBe(true);
    expect(isUnlocked('c', ['a', 'b', 'c'], c)).toBe(false);
  });

  test('inserting a scene re-locks the one after it', () => {
    const c = new Set(['a']);
    expect(isUnlocked('x', ['a', 'x', 'b'], c)).toBe(true);
    expect(isUnlocked('b', ['a', 'x', 'b'], c)).toBe(false);
  });

  test('nextScene: first uncleared, last when all cleared, ignores unknown ids', () => {
    expect(nextScene(['a', 'b'], new Set())).toBe('a');
    expect(nextScene(['a', 'b'], new Set(['gone', 'a']))).toBe('b');
    expect(nextScene(['a', 'b'], new Set(['a', 'b']))).toBe('b');
  });

  test('dailyPick is stable and in the pool', () => {
    const m = ['a', 'b', 'c', 'd'];
    const c = new Set(['a', 'b']);
    for (const date of ['2026-10-19', '2026-10-20', '2027-01-01']) {
      const p = dailyPick(date, m, c);
      expect(p).toBe(dailyPick(date, m, c));
      expect(['a', 'b', 'c']).toContain(p);
    }
  });

  test('todayKey formats local date', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
