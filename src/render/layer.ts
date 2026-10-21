// Offscreen board layer: the ground plus every settled block, drawn once per reset/resize and then
// patched one cell at a time as blocks start being chewed or are eaten. Each frame just blits it.
import type { Cells, Geom } from './ants';
import { type CubeShades, drawCube } from './cube';

export interface Layer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** The ground alone, used to restore a cell's background before redrawing around it. */
  ground: HTMLCanvasElement;
  /** 1 where the layer currently shows a full-size block. */
  solid: Uint8Array;
  dpr: number;
}

const settled = (cells: Cells, i: number): boolean => cells.vis[i] >= 0 && !cells.chew[i];

function offscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

const cellX = (geo: Geom, i: number): number => geo.ox + (i % geo.W) * geo.cs;
const cellY = (geo: Geom, i: number): number => geo.oy + ((i / geo.W) | 0) * geo.cs;

/** Builds the layer at device size w x h. `paintGround` draws the static ground in CSS pixels. */
export function buildLayer(
  w: number, h: number, dpr: number, geo: Geom, cells: Cells, shades: CubeShades[],
  paintGround: (ctx: CanvasRenderingContext2D) => void,
): Layer {
  const [ground, gctx] = offscreen(w, h);
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintGround(gctx);
  const [canvas, ctx] = offscreen(w, h);
  ctx.drawImage(ground, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const solid = new Uint8Array(geo.W * geo.H);
  for (let i = 0; i < solid.length; i++) {
    if (!settled(cells, i)) continue;
    solid[i] = 1;
    drawCube(ctx, cellX(geo, i), cellY(geo, i), geo.cs, shades[cells.vis[i]]);
  }
  return { canvas, ctx, ground, solid, dpr };
}

/**
 * Repaints one cell exactly as a full redraw would: ground, then every settled block that can touch the
 * cell's device-pixel box, in index order. Tiny flat cells round up to whole pixels, so the reach grows.
 */
function patch(L: Layer, geo: Geom, cells: Cells, shades: CubeShades[], i: number): void {
  const { W, H, cs } = geo, d = L.dpr, c = L.ctx;
  const x0 = Math.floor(cellX(geo, i) * d), y0 = Math.floor(cellY(geo, i) * d);
  const x1 = Math.ceil((cellX(geo, i) + cs) * d), y1 = Math.ceil((cellY(geo, i) + cs) * d);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.beginPath();
  c.rect(x0, y0, x1 - x0, y1 - y0);
  c.clip();
  c.drawImage(L.ground, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  c.setTransform(d, 0, 0, d, 0, 0);
  const reach = Math.ceil(1 / cs) + 1, r0 = (i / W) | 0, c0 = i % W;
  for (let r = Math.max(0, r0 - reach); r <= Math.min(H - 1, r0 + reach); r++) {
    for (let k = Math.max(0, c0 - reach); k <= Math.min(W - 1, c0 + reach); k++) {
      const j = r * W + k;
      if (L.solid[j]) drawCube(c, cellX(geo, j), cellY(geo, j), cs, shades[cells.vis[j]]);
    }
  }
  c.restore();
}

/** Brings the layer up to date with `cells`; returns the cells being chewed (drawn per frame, shrinking). */
export function syncLayer(L: Layer, geo: Geom, cells: Cells, shades: CubeShades[]): number[] {
  const chewing: number[] = [], changed: number[] = [];
  for (let i = 0; i < L.solid.length; i++) {
    const now = settled(cells, i) ? 1 : 0;
    if (cells.vis[i] >= 0 && cells.chew[i]) chewing.push(i);
    if (now === L.solid[i]) continue;
    L.solid[i] = now;
    changed.push(i);
  }
  // Patch only after every flag is current: a patch redraws its neighbours, and one still flagged solid
  // after being eaten (vis -1) has no tones to draw with.
  for (const i of changed) patch(L, geo, cells, shades, i);
  return chewing;
}

/** Draws the chewed blocks shrinking toward their centres over `ms`. */
export function drawChewing(
  ctx: CanvasRenderingContext2D, geo: Geom, cells: Cells, shades: CubeShades[], chewing: number[], now: number, ms: number,
): void {
  const cs = geo.cs;
  for (const i of chewing) {
    const p = Math.min(1, (now - cells.chew[i]) / ms), s = cs * (1 - p * 0.85), o = (cs - s) / 2;
    drawCube(ctx, cellX(geo, i) + o, cellY(geo, i) + o, s, shades[cells.vis[i]]);
  }
}
