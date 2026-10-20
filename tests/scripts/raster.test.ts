import { describe, expect, test } from 'bun:test';
import { parseMeta, rasterize, type SceneMeta } from '../../scripts/raster';

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`;

describe('rasterize', () => {
  test('a black square on white maps cell for cell', () => {
    const art = rasterize(svg(4, 4, '<rect width="4" height="4" fill="#ffffff"/><rect x="1" y="1" width="2" height="2" fill="#000000"/>'), 4, 4);
    expect(art.rows).toEqual(['aaaa', 'abba', 'abba', 'aaaa']);
    expect(art.pal.a).toBe('#ffffff');
    expect(art.pal.b).toBe('#000000');
  });

  test('anti-aliased edges never add colours outside the palette', () => {
    const art = rasterize(svg(12, 12, '<rect width="12" height="12" fill="#ffffff"/><circle cx="6" cy="6" r="4.3" fill="#e2412f"/>'), 12, 12);
    expect(Object.keys(art.pal).length).toBe(2);
    expect(new Set(art.rows.join('')).size).toBe(2);
  });

  test('transparent samples count as the metadata background colour', () => {
    const meta = '<metadata>{"bg":"#336699"}</metadata>';
    const art = rasterize(svg(2, 2, `${meta}<rect width="1" height="2" fill="#000000"/>`), 2, 2);
    expect(art.rows).toEqual(['ab', 'ab']);
    expect(art.pal.b).toBe('#336699');
  });
});

describe('parseMeta', () => {
  test('returns the JSON fields', () => {
    const m: SceneMeta = { id: 'x', name: 'X', blurb: 'b', band: 'easy', W: 42, H: 44, slots: 5, lanes: 3, chunk: [40, 60], wait: 0.3, bg: '#ffffff' };
    expect(parseMeta(svg(42, 44, `<metadata>${JSON.stringify(m)}</metadata>`))).toEqual(m);
  });

  test('throws when the metadata is missing', () => {
    expect(() => parseMeta(svg(2, 2, ''))).toThrow(/metadata/i);
  });
});
