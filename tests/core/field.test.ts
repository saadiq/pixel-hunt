import { expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { distField, holeCol, pickNear } from '../../src/core/path';
import { stepSlots } from '../../src/core/step';
import type { Slots } from '../../src/core/types';
import { bridge, upscale } from '../fixtures/proto';

// Reference tick: the original full-BFS + full-scan rules.
function refStep(g: Int8Array, W: number, H: number, slots: Slots): boolean {
  let ate = false;
  slots.forEach((sq, si) => {
    if (!sq) return;
    const i = pickNear(g, W, H, sq.color, distField(g, W, H, holeCol(si, slots.length, W)));
    if (i < 0) return;
    g[i] = -1;
    sq.cap--;
    ate = true;
    if (sq.cap <= 0) slots[si] = null;
  });
  return ate;
}

test('incremental stepSlots matches the full-search rules, including outside grid edits', () => {
  const level = { ...sceneLevel(bridge), ...upscale(bridge, 24) };
  const { W, H, grid, colors } = parseArt(level);
  const a = grid.slice(), b = grid.slice();
  const mk = (): Slots => Array.from({ length: 4 }, (_, k) => ({ color: (k * 2) % colors.length, cap: 30, total: 30 }));
  const sa = mk(), sb = mk();
  let seed = 5;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let t = 0; t < 600; t++) {
    expect(stepSlots(a, W, H, sa)).toBe(refStep(b, W, H, sb));
    expect(a).toEqual(b);
    if (t % 50 === 49) { // outside edits: eat a random cell, and refill a slot with a new colour
      const i = Math.floor(rnd() * W * H);
      a[i] = -1; b[i] = -1;
      const k = t % 4, c = Math.floor(rnd() * colors.length);
      sa[k] = { color: c, cap: 20, total: 20 }; sb[k] = { color: c, cap: 20, total: 20 };
    }
  }
  expect(sa).toEqual(sb);
});
