import { describe, expect, test } from 'bun:test';
import type { Ant } from '../../src/render/ants';
import { targets } from '../../src/render/marks';

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
