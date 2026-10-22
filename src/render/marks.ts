// Feedback drawn over the board: rings on the blocks ants are heading for, and the reach preview.
import { textOn } from '../ui/dom';
import type { Ant, Geom } from './ants';

const cellX = (g: Geom, i: number) => g.ox + (i % g.W) * g.cs;
const cellY = (g: Geom, i: number) => g.oy + ((i / g.W) | 0) * g.cs;

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
