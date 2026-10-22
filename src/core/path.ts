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

/**
 * Walking distance from the nest to every open cell. The nest is the whole bottom track, so every
 * cell of that row starts at 0 and a block's distance is how far it is from the bottom.
 */
export function nestField(grid: Int8Array | Int16Array, W: number, H: number): Int16Array {
  const { EW, EH, map, q } = geo(W, H);
  const d = new Int16Array(EW * EH).fill(-1);
  let qh = 0, qt = 0;
  for (let c = -1; c <= W; c++) {
    const s = extIdx(H, c, W);
    q[qt++] = s;
    d[s] = 0;
  }
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

/**
 * Whether block a (at distance da) is picked before block b (at db): nearer the nest first, then
 * nearer the centre column, then lower on the board, then further left.
 */
export function closer(a: number, b: number, da: number, db: number, W: number): boolean {
  if (da !== db) return da < db;
  const ra = (a / W) | 0, rb = (b / W) | 0, ca = a - ra * W, cb = b - rb * W;
  const oa = Math.abs(2 * ca - (W - 1)), ob = Math.abs(2 * cb - (W - 1));
  if (oa !== ob) return oa < ob;
  if (ra !== rb) return ra > rb;
  return ca < cb;
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

/** Nearest reachable block of a color, by walking distance from the nest, ties broken by `closer`. */
export function pickNear(grid: Int8Array, W: number, H: number, color: number, d: Int16Array): number {
  let best = -1, bd = -1;
  for (let i = 0; i < W * H; i++) {
    if (grid[i] !== color) continue;
    const v = minAround(d, i, W);
    if (v >= 0 && (best < 0 || closer(i, best, v, bd, W))) { bd = v; best = i; }
  }
  return best;
}

/** Ext cells from the nest (a bottom-track cell) to the cell beside the target, in walking order. */
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

export function exposedMask(grid: Int8Array | Int16Array, W: number, H: number): Uint8Array {
  const d = nestField(grid, W, H);
  const exp = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (grid[i] >= 0 && minAround(d, i, W) >= 0) exp[i] = 1;
  return exp;
}

export function holeCol(si: number, n: number, W: number): number {
  return Math.min(W - 1, Math.floor(((si + 0.5) / n) * W));
}
