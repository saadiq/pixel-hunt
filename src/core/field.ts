// Incremental search state for stepSlots. Every hole sits on the open track ring, so all holes
// reach the same cells; `exposed` lists, per colour, the blocks touching that region. Distance
// fields are kept per hole and repaired in place when a block is eaten (distances only shrink),
// instead of re-walking the whole board for every bite. The cache is checked against the live
// grid before each use, so any outside change to the grid just causes a rebuild.
import { distField, minAround } from './path';

export interface Field {
  W: number; H: number;
  ref: Int8Array;                  // our belief of the grid
  fields: Map<number, Int16Array>; // hole column -> distances over the ext grid (-1 = unreached)
  exposed: number[][];             // colour -> block cells touching the reachable region
  pos: Int32Array;                 // cell -> index in its exposed list, or -1
  q: Int32Array;
}

const cache = new WeakMap<Int8Array, Field>();

function same(a: Int8Array, b: Int8Array): boolean {
  const n = a.length;
  if (n % 4 === 0 && a.byteOffset % 4 === 0 && b.byteOffset % 4 === 0) {
    const x = new Int32Array(a.buffer, a.byteOffset, n >> 2), y = new Int32Array(b.buffer, b.byteOffset, n >> 2);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

const extOf = (i: number, W: number) => (((i / W) | 0) + 1) * (W + 2) + (i % W) + 1;

/** Board cell of ext cell e, or -1 on the track. */
function cellAt(f: Field, e: number): number {
  const EW = f.W + 2, r = (e / EW) | 0, c = e - r * EW;
  return r < 1 || r > f.H || c < 1 || c > f.W ? -1 : (r - 1) * f.W + c - 1;
}

function addExposed(f: Field, i: number): void {
  if (i < 0 || f.pos[i] >= 0 || f.ref[i] < 0) return;
  const l = (f.exposed[f.ref[i]] ??= []);
  f.pos[i] = l.length;
  l.push(i);
}

function removeExposed(f: Field, i: number): void {
  const p = f.pos[i];
  if (p < 0) return;
  const l = f.exposed[f.ref[i]], last = l.pop() as number;
  if (last !== i) { l[p] = last; f.pos[last] = p; }
  f.pos[i] = -1;
}

function build(g: Int8Array, W: number, H: number): Field {
  const f: Field = {
    W, H, ref: g.slice(), fields: new Map(), exposed: [], pos: new Int32Array(g.length).fill(-1),
    q: new Int32Array((W + 2) * (H + 2)),
  };
  const base = distField(g, W, H, 0), EW = W + 2;
  f.fields.set(0, base);
  for (let i = 0; i < g.length; i++) {
    if (g[i] < 0) continue;
    const e = extOf(i, W);
    if (base[e - EW] >= 0 || base[e + EW] >= 0 || base[e - 1] >= 0 || base[e + 1] >= 0) addExposed(f, i);
  }
  return f;
}

/** Ext cell e just became reachable from the track: the blocks beside it are now exposed. */
function reached(f: Field, e: number): void {
  const EW = f.W + 2;
  addExposed(f, cellAt(f, e - EW));
  addExposed(f, cellAt(f, e + EW));
  addExposed(f, cellAt(f, e - 1));
  addExposed(f, cellAt(f, e + 1));
}

/** Block cell i was just eaten (f.ref already updated): repair one field. `base` also tracks exposure. */
function repair(f: Field, d: Int16Array, i: number, base: boolean): void {
  const { W, H, q, ref } = f, EW = W + 2, EH = H + 2, x = extOf(i, W);
  let m = -1;
  for (let k = 0; k < 4; k++) {
    const v = d[k === 0 ? x - EW : k === 1 ? x + EW : k === 2 ? x - 1 : x + 1];
    if (v >= 0 && (m < 0 || v < m)) m = v;
  }
  if (m < 0) return;
  d[x] = m + 1;
  let qh = 0, qt = 0;
  q[qt++] = x;
  if (base) reached(f, x);
  const relax = (n: number, nd: number) => {
    const c = cellAt(f, n);
    if (c >= 0 && ref[c] >= 0) return;
    if (d[n] >= 0 && d[n] <= nd) return;
    const fresh = d[n] < 0;
    d[n] = nd;
    q[qt++] = n;
    if (base && fresh) reached(f, n);
  };
  while (qh < qt) {
    const e = q[qh++], er = (e / EW) | 0, ec = e - er * EW, nd = d[e] + 1;
    if (er > 0) relax(e - EW, nd);
    if (er < EH - 1) relax(e + EW, nd);
    if (ec > 0) relax(e - 1, nd);
    if (ec < EW - 1) relax(e + 1, nd);
  }
}

/** The grid's search state, rebuilt if the grid changed behind our back. */
export function fieldOf(g: Int8Array, W: number, H: number): Field {
  let f = cache.get(g);
  if (!f || f.W !== W || f.H !== H || !same(f.ref, g)) cache.set(g, (f = build(g, W, H)));
  return f;
}

/**
 * Nearest exposed block of a colour for a hole: lowest walking distance, then lowest cell index
 * (the same pick as pickNear over a full field). `i` is -1 if none; `d` is the live field.
 */
export function nearest(f: Field, g: Int8Array, hc: number, color: number): { i: number; d: Int16Array } {
  let d = f.fields.get(hc);
  if (!d) f.fields.set(hc, (d = distField(g, f.W, f.H, hc)));
  let best = -1, bd = 1e9;
  const l = f.exposed[color] ?? [];
  for (let k = 0; k < l.length; k++) {
    const i = l[k], v = minAround(d, i, f.W);
    if (v >= 0 && (v < bd || (v === bd && i < best))) { bd = v; best = i; }
  }
  return { i: best, d };
}

/** Exposed block count per colour (blocks touching the track region), read from the live cache. */
export function exposedCounts(g: Int8Array, W: number, H: number, nColors: number): number[] {
  const f = fieldOf(g, W, H);
  return Array.from({ length: nColors }, (_, c) => f.exposed[c]?.length ?? 0);
}

/** Eat cell i: clears it in the grid and repairs every cached field. */
export function eat(f: Field, g: Int8Array, i: number): void {
  removeExposed(f, i);
  f.ref[i] = -1;
  g[i] = -1;
  for (const [hc, d] of f.fields) repair(f, d, i, hc === 0);
}
