import { parseArt, sceneLevel } from '../core/board';
import type { Band, Lanes, Meta, Scene, Slots, Squad } from '../core/types';
import type { Game, Snapshot } from './game';

const KEY = 'crumbhunt.v1';

export interface SavedSnapshot { grid: number[]; lanes: Lanes; slots: Slots; remaining: number; taps: number; onLine: boolean }
export interface SavedRun {
  meta: Meta; seed: number; grid: number[]; lanes: Lanes; slots: Slots; hist: SavedSnapshot[];
  undos: number; hints: number; usedUndo: number; usedHint: number; taps: number; line: number[]; onLine: boolean;
}
export interface SaveV1 {
  v: 1; cleared: string[]; wins: Record<Band, number>; daily: string | null;
  prefs: { sound: boolean; fast: boolean; band: Band }; run: SavedRun | null;
}

export function defaults(): SaveV1 {
  return { v: 1, cleared: [], wins: { easy: 0, medium: 0, hard: 0 }, daily: null, prefs: { sound: true, fast: false, band: 'medium' }, run: null };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const BANDS: Band[] = ['easy', 'medium', 'hard'];

function sanitize(raw: unknown): SaveV1 {
  const d = defaults();
  if (!isObj(raw) || raw.v !== 1) return d;
  if (Array.isArray(raw.cleared)) d.cleared = raw.cleared.filter((x): x is string => typeof x === 'string');
  if (isObj(raw.wins)) for (const b of BANDS) { const n = raw.wins[b]; if (typeof n === 'number' && n >= 0) d.wins[b] = n; }
  if (typeof raw.daily === 'string') d.daily = raw.daily;
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

const copyLanes = (l: Lanes): Lanes => l.map((q) => q.map((s) => ({ ...s })));
const copySlots = (s: Slots): Slots => s.map((q) => (q ? { ...q } : null));

export function toRun(g: Game, seed: number): SavedRun {
  return {
    meta: g.meta, seed, grid: Array.from(g.grid), lanes: copyLanes(g.lanes), slots: copySlots(g.slots),
    hist: g.hist.map((h) => ({ ...h, grid: Array.from(h.grid), lanes: copyLanes(h.lanes), slots: copySlots(h.slots) })),
    undos: g.undos, hints: g.hints, usedUndo: g.usedUndo, usedHint: g.usedHint,
    taps: g.taps, line: g.line.slice(), onLine: g.onLine,
  };
}

const isSquad = (s: unknown): s is Squad => isObj(s) && [s.color, s.cap, s.total].every((n) => typeof n === 'number');
const validState = (st: unknown, n: number, nl: number, ns: number): boolean =>
  isObj(st)
  && Array.isArray(st.grid) && st.grid.length === n && st.grid.every((v) => Number.isInteger(v))
  && Array.isArray(st.lanes) && st.lanes.length === nl && st.lanes.every((q) => Array.isArray(q) && q.every(isSquad))
  && Array.isArray(st.slots) && st.slots.length === ns && st.slots.every((s) => s === null || isSquad(s));

function findScene(meta: Meta, scenes: Record<string, Scene>): Scene | null {
  if (meta.kind === 'random') return null; // Task 10 adds randomLevel
  return Object.hasOwn(scenes, meta.id) ? scenes[meta.id] : null;
}

export function fromRun(r: SavedRun, scenes: Record<string, Scene>): Game | null {
  try {
    if (!isObj(r) || !isObj(r.meta)) return null;
    const scene = findScene(r.meta, scenes);
    if (!scene) return null;
    const level = sceneLevel(scene);
    const board = parseArt(level);
    const n = board.W * board.H;
    if (!validState(r, n, level.lanes, level.slots)) return null;
    if (!Array.isArray(r.hist) || !r.hist.every((h) => validState(h, n, level.lanes, level.slots))) return null;
    if (!Array.isArray(r.line)) return null;
    const hist: Snapshot[] = r.hist.map((h) => ({ ...h, grid: Int8Array.from(h.grid) }));
    const grid = Int8Array.from(r.grid);
    return {
      meta: r.meta, level, board, grid, lanes: r.lanes, slots: r.slots, hist,
      undos: r.undos, hints: r.hints, usedUndo: r.usedUndo, usedHint: r.usedHint, taps: r.taps,
      remaining: grid.reduce((a, v) => a + (v >= 0 ? 1 : 0), 0), stuck: false,
      idle: r.slots.every((s) => s === null), line: r.line, onLine: r.onLine,
    };
  } catch { return null; }
}
