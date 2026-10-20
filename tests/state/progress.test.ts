import { describe, expect, test } from 'bun:test';
import { dailyFor, dailyPick, isUnlocked, nextScene, todayKey } from '../../src/state/progress';

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

  test('a cleared scene stays unlocked when one is inserted before it', () => {
    expect(isUnlocked('b', ['a', 'x', 'b'], new Set(['a', 'b']))).toBe(true);
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

  test('dailyFor keeps the day\'s pick as scenes are cleared; a new date re-picks', () => {
    const m = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const first = dailyFor('2026-10-20', m, new Set(), null);
    expect(first).toEqual({ date: '2026-10-20', id: 'a' });
    expect(dailyFor('2026-10-20', m, new Set(['a', 'b', 'c', 'd', 'e']), first)).toEqual(first);
    const cleared = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    const dates = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'];
    const picks = dates.map((d) => dailyFor(d, m, cleared, first));
    picks.forEach((p, i) => { expect(p).toEqual({ date: dates[i], id: dailyPick(dates[i], m, cleared) }); });
    expect(picks.some((p) => p.id !== 'a')).toBe(true);
  });

  test('dailyFor re-picks when the stored scene is gone', () => {
    const p = dailyFor('2026-10-20', ['a', 'b'], new Set(['a']), { date: '2026-10-20', id: 'gone' });
    expect(p).toEqual({ date: '2026-10-20', id: dailyPick('2026-10-20', ['a', 'b'], new Set(['a'])) });
  });

  test('todayKey formats local date', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
