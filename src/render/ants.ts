// Ants: path building, motion, sprite, and crumbs. Ported from the prototype (spawnAnt, along, drawAnt, frame).

export interface Geom { W: number; H: number; cs: number; T: number; nest: number; ox: number; oy: number; bpx: number }

export interface Ant {
  i: number; color: number; pts: number[][]; cum: number[]; len: number;
  tx: number; ty: number; t0: number; go: number; chew: number; phase: number;
}

export interface Crumb { x: number; y: number; vx: number; vy: number; s: number; col: string; t0: number }

export interface Cells { colors: string[]; vis: Int16Array; chew: Float64Array }

export const holeY = (g: Geom): number => g.oy + g.H * g.cs + g.nest * 0.55;

/** Pixel centre of an extended-grid cell (the track ring around the board). */
function extCenter(g: Geom, e: number): [number, number] {
  const EW = g.W + 2, r = ((e / EW) | 0) - 1, c = (e % EW) - 1;
  return [
    c < 0 ? g.T / 2 : c >= g.W ? g.ox + g.bpx + g.T / 2 : g.ox + (c + 0.5) * g.cs,
    r < 0 ? g.T / 2 : r >= g.H ? holeY(g) : g.oy + (r + 0.5) * g.cs,
  ];
}

/** An ant for one bite: it rises from the nest directly below the bottom-track cell its route starts on. */
export function spawnAnt(g: Geom, cell: number, color: number, path: number[], now: number, reduce: boolean, fast: boolean): Ant {
  const r = (cell / g.W) | 0, c = cell % g.W;
  const jit = () => (Math.random() - 0.5) * g.cs * 0.3, jx = jit(), jy = jit();
  const pts: number[][] = [[extCenter(g, path[0])[0] + jx, holeY(g)]];
  for (const e of path) { const [x, y] = extCenter(g, e); pts.push([x + jx, y + jy]); }
  pts.push([g.ox + (c + 0.5) * g.cs, g.oy + (r + 0.5) * g.cs]);
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const len = cum[cum.length - 1], mul = fast ? 2 : 1;
  const v = (reduce ? 1e6 : Math.max(560, g.bpx * 2.6)) * mul;
  const end = pts[pts.length - 1];
  return { i: cell, color, pts, cum, len, tx: end[0], ty: end[1], t0: now, go: (len / v) * 1000, chew: 130 / mul, phase: 0 };
}

/** Position and heading at distance s along the ant's polyline. */
export function along(a: Ant, s: number): [number, number, number] {
  const P = a.pts, C = a.cum;
  let k = 1;
  while (k < C.length - 1 && C[k] < s) k++;
  const seg = C[k] - C[k - 1] || 1, f = Math.min(1, Math.max(0, (s - C[k - 1]) / seg));
  return [
    P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f,
    P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f,
    Math.atan2(P[k][1] - P[k - 1][1], P[k][0] - P[k - 1][0]),
  ];
}

/** One ant, its body in its squad's colour and outlined dark so it reads on any block. */
export function drawAnt(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, sz: number, body: string, carry: string | null, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const w = Math.sin(t / 40) * sz * 0.12;
  ctx.strokeStyle = '#1d130d';
  ctx.lineWidth = Math.max(1, sz * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = -1; k <= 1; k++) {
    const lx = k * sz * 0.16, ww = k % 2 ? w : -w;
    ctx.moveTo(lx, 0); ctx.lineTo(lx + ww - sz * 0.05, -sz * 0.34);
    ctx.moveTo(lx, 0); ctx.lineTo(lx - ww - sz * 0.05, sz * 0.34);
  }
  ctx.moveTo(sz * 0.3, 0); ctx.lineTo(sz * 0.48, -sz * 0.16);
  ctx.moveTo(sz * 0.3, 0); ctx.lineTo(sz * 0.48, sz * 0.16);
  ctx.stroke();
  ctx.fillStyle = body; // outlined with the legs' stroke, still set
  const parts: (() => void)[] = [
    () => ctx.ellipse(-sz * 0.3, 0, sz * 0.22, sz * 0.16, 0, 0, 7),
    () => ctx.ellipse(0, 0, sz * 0.13, sz * 0.1, 0, 0, 7),
    () => ctx.arc(sz * 0.24, 0, sz * 0.12, 0, 7),
  ];
  for (const f of parts) { ctx.beginPath(); f(); ctx.stroke(); ctx.fill(); }
  if (carry) {
    const q = sz * 0.24;
    ctx.fillStyle = carry;
    ctx.fillRect(sz * 0.38, -q / 2, q, q);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sz * 0.38, -q / 2, q, q);
  }
  ctx.restore();
}

export function drawCrumbs(ctx: CanvasRenderingContext2D, crumbs: Crumb[], now: number): Crumb[] {
  return crumbs.filter((c) => {
    const t = (now - c.t0) / 1000;
    if (t > 0.45) return false;
    ctx.globalAlpha = 1 - t / 0.45;
    ctx.fillStyle = c.col;
    ctx.fillRect(c.x + c.vx * t, c.y + c.vy * t + 260 * t * t, c.s, c.s);
    ctx.globalAlpha = 1;
    return true;
  });
}

/** Whether an ant is drawn at time t. Under reduced motion only while it sits on its target, never on the way there or back. */
const shown = (a: Ant, t: number, reduce: boolean): boolean => a.go > 0 && (!reduce || (t >= a.go && t < a.go + a.chew));

/** Advances and draws every ant; returns those still in flight. Clears `vis` cells when chewing finishes. */
export function stepAnts(
  ctx: CanvasRenderingContext2D, ants: Ant[], now: number, g: Geom, cells: Cells,
  crumbs: Crumb[], reduce: boolean, onChew: (() => void) | undefined,
): Ant[] {
  const sz = Math.max(9, g.cs * 0.95), wiggle = reduce ? 0 : g.cs * 0.06, legT = reduce ? 0 : now;
  return ants.filter((a) => {
    const t = now - a.t0, go = a.go, ch = a.chew;
    let x = 0, y = 0, ang = 0, carry: string | null = null;
    if (t < go) {
      [x, y, ang] = along(a, (a.len * t) / go);
    } else if (t < go + ch) {
      if (a.phase === 0) { a.phase = 1; cells.chew[a.i] = now; onChew?.(); }
      [x, y, ang] = along(a, a.len);
      x += Math.sin(t / 25) * wiggle;
    } else if (t < go * 2 + ch) {
      if (a.phase < 2) {
        if (a.phase === 0) onChew?.();
        a.phase = 2; cells.vis[a.i] = -1; cells.chew[a.i] = 0;
        if (!reduce) for (let k = 0; k < 3; k++) crumbs.push({ x: a.tx, y: a.ty, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 80, s: Math.max(2, g.cs * 0.18), col: cells.colors[a.color], t0: now });
      }
      [x, y, ang] = along(a, a.len * (1 - (t - go - ch) / go));
      ang += Math.PI;
      carry = cells.colors[a.color];
    } else {
      if (a.phase < 2) { cells.vis[a.i] = -1; cells.chew[a.i] = 0; }
      return false;
    }
    if (shown(a, t, reduce)) drawAnt(ctx, x, y, ang, sz, cells.colors[a.color], carry, legT);
    return true;
  });
}
