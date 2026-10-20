// Game controller: owns the current board, the tick loop, input, saving and end-of-board sheets.
import { sceneLevel } from '../core/board';
import { hashStr } from '../core/rng';
import type { Band, Level, Meta } from '../core/types';
import { randomLevel } from '../random/level';
import { createRenderer, type Renderer } from '../render/board';
import { SCENES } from '../scenes';
import { MANIFEST } from '../scenes/manifest';
import { type Game, newGame, status, tapLane, tick, undo } from '../state/game';
import { dailyFor, nextScene, todayKey } from '../state/progress';
import { type SaveV1, store, toRun } from '../state/save';
import { $, el } from './dom';
import { renderLanes, renderMeter, renderSlots, shakeSlots } from './hud';
import { lose, win } from './outcome';
import { closeSheets, openScenes, wireSheets } from './sheets';
import { bite, ensureAudio, setEnabled, tone } from './sound';

const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const MUTED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>';

const TICK_MS = 95;

let save: SaveV1;
let renderer: Renderer;
let g: Game | null = null;
let seed = 0;
let over = false;
let acc = 0, last = 0;

const newSeed = (): number => 1 + Math.floor(Math.random() * 0x7ffffffe);
const fast = (): boolean => save.prefs.fast;

export const current = (): Game | null => g;

function levelFor(meta: Meta): Level | null {
  if (meta.kind === 'random') return randomLevel(meta.band, meta.seed);
  return Object.hasOwn(SCENES, meta.id) ? sceneLevel(SCENES[meta.id]) : null;
}

function setTag(meta: Meta, level: Level): void {
  const lead = meta.kind === 'daily' ? 'Daily' : meta.kind === 'random' ? 'Random' : `${MANIFEST.indexOf(level.key) + 1}/${MANIFEST.length}`;
  $('lvlName').replaceChildren(el('b', '', lead), ` · ${level.name}`);
}

function persist(): void {
  if (g && !over) save.run = toRun(g, seed);
  store(save);
}

function renderAll(): void {
  if (!g) return;
  renderLanes(g, onTap);
  renderSlots(g);
  renderMeter(g);
}

function begin(game: Game, s: number): void {
  g = game; seed = s; over = false;
  renderer.reset(g);
  closeSheets();
  setTag(g.meta, g.level);
  $('tip').hidden = !(g.meta.kind === 'campaign' && g.meta.id === MANIFEST[0] && !save.cleared.length && g.taps === 0);
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

/** A new random scene in `band`; restarts of it deal a fresh random order on the same picture. */
export function playRandom(band: Band): void {
  const s = newSeed();
  start({ kind: 'random', band, seed: s }, s);
}

export function playDaily(): void {
  const date = todayKey();
  const { id } = save.dailyPick = dailyFor(date, MANIFEST, new Set(save.cleared), save.dailyPick);
  start({ kind: 'daily', date, id }, hashStr(date + id));
}

function onTap(lane: number): void {
  ensureAudio();
  if (!g || over) return;
  const r = tapLane(g, lane);
  if (r === 'full') { shakeSlots(); tone([180], 0.08, 'square', 0.05); return; }
  if (r !== 'ok') return;
  $('tip').hidden = true;
  tone([520, 780], 0.05);
  renderAll();
  persist();
}

function doUndo(): void {
  ensureAudio();
  if (!g || status(g) === 'won' || !undo(g)) return;
  over = false;
  renderer.reset(g);
  closeSheets();
  renderAll();
  persist();
}

function step(game: Game): void {
  const was = game.stuck;
  if (tick(game, renderer.bite) || was !== game.stuck) { renderSlots(game); renderMeter(game); }
}

function endBoard(game: Game, st: 'won' | 'stuck'): void {
  over = true;
  save.run = null;
  renderMeter(game);
  const ctx = { game, save, replay: () => start(game.meta), undo: doUndo, start, openScenes: showScenes, random: playRandom };
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

function syncMute(): void {
  const b = $('muteBtn'), on = save.prefs.sound;
  b.innerHTML = on ? SPEAKER : MUTED;
  b.setAttribute('aria-pressed', String(!on));
  b.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
}

function toggleSound(): void {
  ensureAudio();
  save.prefs.sound = !save.prefs.sound;
  setEnabled(save.prefs.sound);
  store(save);
  syncMute();
  if (save.prefs.sound) bite();
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
    currentId: g && g.meta.kind !== 'random' ? g.meta.id : null,
    band: save.prefs.band, wins: save.wins,
    onBand: (b) => { save.prefs.band = b; store(save); },
    onRandom: playRandom,
    onScene: (id) => start({ kind: 'campaign', id }),
    onDaily: playDaily,
  });
}

function wire(): void {
  $('menuBtn').onclick = showScenes;
  $('undoBtn').onclick = doUndo;
  $('muteBtn').onclick = toggleSound;
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
  syncMute();
  requestAnimationFrame(loop);
}
