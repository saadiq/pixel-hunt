import { describe, expect, test } from 'bun:test';
import { HOLD_MS, IDLE, PressBinder, type PressEvent, type PressOut, pressStep } from '../../src/ui/press';

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

describe('PressBinder', () => {
  const mk = () => {
    const taps: number[] = [], previews: (number | null)[] = [];
    let fire: (() => void) | null = null;
    const b = new PressBinder((l) => taps.push(l), (l) => previews.push(l), (fn) => { fire = fn; });
    return { b, taps, previews, fire: () => fire?.() };
  };

  test('a right-click does not send', () => {
    const { b, taps } = mk();
    b.down(1, 2, 0, 0);
    b.up(1, 50);
    expect(taps).toEqual([]);
  });

  test('a second finger lifting does not send or end the first finger\'s press', () => {
    const { b, taps, previews, fire } = mk();
    b.down(1, 0, 0, 0);
    b.down(2, 0, 3, 10);
    b.up(2, 60);
    expect(taps).toEqual([]);
    fire();
    expect(previews).toEqual([0]);
    b.up(2, 400);
    expect(previews).toEqual([0]);
    b.up(1, 500);
    expect(previews).toEqual([0, null]);
  });

  test('the hold timer enters the preview even if the clock reads a hair early', () => {
    const { b, previews, fire } = mk();
    b.down(1, 0, 2, 1000);
    fire(); // whenever it fires, it means HOLD_MS has passed
    expect(previews).toEqual([2]);
  });

  test('a click with no pointer press before it taps (keyboard or assistive tech)', () => {
    const { b, taps } = mk();
    b.click(1, 5000);
    expect(taps).toEqual([1]);
  });

  test('the click that follows a pointer tap is not a second tap', () => {
    const { b, taps } = mk();
    b.down(1, 0, 1, 0);
    b.up(1, 50);
    b.click(1, 55);
    expect(taps).toEqual([1]);
  });

  test('the click that follows a preview does not send', () => {
    const { b, taps, fire } = mk();
    b.down(1, 0, 1, 0);
    fire();
    b.up(1, 600);
    b.click(1, 605);
    expect(taps).toEqual([]);
  });

  test('a press cancelled by the board does not send when the finger lifts and clicks', () => {
    const { b, taps } = mk();
    b.down(1, 0, 1, 0);
    b.cancel();
    b.up(1, 80);
    b.click(1, 85);
    expect(taps).toEqual([]);
  });

  test('with no tap handler a tap and a click do nothing, and a hold still previews', () => {
    const previews: (number | null)[] = [];
    let fire: (() => void) | null = null;
    const b = new PressBinder(null, (l) => previews.push(l), (fn) => { fire = fn; });
    b.down(1, 0, 2, 0);
    b.up(1, 50);
    b.click(2, 5000);
    b.down(1, 0, 1, 6000);
    fire!();
    b.up(1, 6400);
    expect(previews).toEqual([1, null]);
  });

  test('a press whose release was missed ends when that pointer goes down again', () => {
    const { b, taps, previews, fire } = mk();
    b.down(1, 0, 0, 0);
    fire(); // previewing lane 0; the release happens outside the window and never arrives
    expect(b.down(1, 0, 2, 5000)).toBe(true);
    b.up(1, 5050);
    expect(previews).toEqual([0, null]);
    expect(taps).toEqual([2]);
  });
});
