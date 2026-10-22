import { expect, test } from 'bun:test';
import { type Geom, holeY, spawnAnt } from '../../src/render/ants';

test('an ant rises from the nest directly below the start of its route', () => {
  const g: Geom = { W: 10, H: 8, cs: 10, T: 6, nest: 16, ox: 6, oy: 6, bpx: 100 };
  const EW = g.W + 2, start = (g.H + 1) * EW + 7 + 1; // bottom track, under column 7
  const a = spawnAnt(g, 7 * g.W + 7, 0, [start], 0, false, false);
  const colX = g.ox + 7.5 * g.cs;
  expect(Math.abs(a.pts[0][0] - colX)).toBeLessThanOrEqual(g.cs * 0.15);
  expect(a.pts[0][1]).toBe(holeY(g));
});

test('under reduced motion an ant still dwells on its target, so the ring and outline can be seen', () => {
  const g: Geom = { W: 10, H: 8, cs: 10, T: 6, nest: 16, ox: 6, oy: 6, bpx: 100 };
  const start = (g.H + 1) * (g.W + 2) + 8;
  expect(spawnAnt(g, 77, 0, [start], 0, true, false).chew).toBe(130);
  expect(spawnAnt(g, 77, 0, [start], 0, true, true).chew).toBe(65);
});
