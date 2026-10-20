import { describe, expect, test } from 'bun:test';
import { sceneLevel } from '../../src/core/board';
import { newGame, tapLane, tick } from '../../src/state/game';
import { defaults, fromRun, load, store, toRun } from '../../src/state/save';
import type { SaveV1 } from '../../src/state/save';
import { d20 } from '../fixtures/proto';

const fake = (init?: string): Storage => {
  const m = new Map<string, string>();
  if (init !== undefined) m.set('crumbhunt.v1', init);
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } } as unknown as Storage;
};
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } } as unknown as Storage;
const scenes = { [d20.id]: d20 };
const mk = () => newGame({ kind: 'campaign', id: d20.id }, sceneLevel(d20), 7);

describe('load/store', () => {
  test('defaults for throwing, bad, wrong-version and null data', () => {
    expect(load(throwing)).toEqual(defaults());
    expect(load(fake('{bad json'))).toEqual(defaults());
    expect(load(fake('{"v":99}'))).toEqual(defaults());
    expect(load(fake('null'))).toEqual(defaults());
    expect(load(fake())).toEqual(defaults());
    expect(defaults().prefs).toEqual({ sound: true, fast: false, band: 'medium' });
  });

  test('store never throws; roundtrips; keeps unknown cleared ids', () => {
    expect(() => store(defaults(), throwing)).not.toThrow();
    const s = fake();
    const v: SaveV1 = { ...defaults(), cleared: ['gone', 'a'], wins: { easy: 1, medium: 2, hard: 3 } };
    store(v, s);
    expect(load(s)).toEqual(v);
  });

  test('garbage field types fall back to defaults', () => {
    const l = load(fake('{"v":1,"cleared":"x","prefs":{"band":"nope","sound":3},"wins":{"easy":"q"}}'));
    expect(l).toEqual(defaults());
  });
});

describe('toRun/fromRun', () => {
  test('roundtrip survives JSON and keeps state', () => {
    const g = mk();
    tapLane(g, g.line[0]);
    tick(g);
    tapLane(g, g.line[1]);
    g.undos = 2;
    g.hints = 1;
    const r = JSON.parse(JSON.stringify(toRun(g, 7)));
    const h = fromRun(r, scenes);
    expect(h).not.toBeNull();
    if (!h) return;
    expect(Array.from(h.grid)).toEqual(Array.from(g.grid));
    expect(h.lanes).toEqual(g.lanes);
    expect(h.slots).toEqual(g.slots);
    expect(h.hist.length).toBe(g.hist.length);
    expect([h.undos, h.hints, h.taps, h.onLine, h.remaining]).toEqual([2, 1, g.taps, g.onLine, g.remaining]);
    expect(h.board.W).toBe(g.board.W);
  });

  test('unknown ids return null', () => {
    const r = toRun(mk(), 7);
    expect(fromRun({ ...r, meta: { kind: 'campaign', id: 'gone' } }, scenes)).toBeNull();
    expect(fromRun({ ...r, meta: { kind: 'daily', date: '2026-10-19', id: 'gone' } }, scenes)).toBeNull();
    expect(fromRun({ ...r, meta: { kind: 'random', band: 'easy', seed: 1 } }, scenes)).toBeNull();
  });

  test('structurally invalid runs return null', () => {
    const r = toRun(mk(), 7);
    expect(fromRun({ ...r, grid: r.grid.slice(1) }, scenes)).toBeNull();
    expect(fromRun({ ...r, lanes: r.lanes.slice(1) }, scenes)).toBeNull();
    expect(fromRun({ ...r, slots: [] }, scenes)).toBeNull();
    expect(fromRun({} as never, scenes)).toBeNull();
  });

  test('bad scalars and out-of-range values return null', () => {
    const r = toRun(mk(), 7);
    expect(fromRun({ ...r, undos: 'x' as unknown as number }, scenes)).toBeNull();
    expect(fromRun({ ...r, hints: 4 }, scenes)).toBeNull();
    expect(fromRun({ ...r, onLine: 1 as unknown as boolean }, scenes)).toBeNull();
    expect(fromRun({ ...r, line: [99] }, scenes)).toBeNull();
    expect(fromRun({ ...r, grid: r.grid.map(() => 99) }, scenes)).toBeNull();
    const lanes = r.lanes.map((q) => q.map((s) => ({ ...s, color: 99 })));
    expect(fromRun({ ...r, lanes }, scenes)).toBeNull();
  });
});
