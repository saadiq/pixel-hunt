// The scenes sheet (bands, daily, random, sound) and the result sheet.
import type { Art, Band, Scene } from '../core/types';
import { drawThumb } from '../render/thumb';
import { isUnlocked, nextScene, todayKey } from '../state/progress';
import { $, el, LOCK_SVG } from './dom';

export interface ScenesCtx {
  manifest: string[];
  scenes: Record<string, Scene>;
  cleared: Set<string>;
  daily: string | null;
  currentId: string | null;
  sound: boolean;
  band: Band;
  wins: Record<Band, number>;
  onScene(id: string): void;
  onDaily(): void;
  onBand(b: Band): void;
  onRandom(b: Band): void;
  onSound(): boolean; // toggles; returns the new value
}

export interface ResultButton { label: string; fn: () => void; primary?: boolean; disabled?: boolean }

const BANDS: [Band, string][] = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];
const BAND_NOTE: Record<Band, string> = {
  easy: 'Roomy: 5 holding slots, 3 lanes, a gentle wait.',
  medium: 'Balanced: 4 holding slots, 4 lanes. Some taps matter.',
  hard: 'Tight: 3 holding slots, 5 lanes. Choose carefully.',
};

function syncRandom(ctx: ScenesCtx, band: Band): void {
  document.querySelectorAll<HTMLButtonElement>('#diffSeg button').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.d === band));
    b.onclick = () => { ctx.onBand(b.dataset.d as Band); syncRandom(ctx, b.dataset.d as Band); };
  });
  $('diffNote').textContent = BAND_NOTE[band];
  $('endStat').textContent = `${ctx.wins[band]} cleared`;
  $('randBtn').onclick = () => { closeSheets(); ctx.onRandom(band); };
}

function sceneItem(ctx: ScenesCtx, id: string, num: number, next: string): HTMLButtonElement {
  const s = ctx.scenes[id];
  const cleared = ctx.cleared.has(id), open = isUnlocked(id, ctx.manifest, ctx.cleared);
  const b = el('button', 'lvItem');
  b.setAttribute('aria-current', id === next && !cleared ? 'true' : 'false');
  b.disabled = !open;
  if (cleared) {
    const c = el('canvas');
    drawThumb(c, s, 128);
    b.appendChild(c);
  } else {
    const ph = el('div', 'ph');
    if (open) ph.textContent = '?'; else ph.innerHTML = LOCK_SVG;
    b.appendChild(ph);
  }
  const t = el('div');
  t.append(el('div', 'nm', `${num}. ${s.name}`), el('div', 'bl', open ? s.blurb : 'Clear the scene before it to unlock.'));
  b.appendChild(t);
  const st = cleared ? 'Cleared' : open ? (id === ctx.currentId ? 'Playing' : 'Play') : 'Locked';
  b.appendChild(el('div', 'st' + (open ? '' : ' lock'), st));
  b.setAttribute('aria-label', `${num}. ${s.name}, ${st}`);
  if (open) b.onclick = () => { closeSheets(); ctx.onScene(id); };
  return b;
}

function syncSound(on: boolean): void {
  const b = $('soundBtn');
  b.setAttribute('aria-pressed', String(on));
  b.textContent = on ? 'Sound: on' : 'Sound: off';
}

export function openScenes(ctx: ScenesCtx): void {
  const list = $('levelList');
  list.innerHTML = '';
  const next = nextScene(ctx.manifest, ctx.cleared);
  const ids = ctx.manifest.filter((id) => Object.hasOwn(ctx.scenes, id));
  for (const [band, label] of BANDS) {
    const inBand = ids.filter((id) => ctx.scenes[id].band === band);
    if (!inBand.length) continue;
    const done = inBand.filter((id) => ctx.cleared.has(id)).length;
    const head = el('div', 'secHead');
    head.append(el('h3', '', label), el('span', '', `${done} of ${inBand.length}`));
    list.appendChild(head);
    for (const id of inBand) list.appendChild(sceneItem(ctx, id, ctx.manifest.indexOf(id) + 1, next));
  }
  const total = ids.filter((id) => ctx.cleared.has(id)).length;
  $('campStat').textContent = `${total} of ${ids.length} cleared`;
  const doneToday = ctx.daily === todayKey();
  $('dailyBtn').textContent = doneToday ? "Today's scene ✓" : "Today's scene";
  $('dayStat').textContent = doneToday ? 'Done for today' : 'A new pick each day';
  $('dailyBtn').onclick = () => { closeSheets(); ctx.onDaily(); };
  syncRandom(ctx, ctx.band);
  syncSound(ctx.sound);
  $('soundBtn').onclick = () => syncSound(ctx.onSound());
  $('levelsSheet').hidden = false;
}

let resultT = 0;

/** Shows the result sheet after a short beat; with art, the finished picture sits on top. */
export function showResult(title: string, text: string, buttons: ResultButton[], art?: Art): void {
  $('resTitle').textContent = title;
  $('resText').textContent = text;
  const box = $('resArt');
  box.innerHTML = '';
  if (art) {
    const c = el('canvas');
    drawThumb(c, art, 320);
    box.appendChild(c);
  }
  const row = $('resBtns');
  row.innerHTML = '';
  for (const bt of buttons) {
    const b = el('button', 'btn' + (bt.primary ? ' primary' : ''), bt.label);
    b.disabled = !!bt.disabled;
    b.onclick = () => { closeSheets(); bt.fn(); };
    row.appendChild(b);
  }
  clearTimeout(resultT);
  resultT = window.setTimeout(() => { $('resultSheet').hidden = false; }, art ? 450 : 250);
}

export function closeSheets(): void {
  clearTimeout(resultT);
  $('resultSheet').hidden = true;
  $('levelsSheet').hidden = true;
}

/** Close on scrim tap, the back button, or Escape (scenes sheet only; results need a choice). */
export function wireSheets(): void {
  $('closeLevels').onclick = () => { $('levelsSheet').hidden = true; };
  $('levelsSheet').addEventListener('click', (e) => { if (e.target === e.currentTarget) $('levelsSheet').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('levelsSheet').hidden = true; });
}
