import { describe, expect, test } from 'bun:test';
import { enclosureDepth } from '../../scripts/depth';

const pal = { a: '#ff0000', b: '#00ff00', c: '#0000ff' };

describe('enclosureDepth', () => {
  test('a ring of b around a centre c inside a: max 2, avg counts each layer', () => {
    const rows = ['aaaaa', 'abbba', 'abcba', 'abbba', 'aaaaa'];
    const d = enclosureDepth({ rows, pal });
    expect(d.max).toBe(2);
    expect(d.avg).toBeCloseTo((0 * 16 + 1 * 8 + 2 * 1) / 25);
    expect(d.deep3).toBe(0);
  });
  test('a uniform board has depth 0 everywhere', () => {
    const d = enclosureDepth({ rows: ['aaaa', 'aaaa', 'aaaa'], pal });
    expect(d).toEqual({ max: 0, avg: 0, deep3: 0 });
  });
  test('deep3 is the fraction of cells at depth 3 or more', () => {
    const rows = ['aaaaaaa', 'abbbbba', 'abccbba', 'abcacba', 'abcccba', 'abbbbba', 'aaaaaaa'];
    const d = enclosureDepth({ rows, pal });
    expect(d.max).toBe(3);
    expect(d.deep3).toBeCloseTo(1 / 49);
  });
});
