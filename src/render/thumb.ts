import { parseArt } from '../core/board';
import type { Art } from '../core/types';

/** Draws the art scaled so its width is px (prototype drawThumb). Height follows the aspect ratio. */
export function drawThumb(c: HTMLCanvasElement, art: Art, px: number): void {
  const b = parseArt(art);
  const s = px / b.W;
  c.width = px;
  c.height = Math.round(b.H * s);
  const x = c.getContext('2d');
  if (!x) return;
  for (let i = 0; i < b.W * b.H; i++) {
    if (b.grid[i] < 0) continue;
    x.fillStyle = b.colors[b.grid[i]];
    x.fillRect((i % b.W) * s, Math.floor(i / b.W) * s, Math.ceil(s), Math.ceil(s));
  }
}
