import { describe, expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { deal } from '../../src/core/deal';
import type { Level, Meta } from '../../src/core/types';
import { newGame, status, tapLane, tick, undo } from '../../src/state/game';
import type { Game } from '../../src/state/game';
import { toRun } from '../../src/state/save';
import { d20 } from '../fixtures/proto';

const level = sceneLevel(d20);
const meta: Meta = { kind: 'campaign', id: d20.id };
const line = deal(level, parseArt(level), 7).line;
const count = (g: Game) => g.grid.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0);
const settle = (g: Game) => { let n = 0; while (tick(g) && n++ < 10000); };

describe('game', () => {
  test('newGame starts fresh', () => {
    const g = newGame(meta, level, 7);
    expect(g).toMatchObject({ undos: 3, taps: 0, stuck: false });
    expect(g.remaining).toBe(count(g));
    expect(status(g)).toBe('playing');
  });

  test('tapping the recorded line with settling between taps wins', () => {
    const g = newGame(meta, level, 7);
    for (const lane of line) {
      settle(g);
      expect(tapLane(g, lane)).toBe('ok');
    }
    settle(g);
    expect(g.remaining).toBe(0);
    expect(status(g)).toBe('won');
  });

  test('spam-tapping returns full, conserves blocks and ticks progress', () => {
    const g = newGame(meta, level, 7);
    const results: string[] = [];
    for (let i = 0; i < level.slots + 3; i++) results.push(tapLane(g, i % level.lanes));
    expect(results).toContain('full');
    expect(g.remaining).toBe(count(g));
    const before = g.remaining;
    tick(g);
    expect(g.remaining).toBeLessThanOrEqual(before);
    expect(g.remaining).toBe(count(g));
  });

  test('tapping an empty lane returns empty and changes nothing', () => {
    const g = newGame(meta, level, 7);
    g.lanes[0] = [];
    expect(tapLane(g, 0)).toBe('empty');
    expect(g.taps).toBe(0);
    expect(g.hist.length).toBe(0);
  });

  test('slot squads are copies, so undo snapshots stay intact', () => {
    const g = newGame(meta, level, 7);
    const lane = line[0], head = g.lanes[lane][0];
    tapLane(g, lane);
    tick(g);
    expect(g.slots.find(Boolean)).not.toBe(head);
    expect(undo(g)).toBe(true);
    expect(g.lanes[lane][0]).toMatchObject({ cap: head.total, total: head.total });
    expect(g.slots.every((s) => s === null)).toBe(true);
    expect(g.taps).toBe(0);
  });

});

describe('game undo and end states', () => {
  test('undo with empty history is a no-op; only 3 undos allowed', () => {
    const g = newGame(meta, level, 7);
    expect(undo(g)).toBe(false);
    expect(g.undos).toBe(3);
    for (let i = 0; i < 4; i++) { tapLane(g, line[i]); settle(g); }
    expect([undo(g), undo(g), undo(g), undo(g)]).toEqual([true, true, true, false]);
    expect(g.undos).toBe(0);
    expect(g.usedUndo).toBe(3);
  });

  test('undo of a tap made mid-eat stays busy while slots are occupied', () => {
    const eatsNow = (lane: number) => { const t = newGame(meta, level, 7); tapLane(t, lane); return tick(t); };
    const g = newGame(meta, level, 7);
    tapLane(g, g.lanes.findIndex((_, i) => eatsNow(i)));
    expect(tick(g)).toBe(true);
    const l = g.lanes.findIndex((x) => x.length);
    tapLane(g, l);
    expect(undo(g)).toBe(true);
    expect(g.slots.some(Boolean)).toBe(true);
  });

  test('history keeps every tap and its lane; saves keep only as many as undos (3)', () => {
    const g = newGame(meta, level, 7);
    const sent: number[] = [];
    for (let i = 0; i < 60; i++) {
      g.slots.fill(null);
      const l = g.lanes.findIndex((x) => x.length);
      if (l < 0) break;
      tapLane(g, l);
      sent.push(l);
    }
    expect(g.hist.map((h) => h.lane)).toEqual(sent);
    expect(toRun(g, 7).hist.length).toBe(3);
  });

  test('stuck is detected and undo recovers', () => {
    const art = { rows: ['aaaaa', 'aaaaa', 'aabaa', 'aaaaa', 'aaaaa'], pal: { a: '#111', b: '#eee' } };
    const lv: Level = { ...art, key: 'x', name: 'x', band: 'easy', slots: 2, lanes: 1, chunk: [1, 1], wait: 0 };
    const g = newGame({ kind: 'random', band: 'easy', seed: 1 }, lv, 1);
    const b = g.board.colors.indexOf('#eee');
    g.lanes = [[{ color: b, cap: 5, total: 5 }, { color: b, cap: 5, total: 5 }]];
    tapLane(g, 0);
    tapLane(g, 0);
    expect(tick(g)).toBe(false);
    expect(g.stuck).toBe(true);
    expect(status(g)).toBe('stuck');
    expect(undo(g)).toBe(true);
    expect(g.stuck).toBe(false);
    expect(status(g)).toBe('playing');
    expect(g.slots.some(Boolean)).toBe(true); // the first squad still holds a slot
  });

  test('newGame on the same meta resets undos', () => {
    const g = newGame(meta, level, 7);
    tapLane(g, line[0]);
    undo(g);
    const h = newGame(meta, level, 8);
    expect([h.undos, h.usedUndo, h.hist.length]).toEqual([3, 0, 0]);
  });
});
