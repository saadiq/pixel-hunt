import { describe, expect, test } from 'bun:test';
import type { Ant } from '../../src/render/ants';
import { reachable, remaining, targets } from '../../src/render/marks';

const ant = (i: number, color: number, phase: number): Ant =>
  ({ i, color, pts: [], cum: [], len: 0, tx: 0, ty: 0, t0: 0, go: 0, chew: 0, phase });

describe('targets', () => {
  test('marks cells of ants still heading out or chewing, with their colour', () => {
    const m = targets([ant(5, 2, 0), ant(9, 1, 1), ant(3, 0, 2)]);
    expect([...m.entries()].sort((a, b) => a[0] - b[0])).toEqual([[5, 2], [9, 1]]);
  });
  test('an ant carrying its bite home no longer marks a target', () => {
    expect(targets([ant(4, 0, 2)]).size).toBe(0);
  });
});

describe('reachable', () => {
  // 3x3 on screen: colour 1 on the border at 1 and 7, sealed in the centre at 4.
  const vis = Int16Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  test('lights exposed blocks of the colour, not buried ones', () => {
    expect([...reachable(vis, 3, 3, 1, new Map())]).toEqual([1, 7]);
  });
  test('leaves out blocks an ant is already heading for', () => {
    expect([...reachable(vis, 3, 3, 1, new Map([[7, 1]]))]).toEqual([1]);
  });
  test('follows the screen: a block cleared on screen exposes its neighbour', () => {
    const v = vis.slice(); v[3] = -1;
    expect([...reachable(v, 3, 3, 1, new Map())]).toEqual([1, 4, 7]);
  });
});

describe('remaining', () => {
  const vis = Int16Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]);
  test('lights every block of the colour, buried ones too', () => {
    expect(remaining(vis, 3, 3, 1, new Map())).toEqual([1, 4, 7]);
  });
  test('leaves out blocks an ant is already heading for', () => {
    expect(remaining(vis, 3, 3, 1, new Map([[4, 1]]))).toEqual([1, 7]);
  });
});
