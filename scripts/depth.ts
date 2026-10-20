// Enclosure depth: how many colour layers wall each cell in. Browser-safe: no node imports.
import type { Art } from '../src/core/types';

export interface Depth { max: number; avg: number; deep3: number }

/** Double-ended queue of cell indices on a fixed ring buffer. */
class Deque {
  private q: Int32Array;
  private head = 0;
  private tail = 0;
  constructor(cap: number) { this.q = new Int32Array(cap); }
  get empty(): boolean { return this.head === this.tail; }
  front(i: number): void { this.head = (this.head - 1 + this.q.length) % this.q.length; this.q[this.head] = i; }
  back(i: number): void { this.q[this.tail] = i; this.tail = (this.tail + 1) % this.q.length; }
  pop(): number { const i = this.q[this.head]; this.head = (this.head + 1) % this.q.length; return i; }
}

/** In-board 4-neighbours of cell i. */
function neighbours(i: number, W: number, N: number): number[] {
  const x = i % W, out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (i >= W) out.push(i - W);
  if (i + W < N) out.push(i + W);
  return out;
}

/** Per-cell depth by 0-1 BFS from every edge cell (each at cost 0). */
function depthGrid(g: string, W: number, H: number): Int32Array {
  const N = W * H;
  const done = new Uint8Array(N), dist = new Int32Array(N).fill(0x7fffffff);
  const dq = new Deque(N * 5 + 1); // each cell is seeded once and relaxed by at most 4 neighbours
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { dist[i] = 0; dq.back(i); }
  }
  while (!dq.empty) {
    const i = dq.pop();
    if (done[i]) continue;
    done[i] = 1;
    for (const j of neighbours(i, W, N)) {
      if (done[j]) continue;
      const step = g[j] === g[i] ? 0 : 1;
      if (dist[i] + step >= dist[j]) continue;
      dist[j] = dist[i] + step;
      if (step) dq.back(j); else dq.front(j);
    }
  }
  return dist;
}

/**
 * Each cell's depth is the fewest colour changes along a 4-connected path from outside the board.
 * Entering an edge cell from outside costs 0; stepping into a cell whose colour differs from the
 * previous cell costs 1. `deep3` is the fraction of cells at depth >= 3.
 */
export function enclosureDepth(art: Art): Depth {
  const H = art.rows.length, W = H ? art.rows[0].length : 0, N = W * H;
  if (!N) return { max: 0, avg: 0, deep3: 0 };
  const d = depthGrid(art.rows.join(''), W, H);
  let max = 0, sum = 0, deep = 0;
  for (const v of d) {
    max = Math.max(max, v);
    sum += v;
    if (v >= 3) deep++;
  }
  return { max, avg: sum / N, deep3: deep / N };
}
