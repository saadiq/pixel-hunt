import { describe, expect, test } from 'bun:test';
import { buildScene, sceneSource } from '../../scripts/build-scenes';
import { parseMeta, rasterize, svgPalette, type SceneMeta } from '../../scripts/raster';

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

  test('off-palette blended samples snap to the nearest palette colour', () => {
    // 80%-opaque fills over white render as pinks and pale blues that are not in the palette.
    const body = '<rect width="4" height="2" fill="#ffffff"/>'
      + '<rect width="2" height="2" fill="#ff0000" fill-opacity="0.8"/>'
      + '<rect x="2" width="2" height="2" fill="#0000ff" fill-opacity="0.8"/>';
    const art = rasterize(svg(4, 2, body), 4, 2);
    expect(art.rows).toEqual(['aabb', 'aabb']); // white is fully covered, so it is dropped
    expect(art.pal).toEqual({ a: '#ff0000', b: '#0000ff' });
  });

  test('a tied cell goes to the darker colour, whatever the declaration order', () => {
    const whiteFirst = rasterize(svg(1, 1, '<rect width="1" height="1" fill="#ffffff"/><rect width="0.5" height="1" fill="#000000"/>'), 1, 1);
    expect(whiteFirst.pal[whiteFirst.rows[0]]).toBe('#000000');
    const blackFirst = rasterize(svg(1, 1, '<rect width="1" height="1" fill="#000000"/><rect width="0.5" height="1" fill="#ffffff"/>'), 1, 1);
    expect(blackFirst.pal[blackFirst.rows[0]]).toBe('#000000');
  });

  test('honours a non-default supersample factor', () => {
    // A rect 0.4 cells wide: at ss=2 one of two samples is black (tie, so black); at ss=8 only 3 of 8 are.
    const s = svg(1, 1, '<rect width="1" height="1" fill="#ffffff"/><rect width="0.4" height="1" fill="#000000"/>');
    expect(rasterize(s, 1, 1, { ss: 2 }).pal.a).toBe('#000000');
    expect(rasterize(s, 1, 1).pal.a).toBe('#ffffff');
    expect(rasterize(svg(4, 4, '<rect width="4" height="4" fill="#ffffff"/><rect x="1" y="1" width="2" height="2" fill="#000000"/>'), 4, 4, { ss: 3 }).rows)
      .toEqual(['aaaa', 'abba', 'abba', 'aaaa']);
  });

  test('transparent samples count as the metadata background colour', () => {
    const meta = '<metadata>{"bg":"#336699"}</metadata>';
    const art = rasterize(svg(2, 2, `${meta}<rect width="1" height="2" fill="#000000"/>`), 2, 2);
    expect(art.rows).toEqual(['ab', 'ab']);
    expect(art.pal.b).toBe('#336699');
  });
});

describe('svgPalette', () => {
  test('lists 6-digit fill and stroke colours in order, ignoring none and url()', () => {
    const s = svg(2, 2, '<rect fill="#AABBCC" stroke="none"/><g clip-path="url(#c)"><path fill="url(#g)" stroke="#000000" stroke-width="1"/></g>');
    expect(svgPalette(s)).toEqual(['#aabbcc', '#000000']);
  });
  test('throws on colours that are not #rrggbb', () => {
    expect(() => svgPalette(svg(2, 2, '<rect fill="#fff"/>'))).toThrow(/#fff/);
    expect(() => svgPalette(svg(2, 2, '<rect stroke="rgb(0,0,0)"/>'))).toThrow(/rgb/);
    expect(() => svgPalette(svg(2, 2, '<rect style="fill:red"/>'))).toThrow(/red/);
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

describe('buildScene waitSlack', () => {
  const meta = (extra: object) => JSON.stringify({ id: 'x', name: 'X', blurb: 'b', band: 'hard', W: 2, H: 2, slots: 3, lanes: 4, chunk: [1, 2], wait: 0.9, bg: '#ffffff', ...extra });
  const body = '<rect width="2" height="2" fill="#ffffff"/>';

  test('passes waitSlack from metadata into the scene and its source', () => {
    const s = buildScene(svg(2, 2, `<metadata>${meta({ waitSlack: 1 })}</metadata>${body}`));
    expect(s.waitSlack).toBe(1);
    expect(sceneSource(s)).toContain('waitSlack: 1,');
  });

  test('omits waitSlack when the metadata has none', () => {
    const s = buildScene(svg(2, 2, `<metadata>${meta({})}</metadata>${body}`));
    expect('waitSlack' in s).toBe(false);
    expect(sceneSource(s)).not.toContain('waitSlack');
  });
});
