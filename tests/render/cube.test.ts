import { describe, expect, test } from 'bun:test';
import { cubeRects, shade } from '../../src/render/cube';

describe('shade', () => {
  test('mixes toward white and black', () => {
    expect(shade('#804020', 1)).toBe('#ffffff');
    expect(shade('#804020', -1)).toBe('#000000');
    expect(shade('#804020', 0)).toBe('#804020');
  });
});

describe('cubeRects', () => {
  test('a 10px cube is inset by its gap, with a dark base, light bevel and true-colour face', () => {
    const [base, light, face] = cubeRects(0, 0, 10, '#808080');
    expect(base.x).toBeCloseTo(0.4);
    expect(base.w).toBeCloseTo(9.2);
    expect(base.hex < '#808080').toBe(true);
    expect(light.hex > '#808080').toBe(true);
    expect(face.hex).toBe('#808080');
    expect(face.x + face.w).toBeLessThan(base.x + base.w);
  });
  test('a tiny cell is one flat square with no gap', () => {
    expect(cubeRects(2, 3, 1.5, '#123456')).toEqual([{ x: 2, y: 3, w: 2, h: 2, hex: '#123456' }]);
  });
});
