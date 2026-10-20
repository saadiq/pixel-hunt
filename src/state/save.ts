import { parseArt, sceneLevel } from '../core/board';
import { copyLanes, copySlots } from '../core/squads';
import { randomLevel } from '../random/level';
import type { Band, Lanes, Level, Meta, Scene, Slots } from '../core/types';
import { type Game, HIST_MAX, type Snapshot } from './game';
import type { DailyChoice } from './progress';

// The game was called Crumb Hunt when saves began; the key stays so progress carries over.
const KEY = 'crumbhunt.v1';

export interface SavedSnapshot { grid: number[]; lanes: Lanes; slots: Slots; remaining: number; taps: number }
export interface SavedRun {
  meta: Meta; seed: number; grid: number[]; lanes: Lanes; slots: Slots; hist: SavedSnapshot[];
  undos: number; usedUndo: number; taps: number;
}
export interface SaveV1 {
  v: 1; cleared: string[]; wins: Record<Band, number>; daily: string | null;
  prefs: { sound: boolean; fast: boolean; band: Band }; run: SavedRun | null;
  /** The day's scene, fixed on first pick so clearing scenes can't change it mid-day. */
  dailyPick?: DailyChoice;
}

export function defaults(): SaveV1 {
  return { v: 1, cleared: [], wins: { easy: 0, medium: 0, hard: 0 }, daily: null, prefs: { sound: true, fast: false, band: 'medium' }, run: null };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const BANDS: Band[] = ['easy', 'medium', 'hard'];

const dailyChoice = (x: unknown): DailyChoice | null =>
  isObj(x) && typeof x.date === 'string' && typeof x.id === 'string' ? { date: x.date, id: x.id } : null;

function sanitize(raw: unknown): SaveV1 {
  const d = defaults();
  if (!isObj(raw) || raw.v !== 1) return d;
  if (Array.isArray(raw.cleared)) d.cleared = raw.cleared.filter((x): x is string => typeof x === 'string');
  if (isObj(raw.wins)) for (const b of BANDS) { const n = raw.wins[b]; if (typeof n === 'number' && n >= 0) d.wins[b] = n; }
  if (typeof raw.daily === 'string') d.daily = raw.daily;
  const dp = dailyChoice(raw.dailyPick);
  if (dp) d.dailyPick = dp;
  if (isObj(raw.prefs)) {
    const p = raw.prefs;
    if (typeof p.sound === 'boolean') d.prefs.sound = p.sound;
    if (typeof p.fast === 'boolean') d.prefs.fast = p.fast;
    if (BANDS.includes(p.band as Band)) d.prefs.band = p.band as Band;
  }
  if (isObj(raw.run)) d.run = raw.run as unknown as SavedRun;
  return d;
}

function defaultStorage(): Storage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function load(storage: Storage | undefined = defaultStorage()): SaveV1 {
  try {
    const txt = storage?.getItem(KEY);
    return txt ? sanitize(JSON.parse(txt)) : defaults();
  } catch { return defaults(); }
}

export function store(s: SaveV1, storage: Storage | undefined = defaultStorage()): void {
  try { storage?.setItem(KEY, JSON.stringify(s)); } catch { /* private mode or quota: play on */ }
}

export function toRun(g: Game, seed: number): SavedRun {
  return {
    meta: g.meta, seed, grid: Array.from(g.grid), lanes: copyLanes(g.lanes), slots: copySlots(g.slots),
    hist: g.hist.map((h) => ({ ...h, grid: Array.from(h.grid), lanes: copyLanes(h.lanes), slots: copySlots(h.slots) })),
    undos: g.undos, usedUndo: g.usedUndo,
    taps: g.taps,
  };
}

const isInt = (x: unknown, lo: number, hi = Infinity): boolean => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
interface Dims { n: number; nl: number; ns: number; nc: number }
const isSquad = (s: unknown, nc: number): boolean =>
  isObj(s) && isInt(s.color, 0, nc - 1) && isInt(s.cap, 1) && isInt(s.total, 1);
const validState = (st: unknown, d: Dims): boolean =>
  isObj(st)
  && Array.isArray(st.grid) && st.grid.length === d.n && st.grid.every((v) => isInt(v, -1, d.nc - 1))
  && Array.isArray(st.lanes) && st.lanes.length === d.nl && st.lanes.every((q) => Array.isArray(q) && q.every((s) => isSquad(s, d.nc)))
  && Array.isArray(st.slots) && st.slots.length === d.ns && st.slots.every((s) => s === null || isSquad(s, d.nc))
  && isInt(st.taps, 0);

const count = (g: Int8Array): number => g.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0);

export function findLevel(meta: Meta, scenes: Record<string, Scene>): Level | null {
  if (meta.kind === 'random') {
    return BANDS.includes(meta.band) && isInt(meta.seed, 1) ? randomLevel(meta.band, meta.seed) : null;
  }
  return Object.hasOwn(scenes, meta.id) ? sceneLevel(scenes[meta.id]) : null;
}

export function fromRun(r: SavedRun, scenes: Record<string, Scene>): Game | null {
  try {
    if (!isObj(r) || !isObj(r.meta)) return null;
    const level = findLevel(r.meta, scenes);
    if (!level) return null;
    const board = parseArt(level);
    const n = board.W * board.H;
    const d: Dims = { n, nl: level.lanes, ns: level.slots, nc: board.colors.length };
    if (!validState(r, d)) return null;
    if (!Array.isArray(r.hist) || !r.hist.every((h) => validState(h, d))) return null;
    if (!isInt(r.undos, 0, 3) || !isInt(r.usedUndo, 0)) return null;
    const hist: Snapshot[] = r.hist.slice(-HIST_MAX).map((h) => {
      const g = Int8Array.from(h.grid);
      return { grid: g, lanes: h.lanes, slots: h.slots, taps: h.taps, remaining: count(g) };
    });
    const grid = Int8Array.from(r.grid);
    return {
      meta: r.meta, level, board, grid, lanes: r.lanes, slots: r.slots, hist,
      undos: r.undos, usedUndo: r.usedUndo, taps: r.taps,
      remaining: count(grid), stuck: false,
    };
  } catch { return null; }
}
