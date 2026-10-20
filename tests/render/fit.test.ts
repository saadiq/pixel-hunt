import { describe, expect, test } from 'bun:test';
import { fitBoard } from '../../src/render/fit';

describe('fitBoard', () => {
  test('56x56 on a 358x420 stage fits width with cells >= 6px', () => {
    const f = fitBoard(358, 420, 56, 56);
    expect(f.cs).toBeGreaterThanOrEqual(6);
    expect(f.CW).toBeLessThanOrEqual(358);
  });
  test('44x56 portrait grid fits a 288x300 stage vertically', () => {
    expect(fitBoard(288, 300, 44, 56).CH).toBeLessThanOrEqual(300);
  });
  test('landscape 812x200 fits vertically', () => {
    expect(fitBoard(812, 200, 30, 30).CH).toBeLessThanOrEqual(200);
  });
  test('short landscape stages shrink cells below 5px so the canvas fits both axes', () => {
    for (const [W, H] of [[56, 60], [40, 36]]) {
      const f = fitBoard(488, 160, W, H);
      expect(f.CW + 12).toBeLessThanOrEqual(488);
      expect(f.CH + 12).toBeLessThanOrEqual(160);
      expect(f.cs).toBeGreaterThan(0);
    }
    expect(fitBoard(488, 160, 56, 60).cs).toBeLessThan(5);
  });
  test('thin track and nest keep holes visible', () => {
    const f = fitBoard(400, 600, 40, 40);
    expect(f.T).toBeCloseTo(f.cs * 0.6);
    expect(f.nest).toBeGreaterThanOrEqual(14);
  });
  test('never NaN, zero or negative for tiny or odd stages', () => {
    for (const [sw, sh] of [[0, 0], [5, 5], [-10, 100], [NaN, 300], [100, NaN], [Infinity, 50]]) {
      const f = fitBoard(sw, sh, 44, 56);
      for (const v of [f.cs, f.T, f.nest, f.CW, f.CH]) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThan(0);
      }
    }
  });
});
