// Game controller: owns the current board, the tick loop, input, hints, saving and end-of-board sheets.
import { sceneLevel } from '../core/board';
import { lineHint, searchHint } from '../core/hint';
import { hashStr, mulberry } from '../core/rng';
import type { Level, Meta } from '../core/types';
import { createRenderer, type Renderer } from '../render/board';
import { SCENES } from '../scenes';
import { MANIFEST } from '../scenes/manifest';
import { type Game, newGame, status, tapLane, tick, undo } from '../state/game';
import { dailyPick, nextScene, todayKey } from '../state/progress';
import { type SaveV1, store, toRun } from '../state/save';
import { $, el } from './dom';
import { renderLanes, renderMeter, renderSlots, shakeSlots } from './hud';
import { lose, win } from './outcome';
import { closeSheets, openScenes, wireSheets } from './sheets';
import { bite, ensureAudio, setEnabled, tone } from './sound';

const TIP = 'Tap a squad. Ants run the track and eat from any side.';
const TICK_MS = 95;

let save: SaveV1;
let renderer: Renderer;
let g: Game | null = null;
let seed = 0;
let over = false;
let hintLane: number | null = null;
let hinting = false;
let version = 0; // bumps on every tap, undo and new board so stale hint searches are dropped
let acc = 0, last = 0, sayT = 0;

const newSeed = (): number => 1 + Math.floor(Math.random() * 0x7ffffffe);
const fast = (): boolean => save.prefs.fast;

export const current = (): Game | null => g;

function levelFor(meta: Meta): Level | null {
  if (meta.kind === 'random') return null; // Task 10 wires random mode
  return Object.hasOwn(SCENES, meta.id) ? sceneLevel(SCENES[meta.id]) : null;
}

function setTag(meta: Meta, level: Level): void {
  const lead = meta.kind === 'daily' ? 'Daily' : `${MANIFEST.indexOf(level.key) + 1}/${MANIFEST.length}`;
  $('lvlName').replaceChildren(el('b', '', lead), ` · ${level.name}`);
}

function persist(): void {
  if (g && !over) save.run = toRun(g, seed);
  store(save);
}

function renderAll(): void {
  if (!g) return;
  renderLanes(g, onTap, hintLane);
  renderSlots(g);
  renderMeter(g, over);
}

function say(text: string, ms = 2800): void {
  const h = $('hint');
  h.textContent = text;
  h.hidden = false;
  clearTimeout(sayT);
  sayT = window.setTimeout(() => { h.hidden = true; }, ms);
}

function begin(game: Game, s: number): void {
  g = game; seed = s; over = false; hintLane = null; version++;
  renderer.reset(g);
  closeSheets();
  setTag(g.meta, g.level);
  clearTimeout(sayT);
  const h = $('hint');
  h.textContent = TIP;
  h.hidden = !(g.meta.kind === 'campaign' && g.meta.id === MANIFEST[0] && !save.cleared.length && g.taps === 0);
  renderAll();
  persist();
}

/** Starts a fresh deal. A meta whose scene is gone falls back to the next campaign scene. */
export function start(meta: Meta, s: number = newSeed()): void {
  let level = levelFor(meta);
  if (!level) {
    meta = { kind: 'campaign', id: nextScene(MANIFEST, new Set(save.cleared)) };
    level = levelFor(meta) as Level;
  }
  begin(newGame(meta, level, s), s);
}

export function resume(game: Game, s: number): void {
  begin(game, s);
}

export function playDaily(): void {
  const date = todayKey();
  const id = dailyPick(date, MANIFEST, new Set(save.cleared));
  start({ kind: 'daily', date, id }, hashStr(date + id));
}

function onTap(lane: number): void {
  ensureAudio();
  if (!g || over) return;
  const r = tapLane(g, lane);
  if (r === 'full') { shakeSlots(); tone([180], 0.08, 'square', 0.05); return; }
  if (r !== 'ok') return;
  version++;
  hintLane = null;
  $('hint').hidden = true;
  tone([520, 780], 0.05);
  renderAll();
  persist();
}

function doUndo(): void {
  ensureAudio();
  if (!g || status(g) === 'won' || !undo(g)) return;
  over = false; hintLane = null; version++;
  renderer.reset(g);
  closeSheets();
  renderAll();
  persist();
}

function useHint(lane: number): void {
  if (!g) return;
  g.hints--;
  g.usedHint++;
  hintLane = lane;
  renderAll();
  persist();
}

async function hint(): Promise<void> {
  ensureAudio();
  if (!g || over || hinting || g.hints <= 0) return;
  if (!g.slots.includes(null)) { say('All slots are busy. Wait for a squad to finish.'); return; }
  const line = lineHint(g.onLine, g.idle, g.line, g.taps);
  if (line !== null && g.lanes[line]?.length) { useHint(line); return; }
  const v = version, btn = $('hintBtn');
  hinting = true;
  btn.classList.add('busy');
  const snap = {
    grid: g.grid.slice(), W: g.board.W, H: g.board.H,
    slots: g.slots.map((q) => (q ? { ...q } : null)), lanes: g.lanes.map((q) => q.map((s) => ({ ...s }))),
  };
  const lane = await searchHint(snap, { budgetMs: 3000, rng: mulberry(newSeed()) });
  hinting = false;
  btn.classList.remove('busy');
  if (!g || over || v !== version) return;
  if (lane === null) { say('No clear path from here. Try undoing a tap or two.', 3600); return; }
  useHint(lane);
}

function step(game: Game): void {
  const was = game.stuck;
  if (tick(game, renderer.bite) || was !== game.stuck) { renderSlots(game); renderMeter(game, over); }
}

function endBoard(game: Game, st: 'won' | 'stuck'): void {
  over = true;
  save.run = null;
  renderMeter(game, over);
  const ctx = { game, save, replay: () => start(game.meta), undo: doUndo, start, openScenes: showScenes };
  if (st === 'won') win(ctx); else lose(ctx);
  store(save);
}

function loop(now: number): void {
  requestAnimationFrame(loop);
  const dt = Math.min(250, now - (last || now));
  last = now;
  if (!g) return;
  if (!over) {
    const ms = TICK_MS / (fast() ? 2 : 1);
    acc += dt;
    let n = 0;
    while (acc >= ms && n < 4) { step(g); acc -= ms; n++; }
    if (n >= 4) acc = 0;
  }
  renderer.frame(now, g, fast());
  if (!over && !renderer.busy()) {
    const st = status(g);
    if (st !== 'playing') endBoard(g, st);
  }
}

function syncSpeed(): void {
  const b = $('speedBtn');
  b.textContent = fast() ? '2×' : '1×';
  b.setAttribute('aria-pressed', String(fast()));
}

export function showScenes(): void {
  ensureAudio();
  openScenes({
    manifest: MANIFEST, scenes: SCENES, cleared: new Set(save.cleared), daily: save.daily,
    currentId: g && g.meta.kind !== 'random' ? g.meta.id : null, sound: save.prefs.sound,
    onScene: (id) => start({ kind: 'campaign', id }),
    onDaily: playDaily,
    onSound: () => {
      ensureAudio();
      save.prefs.sound = !save.prefs.sound;
      setEnabled(save.prefs.sound);
      store(save);
      if (save.prefs.sound) bite();
      return save.prefs.sound;
    },
  });
}

function wire(): void {
  $('menuBtn').onclick = showScenes;
  $('undoBtn').onclick = doUndo;
  $('hintBtn').onclick = () => { void hint(); };
  $('restartBtn').onclick = () => { ensureAudio(); if (g) start(g.meta); };
  $('speedBtn').onclick = () => { save.prefs.fast = !save.prefs.fast; store(save); syncSpeed(); };
  wireSheets();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persist(); });
  const stage = $('stage');
  const fit = (): void => { const r = stage.getBoundingClientRect(); renderer.resize(r.width, r.height); };
  new ResizeObserver(fit).observe(stage);
  fit();
}

/** Sets up the renderer, inputs and loop. Call once, then start() or resume(). */
export function init(s: SaveV1): void {
  save = s;
  setEnabled(save.prefs.sound);
  renderer = createRenderer($('board') as HTMLCanvasElement);
  renderer.onChew = bite;
  wire();
  syncSpeed();
  requestAnimationFrame(loop);
}
