import { describe, expect, test } from 'bun:test';
import { checkColors, checkDeals, checkPalette, checkStructure, deltaE2000, estimateWinRate, labDelta2000 } from '../../scripts/checks';
import type { Scene } from '../../src/core/types';
import { bridge } from '../fixtures/proto';

const base: Scene = {
  id: 't', name: 'T', blurb: '', band: 'easy', slots: 5, lanes: 3, chunk: [2, 4], wait: 0.3,
  rows: ['aab', 'aab'], pal: { a: '#ff0000', b: '#0000ff' },
};

describe('checkStructure', () => {
  test('flags ragged rows', () => {
    const errs = checkStructure({ ...base, rows: ['aab', 'aa'] });
    expect(errs.some((e) => /ragged/i.test(e))).toBe(true);
  });
  test('flags unknown chars', () => {
    const errs = checkStructure({ ...base, rows: ['aaz', 'aab'] });
    expect(errs.some((e) => /unknown/i.test(e))).toBe(true);
  });
  test('flags a grid outside its band', () => {
    const errs = checkStructure(base);
    expect(errs.some((e) => /width/i.test(e))).toBe(true);
    expect(errs.some((e) => /height/i.test(e))).toBe(true);
  });
  test('flags slots outside the band', () => {
    const rows = Array.from({ length: 36 }, () => 'ab'.repeat(20));
    expect(checkStructure({ ...base, rows, slots: 3 })).toEqual(['slots 3 outside easy band 4-5']);
    const hard = checkStructure({ ...base, rows, band: 'hard', slots: 4 });
    expect(hard).toContain('slots 4 outside hard band 2-3');
  });
  test('accepts a grid inside its band', () => {
    const rows = Array.from({ length: 36 }, () => 'ab'.repeat(20));
    expect(checkStructure({ ...base, rows })).toEqual([]);
    expect(checkStructure({ ...base, rows, waitSlack: 1 })).toEqual([]);
    // width belongs to the art, so a small grid can still be a hard board
    expect(checkStructure({ ...base, rows, band: 'hard', slots: 3 })).toEqual([]);
  });
  test('flags a non-integer or negative waitSlack', () => {
    const rows = Array.from({ length: 36 }, () => 'ab'.repeat(20));
    expect(checkStructure({ ...base, rows, waitSlack: -1 })).toEqual(['bad waitSlack -1']);
    expect(checkStructure({ ...base, rows, waitSlack: 1.5 })).toEqual(['bad waitSlack 1.5']);
  });
});

describe('colour difference', () => {
  test('labDelta2000 matches Sharma et al. reference pairs', () => {
    expect(labDelta2000([50, 2.6772, -79.7751], [50, 0, -82.7485])).toBeCloseTo(2.0425, 4);
    expect(labDelta2000([50, 0, 0], [50, -1, 2])).toBeCloseTo(2.3669, 4);
    expect(labDelta2000([50, 2.5, 0], [73, 25, -18])).toBeCloseTo(27.1492, 4);
  });
  test('deltaE2000: white against a pale grey is too close to tell', () => {
    expect(deltaE2000('#ffffff', '#e6e6e6')).toBeLessThan(12);
  });
  test('deltaE2000: red against blue is far apart', () => {
    expect(deltaE2000('#ff0000', '#0000ff')).toBeGreaterThan(40);
  });
  test('checkPalette flags two accents that look alike', () => {
    const p = { name: 'x', dark: '#1a1a1a', light: '#f5f0e6', acc: ['#c0392b', '#c23c2e', '#2e86c1'] };
    expect(checkPalette(p).some((e) => /similar/i.test(e))).toBe(true);
  });
  test('checkPalette passes a distinct palette', () => {
    expect(checkPalette({ name: 'x', dark: '#1a1a1a', light: '#f5f0e6', acc: ['#c0392b', '#2e86c1', '#f1c40f'] })).toEqual([]);
  });
});

describe('checkColors', () => {
  test('flags a colour with 3 cells', () => {
    const s = { ...base, rows: ['aaaa', 'aaab'] };
    expect(checkColors(s).some((e) => /cells/i.test(e))).toBe(true);
  });
  test('flags near-identical colours', () => {
    const s = { ...base, rows: ['aaaabbbb'], pal: { a: '#ff0000', b: '#fe0101' } };
    expect(checkColors(s).some((e) => /similar/i.test(e))).toBe(true);
  });
  test('passes distinct colours with enough cells', () => {
    expect(checkColors({ ...base, rows: ['aaaabbbb'] })).toEqual([]);
  });
  test('flags more than 9 colours', () => {
    const chars = [...'abcdefghij'];
    const pal: Record<string, string> = {};
    chars.forEach((c, i) => { pal[c] = `#${(i * 25).toString(16).padStart(2, '0')}${((i * 90) % 256).toString(16).padStart(2, '0')}00`; });
    const rows = [chars.map((c) => c.repeat(4)).join('')];
    expect(checkColors({ ...base, rows, pal }).some((e) => /too many/i.test(e))).toBe(true);
  });
});

describe('estimateWinRate', () => {
  test('counts a throwing deal as a loss instead of throwing', () => {
    const broken = { ...base, lanes: 0, rows: ['aaaabbbb'] };
    expect(estimateWinRate(broken, 5)).toBe(0);
  });
});

describe('checkDeals', () => {
  test('bridge deals all replay', () => {
    const r = checkDeals(bridge, 20);
    expect(r.failures).toBe(0);
    expect(r.medianTaps).toBeGreaterThan(0);
  });
});
