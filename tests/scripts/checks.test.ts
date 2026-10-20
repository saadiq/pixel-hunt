import { describe, expect, test } from 'bun:test';
import { checkColors, checkDeals, checkStructure, estimateWinRate } from '../../scripts/checks';
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
  test('accepts a grid inside its band', () => {
    const rows = Array.from({ length: 24 }, () => 'ab'.repeat(15));
    expect(checkStructure({ ...base, rows })).toEqual([]);
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
