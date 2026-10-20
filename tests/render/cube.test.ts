import { describe, expect, test } from 'bun:test';
import { cubeRects, cubeShades, hexRgb, shade, shadeCache } from '../../src/render/cube';

describe('shade', () => {
  test('mixes toward white and black', () => {
    expect(shade('#804020', 1)).toBe('#ffffff');
    expect(shade('#804020', -1)).toBe('#000000');
    expect(shade('#804020', 0)).toBe('#804020');
  });
});

const luma = (hex: string) => hexRgb(hex).reduce((a, v) => a + v, 0);
/** Channel ratios: two tones of one hue scale every channel by the same factor. */
const ratios = (hex: string) => {
  const [r, g, b] = hexRgb(hex);
  return [r / (g || 1), g / (b || 1)];
};

describe('cubeRects (style B)', () => {
  const face = '#c06030';
  const rects = cubeRects(0, 0, 10, face);
  const seam = rects[0];

  test('the seam fills the cell in a darker tone of the cube colour, not a fixed dark grout', () => {
    expect(seam).toMatchObject({ x: 0, y: 0, w: 10, h: 10 });
    expect(luma(seam.hex)).toBeLessThan(luma(face));
    const [a, b] = ratios(seam.hex), [fa, fb] = ratios(face);
    expect(a).toBeCloseTo(fa, 1);
    expect(b).toBeCloseTo(fb, 1);
    expect(cubeRects(0, 0, 10, '#3050c0')[0].hex).not.toBe(seam.hex);
  });
  test('draws the true face colour, a lighter top highlight and a darker bottom shade', () => {
    const faceRect = rects.find((r) => r.hex === face)!;
    expect(faceRect).toBeDefined();
    const lighter = rects.filter((r) => luma(r.hex) > luma(face));
    expect(lighter.length).toBeGreaterThan(0);
    expect(Math.min(...lighter.map((r) => r.y))).toBeLessThanOrEqual(faceRect.y);
    const body = rects.find((r) => r !== seam && luma(r.hex) < luma(face))!;
    expect(body.y + body.h).toBeGreaterThan(faceRect.y + faceRect.h);
  });
  test('every rect stays inside its cell', () => {
    for (const r of cubeRects(5, 7, 10, face)) {
      expect(r.x).toBeGreaterThanOrEqual(5);
      expect(r.y).toBeGreaterThanOrEqual(7);
      expect(r.x + r.w).toBeLessThanOrEqual(15 + 1e-9);
      expect(r.y + r.h).toBeLessThanOrEqual(17 + 1e-9);
    }
  });
  test('a tiny cell is one flat square with no gap', () => {
    expect(cubeRects(2, 3, 1.5, '#123456')).toEqual([{ x: 2, y: 3, w: 2, h: 2, hex: '#123456' }]);
  });
});

describe('shade cache', () => {
  test('precomputed tones are the same strings shade() gives', () => {
    for (const hex of ['#c06030', '#3050c0', '#000000', '#ffffff', '#1a2b3c']) {
      expect(cubeShades(hex)).toEqual({
        seam: shade(hex, -0.28), body: shade(hex, -0.12), face: hex, hl: shade(hex, 0.3), gloss: shade(hex, 0.55),
      });
    }
  });
  test('one entry per palette colour, and rects from cached tones match rects from the hex', () => {
    const pal = ['#c06030', '#3050c0', '#123456'];
    const cache = shadeCache(pal);
    expect(cache.length).toBe(3);
    pal.forEach((hex, k) => {
      for (const s of [10, 7.3, 3.2]) expect(cubeRects(1.5, 2.25, s, cache[k])).toEqual(cubeRects(1.5, 2.25, s, hex));
    });
  });
});
