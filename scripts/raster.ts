// Node-only: rasterises a scene SVG to a cell grid. Never import from src/ (browser code).
import { Resvg } from '@resvg/resvg-js';
import type { Art, Band } from '../src/core/types';
import { hexRgb } from '../src/render/cube';

export interface SceneMeta {
  id: string; name: string; blurb: string; band: Band;
  W: number; H: number; slots: number; lanes: number; chunk: [number, number]; wait: number; bg: string;
}

const CHARS = 'abcdefghijklmnopqrstuvwxyz';
type RGB = [number, number, number];

/** Reads the JSON held in the SVG's <metadata> element. */
export function parseMeta(svg: string): SceneMeta {
  const m = /<metadata[^>]*>([\s\S]*?)<\/metadata>/.exec(svg);
  if (!m) throw new Error('SVG has no <metadata> element');
  const body = m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '');
  return JSON.parse(body) as SceneMeta;
}

function metaBg(svg: string): string | undefined {
  try {
    const bg = parseMeta(svg).bg;
    return typeof bg === 'string' ? bg.toLowerCase() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Distinct fill/stroke #rrggbb colours in order of first appearance, then the background if new.
 * Throws on any other colour form (#rgb, rgb(), names) so the palette is always exact.
 */
export function svgPalette(svg: string): string[] {
  const out: string[] = [];
  for (const m of svg.matchAll(/\b(?:fill|stroke)\s*[:=]\s*["']?([^"';\s>]+)/g)) {
    const v = m[1];
    if (v === 'none' || v.startsWith('url(')) continue;
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`colour "${v}" is not #rrggbb`);
    const hex = v.toLowerCase();
    if (!out.includes(hex)) out.push(hex);
  }
  const bg = metaBg(svg);
  if (bg && !out.includes(bg)) out.push(bg);
  return out;
}

const luma = ([r, g, b]: RGB) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function nearest(c: RGB, pal: RGB[]): number {
  let best = 0, bestD = Infinity;
  pal.forEach((p, i) => {
    const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Most common palette index among the votes; ties go to the darker colour so outlines survive. */
function majority(votes: Int32Array, pal: RGB[]): number {
  let best = -1;
  for (let i = 0; i < votes.length; i++) {
    if (!votes[i]) continue;
    if (best < 0 || votes[i] > votes[best] || (votes[i] === votes[best] && luma(pal[i]) < luma(pal[best]))) best = i;
  }
  return best;
}

/** Snaps one RGBA sample to a palette index. Transparent samples are the background (or -1 if none). */
function snapper(pal: RGB[], bgIdx: number) {
  const cache = new Map<number, number>();
  return (px: Uint8Array | Buffer, o: number): number => {
    const a = px[o + 3];
    if (a < 128) return bgIdx;
    const key = (px[o] << 16) | (px[o + 1] << 8) | px[o + 2];
    let idx = cache.get(key);
    if (idx === undefined) { idx = nearest([px[o], px[o + 1], px[o + 2]], pal); cache.set(key, idx); }
    return idx;
  };
}

/**
 * Renders the SVG at (W*ss)x(H*ss) and takes, per cell, the most common palette colour among its
 * ss*ss samples. The palette is the SVG's own fill/stroke colours plus the metadata background.
 */
export function rasterize(svg: string, W: number, H: number, opts: { ss?: number } = {}): Art {
  const ss = opts.ss ?? 8;
  const hexes = svgPalette(svg);
  if (!hexes.length) throw new Error('SVG has no fill/stroke colours');
  const pal = hexes.map(hexRgb);
  const bg = metaBg(svg);
  const snap = snapper(pal, bg ? hexes.indexOf(bg) : -1);
  const img = new Resvg(svg, { fitTo: { mode: 'width', value: W * ss }, shapeRendering: 0 }).render();
  if (img.width !== W * ss || img.height !== H * ss) {
    throw new Error(`rendered ${img.width}x${img.height}, expected ${W * ss}x${H * ss}: check the viewBox`);
  }
  const px = img.pixels;
  const grid: number[][] = [];
  const votes = new Int32Array(pal.length);
  for (let cy = 0; cy < H; cy++) {
    const line: number[] = [];
    for (let cx = 0; cx < W; cx++) {
      votes.fill(0);
      for (let y = cy * ss; y < (cy + 1) * ss; y++) {
        for (let x = cx * ss; x < (cx + 1) * ss; x++) {
          const i = snap(px, (y * img.width + x) * 4);
          if (i >= 0) votes[i]++;
        }
      }
      line.push(majority(votes, pal));
    }
    grid.push(line);
  }
  return toArt(grid, hexes);
}

/** Assigns chars a, b, c… to the used colours in palette order and drops unused ones. */
function toArt(grid: number[][], hexes: string[]): Art {
  const used = new Set(grid.flat());
  if (used.has(-1)) throw new Error('some cells are fully transparent and the SVG has no metadata bg');
  const chars = new Map<number, string>();
  const pal: Record<string, string> = {};
  hexes.forEach((hex, i) => {
    if (!used.has(i)) return;
    const ch = CHARS[chars.size];
    chars.set(i, ch);
    pal[ch] = hex;
  });
  return { rows: grid.map((line) => line.map((i) => chars.get(i)).join('')), pal };
}
