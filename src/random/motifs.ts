// The six centerpieces of a random scene. Each paints into the Ctx using color indexes
// (0 dark, 1 light, 2-7 accents); `acc` is a shuffled copy of the accent indexes.
import { mulberry } from '../core/rng';
import { background, type Ctx, disc, DK, frame, LT } from './backgrounds';

type Motif = (x: Ctx, acc: number[], size: number) => void;
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const mandala: Motif = (x, acc) => {
  const { W, H, R, ri, pick, each, g, outline } = x;
  background(x, LT, acc[0], acc[1]);
  const R0 = W / 2 - ri(1, 2), k = pick([6, 8, 10, 12]), rings = ri(3, 5), rw = R0 / rings, cl = acc.slice(1);
  const st: { s: string; c1: number; c2: number }[] = [];
  for (let i = 0; i < rings; i++) {
    const c1 = pick(cl);
    let c2 = pick([LT, ...cl]);
    if (c2 === c1) c2 = LT;
    st.push({ s: pick(['solid', 'sector', 'petal', 'dots', 'petal']), c1, c2 });
  }
  const ringOf = (px: number, py: number): number => {
    const r = Math.hypot(px + 0.5 - W / 2, py + 0.5 - H / 2);
    return r > R0 ? -1 : Math.min(rings - 1, Math.floor(r / rw));
  };
  each((px, py) => {
    const dx = px + 0.5 - W / 2, dy = py + 0.5 - H / 2, r = Math.hypot(dx, dy);
    if (r > R0) return null;
    const i = Math.min(rings - 1, Math.floor(r / rw)), f = r / rw - i, s = st[i];
    const sec = ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * k, ph = sec - Math.floor(sec);
    if (s.s === 'solid') return s.c1;
    if (s.s === 'sector') return Math.floor(sec) & 1 ? s.c1 : s.c2;
    if (s.s === 'petal') return Math.abs(ph - 0.5) * 2 < 1 - f * 0.9 ? s.c1 : s.c2;
    return Math.abs(ph - 0.5) < 0.22 && Math.abs(f - 0.5) < 0.32 ? s.c1 : s.c2;
  });
  const lines: number[] = [];
  for (let i = 1; i < rings; i++) if (R() < 0.65) lines.push(i);
  const m: number[] = [];
  each((px, py) => {
    const i = ringOf(px, py);
    if (i < 1 || !lines.includes(i)) return;
    for (const [dx, dy] of N4) if (ringOf(px + dx, py + dy) === i - 1) { m.push(py * W + px); break; }
  });
  m.forEach((i) => { g[i] = DK; });
  outline(disc(W / 2, H / 2, R0), DK);
  if (R() < 0.6) frame(x, 1);
};

const glass: Motif = (x, acc) => {
  const { W, ri, pick, each, g, outline } = x;
  const H = x.H;
  background(x, acc[0], LT, acc[1]);
  const x0 = 3, x1 = W - 4, y1 = H - 3, rad = (x1 - x0 + 1) / 2, cxw = (x0 + x1 + 1) / 2, yTop = 3 + rad;
  const inWin = (px: number, py: number): boolean =>
    px >= x0 && px <= x1 && py >= 2 && py <= y1 && (py >= yTop || Math.hypot(px + 0.5 - cxw, py + 0.5 - yTop) <= rad);
  const near = (px: number, py: number): boolean =>
    !inWin(px, py) && [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => inWin(px + a, py + b));
  each((px, py) => (near(px, py) ? acc[2] : null));
  const n = ri(Math.round(W * 0.75), Math.round(W * 1.05)), seeds: [number, number, number][] = [], cl = acc.slice(3).concat([LT, acc[2]]);
  for (let t = 0; seeds.length < n && t < 999; t++) {
    const px = ri(x0, x1), py = ri(2, y1);
    if (inWin(px, py)) seeds.push([px + 0.5, py + 0.5, pick(cl)]);
  }
  const own = new Int16Array(W * H).fill(-1);
  each((px, py) => {
    if (!inWin(px, py)) return null;
    let b = 0, bd = 1e9;
    seeds.forEach((s, k) => { const d = (s[0] - px - 0.5) ** 2 + (s[1] - py - 0.5) ** 2; if (d < bd) { bd = d; b = k; } });
    own[py * W + px] = b;
    return seeds[b][2];
  });
  const m: number[] = [];
  each((px, py) => {
    if (!inWin(px, py)) return;
    const o = own[py * W + px];
    if ((inWin(px + 1, py) && own[py * W + px + 1] !== o) || (inWin(px, py + 1) && own[(py + 1) * W + px] !== o)) m.push(py * W + px);
  });
  m.forEach((i) => { g[i] = DK; });
  outline(inWin, DK);
};

const quilt: Motif = (x, acc) => {
  const { W, pick, R, each, seed } = x;
  const B = pick([4, 5, 6]), step = B + 1, layout = pick(['pinwheel', 'zigzag', 'diamond', 'random']);
  const pairs = [[acc[0], acc[1]], [acc[2], acc[3]], [acc[4], LT]], usePairs = R() < 0.5 ? 2 : 3;
  const sash = LT, stone = pick([DK, acc[5]]);
  const off = Math.floor((W - 1 - Math.floor((W - 1) / step) * step) / 2), nb = Math.floor(W / step);
  each((px, py) => {
    const X = px - off, Y = py - off;
    if (X < 0 || Y < 0 || X % step === 0 || Y % step === 0) return X >= 0 && Y >= 0 && X % step === 0 && Y % step === 0 ? stone : sash;
    const bi = Math.floor(X / step), bj = Math.floor(Y / step), u = (X % step) - 1, v = (Y % step) - 1;
    if (u >= B || v >= B) return sash;
    let o: number;
    if (layout === 'pinwheel') o = ((bi & 1) << 1) | (bj & 1);
    else if (layout === 'zigzag') o = (bi + bj) & 1;
    else if (layout === 'diamond') o = (bi < nb / 2 ? 0 : 1) + (bj < nb / 2 ? 0 : 2);
    else o = Math.floor(mulberry(seed + bi * 31 + bj * 7)() * 4);
    const pr = pairs[(bi + bj) % usePairs];
    if (u === v && (o === 0 || o === 2)) return DK;
    if (u + v === B - 1 && (o === 1 || o === 3)) return DK;
    const side = o === 0 ? u > v : o === 1 ? u + v < B - 1 : o === 2 ? u < v : u + v > B - 1;
    return side ? pr[0] : pr[1];
  });
};

/** A random left half (mirrored), smoothed by cellular automata until it is blobby enough. */
function critterMask(x: Ctx, S: number, hw: number): boolean[][] {
  let m: boolean[][] = [];
  for (let tries = 0; tries < 20; tries++) {
    m = [];
    for (let y = 0; y < S; y++) {
      m.push([]);
      for (let px = 0; px < hw; px++) {
        const cx = (px + 1) / hw, cy = 1 - Math.abs(y + 0.5 - S / 2) / (S / 2);
        m[y].push(x.R() < 0.15 + 0.8 * Math.sqrt(cx) * cy);
      }
    }
    for (let it = 0; it < 3; it++) {
      const n = m.map((r) => r.slice());
      for (let y = 0; y < S; y++) {
        for (let px = 0; px < hw; px++) {
          let c = 0;
          for (let a = -1; a <= 1; a++) {
            for (let b = -1; b <= 1; b++) {
              if (!a && !b) continue;
              const yy = y + a, xx = px + b >= hw ? 2 * hw - 1 - (px + b) : px + b;
              if (yy >= 0 && yy < S && xx >= 0 && m[yy][xx]) c++;
            }
          }
          n[y][px] = c >= 5 || (m[y][px] && c >= 4);
        }
      }
      m = n;
    }
    let cnt = 0;
    m.forEach((r) => r.forEach((v) => { cnt += v ? 1 : 0; }));
    if (cnt > S * hw * 0.35 && cnt < S * hw * 0.8) break;
  }
  return m;
}

const critter: Motif = (x, acc, size) => {
  const { W, H, g, each, set, outline } = x;
  const S = Math.min(W - 6, Math.round(size * 0.6)), hw = Math.ceil(S / 2), ox = Math.floor((W - S) / 2), oy = Math.floor((H - S) / 2);
  background(x, LT, acc[0], acc[1]);
  const m = critterMask(x, S, hw);
  const body = (px: number, py: number): boolean => {
    const X = px - ox, Y = py - oy;
    if (X < 0 || Y < 0 || X >= S || Y >= S) return false;
    const hx = X < hw ? X : S - 1 - X;
    return hx >= 0 && hx < hw && m[Y][hx];
  };
  each((px, py) => (body(px, py) ? (py - oy > S * 0.62 ? acc[3] : acc[2]) : null));
  each((px, py) => {
    if (body(px, py) && body(px + 1, py) && body(px - 1, py) && body(px, py + 1) && body(px, py - 1) && py - oy <= S * 0.62 && ((px - ox) * 7 + (py - oy) * 3) % 9 === 0) return acc[4];
  });
  outline(body, DK);
  const okp = (xx: number, yy: number): boolean =>
    [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => body(xx + a, yy + b) && g[(yy + b) * W + xx + a] !== DK);
  eyes: for (let y = oy + Math.floor(S * 0.25); y < oy + S * 0.55; y++) {
    for (let px = ox + 1; px < ox + hw - 1; px++) {
      const mx = ox + S - 1 - px - 1;
      if (okp(px, y) && okp(mx, y) && mx - px > 2) {
        for (const ex of [px, mx]) { set(ex, y, LT); set(ex + 1, y, LT); set(ex, y + 1, LT); set(ex + 1, y + 1, DK); }
        break eyes;
      }
    }
  }
  frame(x, x.ri(1, 2));
};

const landscape: Motif = (x, acc) => {
  const { W, H, ri, R, each, set } = x;
  const b1 = Math.round(H * 0.18), b2 = Math.round(H * 0.34);
  each((px, py) => (py < b1 || (py === b1 && px & 1) ? acc[0] : (py < b2 || (py === b2 && px & 1) ? acc[1] : acc[2])));
  const sx = ri(4, W - 5), sy = Math.round((H * ri(25, 40)) / 100), sr = ri(2, 4), sun = disc(sx, sy, sr);
  each((px, py) => (sun(px, py) ? LT : null));
  const wl = Math.round(H * 0.78);
  [acc[3], acc[4], acc[5]].forEach((c, i) => {
    const base = H * (0.42 + i * 0.1), amp = H * (0.12 - i * 0.025), f1 = R() * 0.4 + 0.2, f2 = R() * 0.9 + 0.5, p1 = R() * 7, p2 = R() * 7;
    const top = (px: number): number => Math.round(base - amp * (0.65 * Math.sin(px * f1 + p1) + 0.35 * Math.sin(px * f2 + p2)));
    each((px, py) => (py >= top(px) && py < wl ? c : null));
    if (i === 0) each((px, py) => (py >= top(px) && py <= top(px) + 1 && top(px) < H * 0.4 ? LT : null));
    for (let px = 0; px < W; px++) set(px, top(px), DK);
  });
  each((px, py) => {
    if (py < wl) return null;
    if (py === wl) return DK;
    return py % 2 === 0 && (px * 3 + py * 5) % 9 < 2 ? LT : (Math.abs(px - sx) <= 1 && py % 2 === 1 ? LT : acc[1]);
  });
};

const planet: Motif = (x, acc) => {
  const { W, H, ri, R, each, outline, seed } = x;
  each((px, py) => {
    const h = (Math.imul(px + 1, 73856093) ^ Math.imul(py + 1, 19349663) ^ seed) >>> 0;
    return h % 23 === 0 ? LT : (h % 61 === 0 ? acc[5] : DK);
  });
  const pr = (W * ri(26, 32)) / 100, pcx = W * (0.5 + (R() - 0.5) * 0.1), pcy = H * (0.5 + (R() - 0.5) * 0.1);
  const bw = ri(2, 3), amp = R() * 1.5 + 0.5, fr = R() * 0.5 + 0.3, bands = [acc[0], acc[1], acc[2]], inP = disc(pcx, pcy, pr);
  each((px, py) => (inP(px, py) ? bands[(Math.floor((py + amp * Math.sin(px * fr)) / bw) % 3 + 3) % 3] : null));
  each((px, py) => (inP(px, py) && px + 0.5 - pcx + (py + 0.5 - pcy) > pr * 0.85 ? acc[3] : null));
  outline(inP, DK);
  const rx = pr * 1.75, ry = pr * 0.42, tilt = (R() - 0.5) * 0.5;
  each((px, py) => {
    const dx = px + 0.5 - pcx, dy = py + 0.5 - pcy - dx * tilt, q = (dx / rx) ** 2 + (dy / ry) ** 2;
    if (q > 1 || q < 0.5) return null;
    if (inP(px, py) && dy < 0) return null;
    return q > 0.78 ? acc[4] : LT;
  });
  const mx = pcx < W / 2 ? W - 5 : 4, my = ri(3, 6), inM = disc(mx, my, 2.6);
  each((px, py) => (inM(px, py) ? acc[5] : null));
  outline(inM, DK);
};

export const MOTIFS: Record<string, Motif> = { mandala, glass, quilt, critter, landscape, planet };
