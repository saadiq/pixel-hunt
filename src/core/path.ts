// The board is surrounded by a one-cell track (rows -1 and H, cols -1 and W).
// Ants leave the nest (bottom track), run the track, and tunnel through eaten
// cells. A block is reachable if it touches the track or a tunnel.

interface Geo { EW: number; EH: number; map: Int32Array; q: Int32Array }

const geoCache: Record<string, Geo> = {};

function extIdx(r: number, c: number, W: number): number {
  return (r + 1) * (W + 2) + (c + 1);
}

function geo(W: number, H: number): Geo {
  const k = W + 'x' + H;
  if (geoCache[k]) return geoCache[k];
  const EW = W + 2, EH = H + 2;
  const map = new Int32Array(EW * EH).fill(-1);
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) map[(r + 1) * EW + c + 1] = r * W + c;
  return (geoCache[k] = { EW, EH, map, q: new Int32Array(EW * EH) });
}

/** Walking distance from a nest hole (bottom track, column hc) to every open cell. */
export function distField(grid: Int8Array, W: number, H: number, hc: number): Int16Array {
  const { EW, EH, map, q } = geo(W, H);
  const d = new Int16Array(EW * EH).fill(-1);
  const start = extIdx(H, hc, W);
  let qh = 0, qt = 0;
  q[qt++] = start;
  d[start] = 0;
  // Neighbour checks unrolled, no per-node allocation: this is the hot loop of every deal.
  const visit = (n: number, nd: number) => {
    if (d[n] >= 0) return;
    const m = map[n];
    if (m < 0 || grid[m] < 0) { d[n] = nd; q[qt++] = n; }
  };
  while (qh < qt) {
    const e = q[qh++];
    const er = (e / EW) | 0, ec = e - er * EW, nd = d[e] + 1;
    if (er > 0) visit(e - EW, nd);
    if (er < EH - 1) visit(e + EW, nd);
    if (ec > 0) visit(e - 1, nd);
    if (ec < EW - 1) visit(e + 1, nd);
  }
  return d;
}

export function minAround(d: Int16Array, i: number, W: number): number {
  const EW = W + 2, e = (((i / W) | 0) + 1) * EW + (i % W) + 1;
  let b = -1;
  // Unrolled over the four neighbours: no per-call array allocation (hot in every deal).
  const n = d[e - EW]; if (n >= 0) b = n;
  const s = d[e + EW]; if (s >= 0 && (b < 0 || s < b)) b = s;
  const w = d[e - 1]; if (w >= 0 && (b < 0 || w < b)) b = w;
  const o = d[e + 1]; if (o >= 0 && (b < 0 || o < b)) b = o;
  return b;
}

/** Nearest reachable block of a color, by walking distance from the hole. */
export function pickNear(grid: Int8Array, W: number, H: number, color: number, d: Int16Array): number {
  let best = -1, bd = 1e9;
  for (let i = 0; i < W * H; i++) {
    if (grid[i] !== color) continue;
    const v = minAround(d, i, W);
    if (v >= 0 && v < bd) { bd = v; best = i; }
  }
  return best;
}

/** Ext cells from the hole to the cell beside the target, in walking order. */
export function tracePath(d: Int16Array, i: number, W: number, _H: number): number[] {
  const EW = W + 2, e0 = (((i / W) | 0) + 1) * EW + (i % W) + 1;
  let cur = -1, cd = 1e9;
  for (const n of [e0 - EW, e0 + EW, e0 - 1, e0 + 1]) {
    const v = d[n];
    if (v >= 0 && v < cd) { cd = v; cur = n; }
  }
  const path = [cur];
  while (d[cur] > 0) {
    for (const n of [cur - EW, cur + EW, cur - 1, cur + 1]) {
      if (n < 0 || n >= d.length) continue;
      if (Math.abs((n % EW) - (cur % EW)) > 1) continue;
      if (d[n] === d[cur] - 1) { cur = n; break; }
    }
    path.push(cur);
  }
  return path.reverse();
}

export function exposedMask(grid: Int8Array, W: number, H: number): Uint8Array {
  const d = distField(grid, W, H, 0);
  const exp = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (grid[i] >= 0 && minAround(d, i, W) >= 0) exp[i] = 1;
  return exp;
}

export function holeCol(si: number, n: number, W: number): number {
  return Math.min(W - 1, Math.floor(((si + 0.5) / n) * W));
}
