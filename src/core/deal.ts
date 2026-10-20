import { exposedMask } from './path';
import { mulberry } from './rng';
import { stepSlots } from './step';
import type { Board, Deal, Lanes, Level, Slots } from './types';

type Rng = () => number;
interface Pick { color: number; cap: number }
interface View { cnt: number[]; unassigned: number[]; used: number }
type Picker = (level: Level, v: View, rng: Rng) => Pick;

// Weighted by sqrt of exposed count, over colours that still have cells to hand out.
function pickExposed(v: View, rng: Rng): number {
  const cand: [number, number][] = [];
  let tot = 0;
  v.cnt.forEach((n, c) => { if (n && v.unassigned[c] > 0) { cand.push([c, n]); tot += Math.sqrt(n); } });
  if (!cand.length) throw new Error('generator stalled');
  let x = rng() * tot, c = cand[0][0];
  for (const [cc, n] of cand) { x -= Math.sqrt(n); if (x <= 0) { c = cc; break; } }
  return c;
}

// The prototype's picker (generate, lines 290–308).
const protoPick: Picker = (level, v, rng) => {
  const [cmin, cmax] = level.chunk;
  // a waiting squad: a color with nothing reachable yet (it will block a slot)
  const hidden = v.unassigned.map((_, c) => c).filter((c) => v.unassigned[c] > 0 && !v.cnt[c]);
  const chunk = cmin + Math.floor(rng() * (cmax - cmin + 1));
  const waiting = v.used < level.slots - (level.waitSlack ?? 2) && rng() < level.wait;
  let c: number, cap: number;
  if (waiting && hidden.length) {
    c = hidden[Math.floor(rng() * hidden.length)];
    cap = Math.min(v.unassigned[c], chunk);
  } else {
    c = pickExposed(v, rng);
    cap = Math.min(v.unassigned[c], chunk);
    // a squad that can only finish once other colors open up the art
    if (!waiting) cap = Math.min(cap, v.cnt[c]);
  }
  if (v.unassigned[c] - cap > 0 && v.unassigned[c] - cap < 3) cap = v.unassigned[c];
  return { color: c, cap: Math.max(1, cap) };
};

// Safe picker: always an exposed colour, capped at its exposed count, so every
// squad finishes during the next settle and slots never fill up.
const safePick: Picker = (level, v, rng) => {
  const [cmin, cmax] = level.chunk;
  const chunk = cmin + Math.floor(rng() * (cmax - cmin + 1));
  const c = pickExposed(v, rng);
  return { color: c, cap: Math.max(1, Math.min(v.unassigned[c], chunk, v.cnt[c])) };
};

/** Plays the level forward with the game's own rules, returning the squads in tap order. */
function buildSeq(level: Level, board: Board, rng: Rng, pick: Picker): Pick[] {
  const { W, H, grid, colors } = board, g = grid.slice();
  const unassigned = colors.map((_, c) => g.reduce((a, v) => a + (v === c ? 1 : 0), 0));
  const slots: Slots = Array(level.slots).fill(null);
  const seq: Pick[] = [];
  for (let guard = 0; guard < 4000; guard++) {
    while (stepSlots(g, W, H, slots));
    if (g.every((v) => v < 0)) return seq;
    const exp = exposedMask(g, W, H), cnt = colors.map(() => 0);
    for (let i = 0; i < W * H; i++) if (exp[i] && g[i] >= 0) cnt[g[i]]++;
    const used = slots.filter(Boolean).length;
    const p = pick(level, { cnt, unassigned, used }, rng);
    seq.push(p);
    unassigned[p.color] -= p.cap;
    const free = slots.indexOf(null);
    if (free < 0) throw new Error('generator jammed');
    slots[free] = { color: p.color, cap: p.cap, total: p.cap };
  }
  throw new Error('generator exhausted');
}

/** Deals seq into FIFO lanes, favouring short lanes; line[k] is the lane of seq[k]. */
function toLanes(level: Level, seq: Pick[], rng: Rng): Deal {
  const lanes: Lanes = Array.from({ length: level.lanes }, () => []);
  const line: number[] = [];
  for (const s of seq) {
    const w = lanes.map((l) => 1 / Math.pow(l.length + 1, 2));
    let x = rng() * w.reduce((a, b) => a + b), k = 0;
    for (; k < w.length; k++) { x -= w[k]; if (x <= 0) break; }
    k = Math.min(k, lanes.length - 1);
    lanes[k].push({ color: s.color, cap: s.cap, total: s.cap });
    line.push(k);
  }
  return { lanes, line };
}

function tryGenerate(level: Level, board: Board, rng: Rng, pick: Picker): Deal | null {
  try {
    return toLanes(level, buildSeq(level, board, rng, pick), rng);
  } catch {
    return null;
  }
}

/** A deal with a recorded winning line. Never throws. */
export function deal(level: Level, board: Board, seed: number): Deal {
  const rng = mulberry(seed);
  for (let k = 0; k < 25; k++) {
    const d = tryGenerate(level, board, rng, protoPick);
    if (d) return d;
  }
  return tryGenerate({ ...level, wait: 0 }, board, rng, protoPick)
    ?? toLanes(level, buildSeq(level, board, rng, safePick), rng);
}

/** Taps `line` in order, settling before each tap. True if the board clears. */
export function replayLine(level: Level, board: Board, d: Deal): boolean {
  const { W, H } = board, g = board.grid.slice();
  const lanes = d.lanes.map((l) => l.map((s) => ({ ...s })));
  const slots: Slots = Array(level.slots).fill(null);
  for (const li of d.line) {
    while (stepSlots(g, W, H, slots));
    const free = slots.indexOf(null);
    const sq = lanes[li]?.shift();
    if (free < 0 || !sq) return false;
    slots[free] = sq;
  }
  while (stepSlots(g, W, H, slots));
  return g.every((v) => v < 0);
}
