import { describe, expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { closer, exposedMask, holeCol, minAround, nestField, pickNear, tracePath } from '../../src/core/path';
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

describe('nestField', () => {
  test('seeds the whole bottom track', () => {
    const W = 5, H = 4, EW = W + 2;
    const d = nestField(new Int8Array(W * H).fill(-1), W, H);
    for (let c = -1; c <= W; c++) expect(d[(H + 1) * EW + c + 1]).toBe(0);
    expect(d[1 * EW + 1]).toBe(4); // top-left board cell
  });
});

describe('pickNear / tracePath', () => {
  // 5x3: colour 1 at the top corners (0,0) and (0,4); colour 0 elsewhere.
  const W = 5, H = 3;
  const grid = new Int8Array(W * H).fill(0);
  grid[0] = 1;
  grid[4] = 1;

  test('mirror ties go left', () => {
    const d = nestField(grid, W, H);
    expect(pickNear(grid, W, H, 1, d)).toBe(0);
    expect(minAround(d, 0, W)).toBe(minAround(d, 4, W));
  });

  test('prefers the cell nearest the bottom', () => {
    const g = new Int8Array(25).fill(1);
    g[2] = 0; // row 0, col 2: nest distance 9
    g[22] = 0; // row 4, col 2: nest distance 0
    expect(pickNear(g, 5, 5, 0, nestField(g, 5, 5))).toBe(22);
  });

  test('ties go to the centre column', () => {
    const g = new Int8Array(21).fill(0);
    for (const c of [0, 3, 6]) g[14 + c] = 1; // bottom row of 7x3
    expect(pickNear(g, 7, 3, 1, nestField(g, 7, 3))).toBe(17);
  });

  test('closer: equal distance and column, the lower cell wins', () => {
    // 3 wide: cell 7 is row 2, cell 1 is row 0, both column 1.
    expect(closer(7, 1, 2, 2, 3)).toBe(true);
    expect(closer(1, 7, 2, 2, 3)).toBe(false);
  });

  test('returns -1 when colour is absent', () => {
    expect(pickNear(grid, W, H, 2, nestField(grid, W, H))).toBe(-1);
  });

  test('returns -1 when unreachable', () => {
    const g = new Int8Array(25).fill(0);
    g[12] = 1; // sealed in the centre of 5x5
    expect(pickNear(g, 5, 5, 1, nestField(g, 5, 5))).toBe(-1);
  });

  test('tracePath starts on the bottom track and ends beside the target', () => {
    const d = nestField(grid, W, H);
    const p = tracePath(d, 4, W, H);
    const EW = W + 2;
    expect(d[p[0]]).toBe(0);
    expect(Math.floor(p[0] / EW)).toBe(H + 1);
    expect(d[p[p.length - 1]]).toBe(minAround(d, 4, W));
  });
});
