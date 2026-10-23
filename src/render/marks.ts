// Feedback drawn over the board: rings on the blocks ants are heading for, and the reach preview.
import { exposedMask } from '../core/path';
import { textOn } from '../ui/dom';
import type { Ant, Geom } from './ants';
import { cellX, cellY } from './layer';

/** Block cell -> colour index of the ant on its way to it or chewing it. */
export function targets(ants: Ant[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of ants) if (a.phase < 2) m.set(a.i, a.color);
  return m;
}

/** A ring in the ant's colour, edged in a contrasting ink, on each targeted block. Pulses unless motion is reduced. */
export function drawMarkers(
  ctx: CanvasRenderingContext2D, g: Geom, marks: Map<number, number>, colors: string[], now: number, reduce: boolean,
): void {
  if (!marks.size) return;
  const cs = g.cs, w = Math.max(1.5, cs * 0.16), pulse = reduce ? 0 : Math.sin(now / 90) * cs * 0.04;
  for (const [i, c] of marks) {
    const inset = w / 2 + 0.5 - pulse, x = cellX(g, i) + inset, y = cellY(g, i) + inset, s = cs - 2 * inset;
    ctx.lineWidth = w + 2;
    ctx.strokeStyle = textOn(colors[c]);
    ctx.strokeRect(x, y, s, s);
    ctx.lineWidth = w;
    ctx.strokeStyle = colors[c];
    ctx.strokeRect(x, y, s, s);
  }
}

/** Picks which blocks of `color` a preview lights, leaving out those an ant is already heading for. */
export type PreviewPick = (vis: Int16Array, W: number, H: number, color: number, marks: Map<number, number>) => number[];

function colorCells(vis: Int16Array, color: number, marks: Map<number, number>, only?: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 0; i < vis.length; i++) if ((!only || only[i]) && vis[i] === color && !marks.has(i)) out.push(i);
  return out;
}

/** Blocks of `color` that look eatable on screen right now. */
export const reachable: PreviewPick = (vis, W, H, color, marks) => colorCells(vis, color, marks, exposedMask(vis, W, H));

/** Every block of `color` still on screen, reachable or buried. */
export const remaining: PreviewPick = (vis, _W, _H, color, marks) => colorCells(vis, color, marks);

/** The reach preview: the board dimmed, with each reachable block re-lit and ringed. */
export function drawPreview(ctx: CanvasRenderingContext2D, g: Geom, cells: number[], hex: string): void {
  ctx.fillStyle = 'rgba(12,8,6,.62)';
  ctx.fillRect(g.ox, g.oy, g.bpx, g.H * g.cs);
  const cs = g.cs, w = Math.max(1.5, cs * 0.14);
  ctx.fillStyle = hex;
  ctx.lineWidth = w;
  ctx.strokeStyle = textOn(hex);
  for (const i of cells) {
    ctx.fillRect(cellX(g, i), cellY(g, i), cs, cs);
    ctx.strokeRect(cellX(g, i) + w / 2, cellY(g, i) + w / 2, cs - w, cs - w);
  }
}
