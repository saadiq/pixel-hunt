import { describe, expect, test } from 'bun:test';
import { HOLD_MS, type PressEvent, type PressOut, IDLE, pressStep } from '../../src/ui/press';

/** Runs events from idle and collects every output. */
function run(events: PressEvent[]): PressOut[] {
  let s = IDLE;
  const outs: PressOut[] = [];
  for (const e of events) { const [n, o] = pressStep(s, e); s = n; outs.push(o); }
  return outs;
}
const sends = (o: PressOut[]) => o.filter((x) => x.send !== undefined).map((x) => x.send);
const previews = (o: PressOut[]) => o.filter((x) => x.preview !== undefined).map((x) => x.preview);

describe('pressStep', () => {
  test('hold threshold is 300 ms', () => expect(HOLD_MS).toBe(300));

  test('release at 299 ms sends', () => {
    const o = run([{ t: 'down', lane: 2, at: 0 }, { t: 'up', at: 299 }]);
    expect(sends(o)).toEqual([2]);
    expect(previews(o)).toEqual([]);
  });

  test('timer at 300 then release previews and never sends', () => {
    const o = run([{ t: 'down', lane: 1, at: 0 }, { t: 'timer', at: 300 }, { t: 'up', at: 900 }]);
    expect(sends(o)).toEqual([]);
    expect(previews(o)).toEqual([1, null]);
  });

  test('a release past the threshold sends nothing even if the timer has not fired', () => {
    expect(sends(run([{ t: 'down', lane: 1, at: 0 }, { t: 'up', at: 301 }]))).toEqual([]);
  });

  test('sliding switches the preview lane', () => {
    const o = run([{ t: 'down', lane: 0, at: 0 }, { t: 'timer', at: 300 }, { t: 'move', lane: 3 }, { t: 'up', at: 800 }]);
    expect(previews(o)).toEqual([0, 3, null]);
    expect(sends(o)).toEqual([]);
  });

  test('sliding off the lanes then releasing sends nothing', () => {
    expect(sends(run([{ t: 'down', lane: 0, at: 0 }, { t: 'move', lane: null }, { t: 'up', at: 100 }]))).toEqual([]);
  });

  test('sliding to another lane before the threshold then releasing sends nothing', () => {
    expect(sends(run([{ t: 'down', lane: 0, at: 0 }, { t: 'move', lane: 1 }, { t: 'up', at: 100 }]))).toEqual([]);
  });

  test('cancel mid-preview clears it with no send', () => {
    const o = run([{ t: 'down', lane: 2, at: 0 }, { t: 'timer', at: 300 }, { t: 'cancel' }, { t: 'up', at: 400 }]);
    expect(previews(o)).toEqual([2, null]);
    expect(sends(o)).toEqual([]);
  });

  test('cancel before the threshold sends nothing', () => {
    expect(sends(run([{ t: 'down', lane: 2, at: 0 }, { t: 'cancel' }, { t: 'up', at: 100 }]))).toEqual([]);
  });

  test('a timer before the threshold does nothing', () => {
    const o = run([{ t: 'down', lane: 2, at: 0 }, { t: 'timer', at: 150 }, { t: 'up', at: 200 }]);
    expect(previews(o)).toEqual([]);
    expect(sends(o)).toEqual([2]);
  });
});
