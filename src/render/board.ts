import { holeCol, tracePath } from '../core/path';
import { mulberry } from '../core/rng';
import type { BiteFn } from '../core/types';
import type { Game } from '../state/game';
import { type Ant, type Cells, type Crumb, type Geom, drawCrumbs, holeX, holeY, spawnAnt, stepAnts } from './ants';
import { drawCube } from './cube';
import { fitBoard } from './fit';

export interface Renderer {
  reset(g: Game): void;
  resize(stageW: number, stageH: number): void;
  bite: BiteFn;
  frame(now: number, g: Game, fast: boolean): void;
  busy(): boolean;
  onChew?: () => void;
}

function dirtPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  const p = document.createElement('canvas');
  p.width = p.height = 64;
  const c = p.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#5e4230';
  c.fillRect(0, 0, 64, 64);
  const r = mulberry(7);
  for (let k = 0; k < 60; k++) {
    c.fillStyle = r() < 0.5 ? '#4a3324' : '#7a5a40';
    c.fillRect((r() * 64) | 0, (r() * 64) | 0, 2, 2);
  }
  return ctx.createPattern(p, 'repeat');
}

function drawNest(ctx: CanvasRenderingContext2D, geo: Geom, CW: number, CH: number, pat: CanvasPattern | null, g: Game): void {
  const { T, cs, nest, ox, oy, bpx } = geo;
  ctx.fillStyle = pat ?? '#5e4230';
  ctx.fillRect(0, 0, CW, CH);
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.fillRect(0, 0, CW, T); ctx.fillRect(0, 0, T, oy + geo.H * cs); ctx.fillRect(ox + bpx, 0, T, oy + geo.H * cs);
  ctx.fillStyle = 'rgba(0,0,0,.32)';
  ctx.fillRect(ox, oy, bpx, geo.H * cs);
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 0.5, oy - 0.5, bpx + 1, geo.H * cs + 1);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.fillRect(0, oy + geo.H * cs, CW, nest);
  g.slots.forEach((sq, si) => {
    ctx.beginPath();
    ctx.ellipse(holeX(geo, holeCol(si, g.slots.length, geo.W)), holeY(geo), Math.max(3, cs * 0.55), nest * 0.24, 0, 0, 7);
    ctx.fillStyle = '#1c120c';
    ctx.fill();
    if (sq) { ctx.lineWidth = Math.max(2, nest * 0.1); ctx.strokeStyle = g.board.colors[sq.color]; ctx.stroke(); }
  });
}

function drawBlocks(ctx: CanvasRenderingContext2D, geo: Geom, cells: Cells, now: number, fast: boolean): void {
  const { W, H, cs, ox, oy } = geo, ms = Math.max(1, (fast ? 65 : 130));
  for (let i = 0; i < W * H; i++) {
    const col = cells.vis[i];
    if (col < 0) continue;
    const x = ox + (i % W) * cs, y = oy + ((i / W) | 0) * cs;
    if (cells.chew[i]) {
      const p = Math.min(1, (now - cells.chew[i]) / ms), s = cs * (1 - p * 0.85), o = (cs - s) / 2;
      drawCube(ctx, x + o, y + o, s, cells.colors[col]);
    } else drawCube(ctx, x, y, cs, cells.colors[col]);
  }
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let geo: Geom = { W: 1, H: 1, cs: 5, T: 3, nest: 14, ox: 3, oy: 3, bpx: 5 };
  let CW = 0, CH = 0, dpr = 1, nSlots = 1, fastNow = false, last: Game | null = null;
  let cells: Cells = { colors: [], vis: new Int16Array(0), chew: new Float64Array(0) };
  let ants: Ant[] = [], crumbs: Crumb[] = [], pat: CanvasPattern | null = null, stage: [number, number] = [0, 0];

  const layout = (): void => {
    if (!last) return;
    const { W, H } = last.board;
    const f = fitBoard(stage[0], stage[1], W, H);
    geo = { W, H, cs: f.cs, T: f.T, nest: f.nest, ox: f.T, oy: f.T, bpx: f.cs * W };
    CW = f.CW; CH = f.CH;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.width = CW + 'px';
    canvas.style.height = CH + 'px';
    canvas.width = Math.round(CW * dpr);
    canvas.height = Math.round(CH * dpr);
    pat = dirtPattern(ctx);
  };

  const r: Renderer = {
    reset(g) {
      last = g;
      nSlots = g.slots.length;
      cells = { colors: g.board.colors, vis: Int16Array.from(g.grid), chew: new Float64Array(g.grid.length) };
      ants = []; crumbs = [];
      layout();
    },
    resize(w, h) {
      stage = [w, h];
      layout();
    },
    bite(slot, cell, color, dist) {
      const path = tracePath(dist, cell, geo.W, geo.H);
      ants.push(spawnAnt(geo, holeCol(slot, nSlots, geo.W), cell, color, path, performance.now(), reduce, fastNow));
    },
    frame(now, g, fast) {
      if (g !== last) { last = g; nSlots = g.slots.length; }
      fastNow = fast;
      if (!CW) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, CW, CH);
      drawNest(ctx, geo, CW, CH, pat, g);
      drawBlocks(ctx, geo, cells, now, fast);
      crumbs = drawCrumbs(ctx, crumbs, now);
      ants = stepAnts(ctx, ants, now, geo, cells, crumbs, reduce, r.onChew);
    },
    busy: () => ants.length > 0,
  };
  return r;
}
