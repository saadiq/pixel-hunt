// Raised-cube cell look shared by the game canvas, the thumbnails and the PNG export.

export interface Rect { x: number; y: number; w: number; h: number; hex: string }

/** Below this cell size the bevel and gap cannot be seen, so a cube is drawn as a flat square. */
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
 * The rectangles of one raised cube in a cell of size s at (x, y), painted in order:
 * a dark base, a light top-left bevel, then the face. The cell is inset by a gap of max(0.5, s*0.08).
 */
export function cubeRects(x: number, y: number, s: number, hex: string): Rect[] {
  if (s < MIN_CUBE_PX) return [{ x, y, w: Math.ceil(s), h: Math.ceil(s), hex }]; // ceil: no seams between flat cells
  const gap = Math.max(0.5, s * 0.08);
  const x0 = x + gap / 2, y0 = y + gap / 2, w = s - gap;
  const bevel = Math.max(1, w * 0.16);
  return [
    { x: x0, y: y0, w, h: w, hex: shade(hex, -0.32) },
    { x: x0, y: y0, w: w - bevel, h: w - bevel, hex: shade(hex, 0.38) },
    { x: x0 + bevel, y: y0 + bevel, w: w - 2 * bevel, h: w - 2 * bevel, hex },
  ];
}

/** Draws a raised cube for one cell. */
export function drawCube(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  for (const r of cubeRects(x, y, s, hex)) {
    ctx.fillStyle = r.hex;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}
