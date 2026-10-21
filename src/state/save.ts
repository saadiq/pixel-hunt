import { parseArt, sceneLevel } from '../core/board';
import { deal } from '../core/deal';
import { copyLanes, copySlots } from '../core/squads';
import { randomLevel } from '../random/level';
import type { Band, Lanes, Level, Meta, Scene, Slots } from '../core/types';
import { countCells, type Game, type Snapshot } from './game';
import type { DailyChoice } from './progress';

// The game was called Crumb Hunt when saves began; the key stays so progress carries over.
const KEY = 'crumbhunt.v1';

export interface SavedRun {
  meta: Meta; seed: number; grid: number[]; lanes: Lanes; slots: Slots; hist: Snapshot[];
  /** Cells in the order they were eaten; older saves lack it and keep no history. */
  eaten?: number[];
  undos: number; usedUndo: number; taps: number; rewound?: boolean;
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
    hist: g.hist.map((h) => ({ ...h, pos: h.pos.slice(), slots: copySlots(h.slots) })), eaten: g.eaten.slice(),
    undos: g.undos, usedUndo: g.usedUndo,
    taps: g.taps, rewound: g.rewound,
  };
}

const isInt = (x: unknown, lo: number, hi = Infinity): boolean => Number.isInteger(x) && (x as number) >= lo && (x as number) <= hi;
interface Dims { n: number; nl: number; ns: number; nc: number }
const isSquad = (s: unknown, nc: number): boolean =>
  isObj(s) && isInt(s.color, 0, nc - 1) && isInt(s.cap, 1) && isInt(s.total, 1);
const validSlots = (s: unknown, d: Dims): boolean =>
  Array.isArray(s) && s.length === d.ns && s.every((q) => q === null || isSquad(q, d.nc));
const validState = (st: unknown, d: Dims): boolean =>
  isObj(st)
  && Array.isArray(st.grid) && st.grid.length === d.n && st.grid.every((v) => isInt(v, -1, d.nc - 1))
  && Array.isArray(st.lanes) && st.lanes.length === d.nl && st.lanes.every((q) => Array.isArray(q) && q.every((s) => isSquad(s, d.nc)))
  && validSlots(st.slots, d)
  && isInt(st.taps, 0);

/** The saved lanes must be what is left of the deal the seed makes. */
const fromDeal = (lanes: Lanes, dealt: Lanes): boolean =>
  lanes.every((q, l) => q.length <= dealt[l].length && JSON.stringify(q) === JSON.stringify(dealt[l].slice(dealt[l].length - q.length)));

/** Eaten cells: each a pixel of the opening board, once, and gone from the saved grid; as many as are missing. */
const validEaten = (e: unknown, open: Int8Array, grid: Int8Array, missing: number): e is number[] =>
  Array.isArray(e) && e.length === missing && new Set(e).size === missing
  && e.every((c) => isInt(c, 0, grid.length - 1) && open[c] >= 0 && grid[c] < 0);

/** Snapshots in order: lane positions only move forward, and pixels only go. */
function validHist(hist: unknown, d: Dims, dealt: Lanes, remaining: number, total: number): hist is Snapshot[] {
  if (!Array.isArray(hist)) return false;
  let pos = dealt.map(() => 0), rem = total;
  return hist.every((h: unknown) => {
    if (!isObj(h) || !Array.isArray(h.pos) || h.pos.length !== d.nl || !validSlots(h.slots, d) || !isInt(h.taps, 0)) return false;
    if (!isInt(h.remaining, remaining, rem) || !h.pos.every((p, l) => isInt(p, pos[l], dealt[l].length))) return false;
    pos = h.pos as number[]; rem = h.remaining as number;
    return true;
  });
}

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
    if (!validState(r, d) || !isInt(r.undos, 0, 3) || !isInt(r.usedUndo, 0) || !isInt(r.seed, 1)) return null;
    const dealt = deal(level, board, r.seed).lanes;
    if (!fromDeal(r.lanes, dealt)) return null;
    const grid = Int8Array.from(r.grid), total = countCells(board.grid), remaining = countCells(grid);
    // A save without a usable history (an older one) resumes with none; the eaten order before now is then moot.
    const ok = validEaten(r.eaten, board.grid, grid, total - remaining) && validHist(r.hist, d, dealt, remaining, total);
    const eaten = ok ? r.eaten as number[] : grid.reduce<number[]>((a, v, i) => (v < 0 && board.grid[i] >= 0 ? [...a, i] : a), []);
    return {
      meta: r.meta, level, board, grid, lanes: r.lanes, slots: r.slots, deal: dealt, eaten, total,
      hist: ok ? r.hist : [], undos: r.undos, usedUndo: r.usedUndo, taps: r.taps,
      remaining, stuck: false, rewound: r.rewound === true,
    };
  } catch { return null; }
}
