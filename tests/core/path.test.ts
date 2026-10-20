import { describe, expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { distField, exposedMask, holeCol, minAround, pickNear, tracePath } from '../../src/core/path';
import { hashStr, mulberry } from '../../src/core/rng';
import { bridge, d20, upscale } from '../fixtures/proto';

describe('parseArt', () => {
  test('bridge dimensions and palette', () => {
    const b = parseArt(bridge);
    expect(b.W).toBe(28);
    expect(b.H).toBe(28);
    expect(b.colors.length).toBe(Object.keys(bridge.pal).length);
    expect(b.colors[0]).toBe(bridge.pal.p);
  });

  test('sceneLevel keys by id', () => {
    const l = sceneLevel(d20);
    expect(l.key).toBe('d20');
    expect(l.band).toBe('hard');
    expect(l.slots).toBe(3);
  });

  test('upscale fixture reaches 40 wide', () => {
    const b = parseArt(upscale(bridge, 40));
    expect(b.W).toBe(40);
    expect(b.H).toBe(40);
  });
});

describe('rng', () => {
  test('mulberry is deterministic and in [0,1)', () => {
    const a = mulberry(7), b = mulberry(7);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  test('hashStr is stable and distinguishes inputs', () => {
    expect(hashStr('crumb2026-10-19')).toBe(hashStr('crumb2026-10-19'));
    expect(hashStr('a')).not.toBe(hashStr('b'));
  });
});

describe('exposedMask', () => {
  test('3x3 filled: border exposed, centre not', () => {
    const grid = new Int8Array(9).fill(0);
    const m = exposedMask(grid, 3, 3);
    expect([...m]).toEqual([1, 1, 1, 1, 0, 1, 1, 1, 1]);
  });

  test('tunnel rule: eaten neighbour of centre exposes it', () => {
    const grid = new Int8Array(9).fill(0);
    grid[3] = -1; // left of centre, but also on the border so reachable
    const m = exposedMask(grid, 3, 3);
    expect(m[4]).toBe(1);
  });
});

describe('holeCol', () => {
  test('spreads slots across the width', () => {
    expect(holeCol(0, 4, 28)).toBe(3);
    expect(holeCol(3, 4, 28)).toBe(24);
  });
});

describe('pickNear / tracePath', () => {
  // 5x3: colour 1 at (0,0) and (0,4); colour 0 elsewhere; hole at col 4.
  const W = 5, H = 3;
  const grid = new Int8Array(W * H).fill(0);
  grid[0] = 1;
  grid[4] = 1;

  test('returns nearest cell of colour by walking distance', () => {
    const d = distField(grid, W, H, 4);
    expect(pickNear(grid, W, H, 1, d)).toBe(4);
    expect(minAround(d, 4, W)).toBeGreaterThanOrEqual(0);
  });

  test('returns -1 when colour is absent', () => {
    const d = distField(grid, W, H, 4);
    expect(pickNear(grid, W, H, 2, d)).toBe(-1);
  });

  test('returns -1 when unreachable', () => {
    const g = new Int8Array(25).fill(0);
    g[12] = 1; // sealed in the centre of 5x5
    const d = distField(g, 5, 5, 2);
    expect(pickNear(g, 5, 5, 1, d)).toBe(-1);
  });

  test('tracePath ends beside the target and starts at the hole', () => {
    const d = distField(grid, W, H, 4);
    const p = tracePath(d, 4, W, H);
    const EW = W + 2;
    expect(p[0]).toBe((H + 1) * EW + 4 + 1);
    expect(d[p[p.length - 1]]).toBe(minAround(d, 4, W));
  });
});
