// Drawing context for random scenes plus the patterned backgrounds and frame.
import { mulberry } from '../core/rng';

export const DK = 0;
export const LT = 1;
export const ACCENTS = [2, 3, 4, 5, 6, 7];

export interface Ctx {
  W: number; H: number; g: Int8Array; seed: number;
  R: () => number;
  ri(a: number, b: number): number;
  pick<T>(a: T[]): T;
  shuffle<T>(a: T[]): T[];
  inb(x: number, y: number): boolean;
  set(x: number, y: number, c: number): void;
  /** Visits every cell; a non-null return value repaints it. */
  each(fn: (x: number, y: number, c: number) => number | null | undefined): void;
  outline(ins: (x: number, y: number) => boolean, c: number): void;
}

export const disc = (cx: number, cy: number, r: number) => (x: number, y: number): boolean =>
  Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;

export function makeCtx(seed: number, size: number): Ctx {
  const R = mulberry((Math.imul(seed, 2654435761) ^ 0x9e3779b9) >>> 0);
  const W = size, H = size, g = new Int8Array(W * H);
  const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
  const each: Ctx['each'] = (fn) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y, g[y * W + x]); if (c != null) g[y * W + x] = c; }
  };
  return {
    W, H, g, seed, R, inb, each,
    ri: (a, b) => a + Math.floor(R() * (b - a + 1)),
    pick: (a) => a[Math.floor(R() * a.length)],
    shuffle: (a) => {
      a = a.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    set: (x, y, c) => { if (inb(x, y)) g[y * W + x] = c; },
    outline: (ins, c) => {
      const m: number[] = [];
      each((x, y) => { if (ins(x, y) && (!ins(x + 1, y) || !ins(x - 1, y) || !ins(x, y + 1) || !ins(x, y - 1))) m.push(y * W + x); });
      m.forEach((i) => { g[i] = c; });
    },
  };
}

type Fn = (x: number, y: number) => number;
const KINDS = ['gingham', 'checker', 'brick', 'stripes', 'dots', 'argyle', 'waves', 'herring'] as const;

function patternFn(k: (typeof KINDS)[number], x: Ctx, a: number, b: number, c: number): Fn {
  const { ri, pick, R, W } = x;
  switch (k) {
    case 'gingham': return (px, py) => { const u = (px >> 1) & 1, v = (py >> 1) & 1; return u && v ? c : (u ^ v ? b : a); };
    case 'checker': { const s = ri(1, 2); return (px, py) => ((Math.floor(px / s) + Math.floor(py / s)) & 1 ? b : a); }
    case 'brick': {
      const bw = ri(3, 5), bh = ri(1, 2);
      return (px, py) => {
        const row = Math.floor(py / (bh + 1));
        return py % (bh + 1) === bh || (px + (row & 1) * ((bw + 1) >> 1)) % (bw + 1) === bw ? b : a;
      };
    }
    case 'stripes': {
      const w = ri(1, 2), dir = pick(['h', 'v', 'd', 'a']), cs = R() < 0.5 ? [a, b] : [a, b, c];
      return (px, py) => {
        const t = dir === 'h' ? py : dir === 'v' ? px : dir === 'd' ? px + py : px - py + W * 3;
        return cs[Math.floor(t / w) % cs.length];
      };
    }
    case 'dots': {
      const p = ri(3, 4);
      return (px, py) => {
        const row = Math.floor(py / p);
        return (px + (row & 1) * (p >> 1)) % p === 1 && py % p === 1 ? b : ((px + py) % (2 * p) === 0 ? c : a);
      };
    }
    case 'argyle': {
      const p = ri(3, 4);
      return (px, py) => {
        const u = Math.abs((px % (2 * p)) - p + 0.5), v = Math.abs((py % (2 * p)) - p + 0.5);
        return u + v < p - 0.5 ? b : (u + v < p + 0.5 ? c : a);
      };
    }
    case 'waves': {
      const amp = ri(1, 2), per = ri(6, 9);
      return (px, py) => [a, b, c][(Math.floor((py + Math.round(amp * Math.sin((px * 2 * Math.PI) / per))) / 2) % 3 + 3) % 3];
    }
    default: return (px, py) => (((px >> 1) + py) & 3) < 2 ? a : b;
  }
}

/** Fills the board (or `region`) with a random repeating pattern in colors a, b, c. */
export function background(x: Ctx, a: number, b: number, c: number, region?: (x: number, y: number) => boolean): void {
  const f = patternFn(x.pick([...KINDS]), x, a, b, c);
  x.each((px, py) => (!region || region(px, py) ? f(px, py) : null));
}

export function frame(x: Ctx, w: number): void {
  const c1 = x.pick([DK, ...ACCENTS]), c2 = x.pick([LT, ...ACCENTS]);
  const { W, H } = x;
  x.each((px, py) => {
    const d = Math.min(px, py, W - 1 - px, H - 1 - py);
    return d < w ? ((px + py) & 1 && w > 1 && d === 0 ? c2 : c1) : null;
  });
}
