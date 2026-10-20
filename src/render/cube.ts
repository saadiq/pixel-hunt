// Glossy raised-cube cell look shared by the game canvas, the thumbnails and the PNG export.

export interface Rect { x: number; y: number; w: number; h: number; hex: string }

/** Below this cell size the seam and highlights cannot be seen, so a cube is drawn as a flat square. */
export const MIN_CUBE_PX = 4;

/** Splits a #rrggbb colour into its [r, g, b] channels (0-255). */
export function hexRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

/** Mixes a #rrggbb colour toward white (t > 0) or black (t < 0) by |t|. */
export function shade(hex: string, t: number): string {
  const target = t > 0 ? 255 : 0, k = Math.abs(t);
  return '#' + hexRgb(hex).map((v) => Math.round(v + (target - v) * k).toString(16).padStart(2, '0')).join('');
}

/**
 * The rectangles of one soft glossy cube ("style B") in a cell of size s at (x, y), painted in order:
 * the seam (the whole cell in a darker tone of the cube's own colour, so there is no dark grout),
 * a slightly darker body whose bottom and right edges show as a soft shade, the true-colour face,
 * a lighter top highlight band and a small gloss spot.
 */
export function cubeRects(x: number, y: number, s: number, hex: string): Rect[] {
  if (s < MIN_CUBE_PX) return [{ x, y, w: Math.ceil(s), h: Math.ceil(s), hex }]; // ceil: no seams between flat cells
  const gap = Math.max(0.6, s * 0.11);
  const w = s - gap;
  const hl = Math.max(0.8, w * 0.16), sh = Math.max(0.8, w * 0.18);
  return [
    { x, y, w: s, h: s, hex: shade(hex, -0.28) },
    { x, y, w, h: w, hex: shade(hex, -0.12) },
    { x, y, w: w - sh * 0.5, h: w - sh, hex },
    { x: x + w * 0.08, y, w: w * 0.78, h: hl, hex: shade(hex, 0.3) },
    { x: x + w * 0.14, y: y + hl * 0.2, w: w * 0.28, h: hl * 0.9, hex: shade(hex, 0.55) },
  ];
}

/** Draws a glossy cube for one cell. */
export function drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  for (const r of cubeRects(x, y, s, hex)) {
    ctx.fillStyle = r.hex;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}
