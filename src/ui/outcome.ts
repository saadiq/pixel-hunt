// Win and stuck sheets: progress bookkeeping plus the prototype's copy.
import type { Meta } from '../core/types';
import { SCENES } from '../scenes';
import { MANIFEST } from '../scenes/manifest';
import type { Game } from '../state/game';
import type { SaveV1 } from '../state/save';
import { type ResultButton, showResult } from './sheets';
import { tone } from './sound';

export interface OutcomeCtx {
  game: Game;
  save: SaveV1;
  replay(): void;
  undo(): void;
  start(meta: Meta): void;
  openScenes(): void;
}

const plural = (n: number, w: string): string => `${n} ${w}${n > 1 ? 's' : ''}`;

function stats(g: Game): string {
  const undos = g.usedUndo ? plural(g.usedUndo, 'undo') : 'no undos';
  const hints = g.usedHint ? ` · ${plural(g.usedHint, 'hint')}` : '';
  return `${g.taps} squads sent · ${undos}${hints}.`;
}

function markCleared(save: SaveV1, id: string): void {
  if (!save.cleared.includes(id)) save.cleared.push(id);
}

function campaignWin(c: OutcomeCtx, id: string): void {
  const g = c.game, i = MANIFEST.indexOf(id), nextId = MANIFEST[i + 1];
  const replay: ResultButton = { label: 'Replay', fn: c.replay };
  if (nextId && Object.hasOwn(SCENES, nextId)) {
    showResult(`${g.level.name}, gone`, `${stats(g)} Each replay deals the squads differently.`,
      [{ label: `Next: ${SCENES[nextId].name}`, fn: () => c.start({ kind: 'campaign', id: nextId }), primary: true }, replay], g.level);
    return;
  }
  showResult('Every scene cleared', `${stats(g)} Random mode, which deals a new scene every time, is coming soon.`,
    [{ label: 'All scenes', fn: c.openScenes, primary: true }, replay], g.level);
}

export function win(c: OutcomeCtx): void {
  const { game: g, save } = c, m = g.meta;
  tone([523, 659, 784, 1047], 0.11, 'triangle', 0.09);
  if (m.kind === 'campaign') {
    markCleared(save, m.id);
    campaignWin(c, m.id);
  } else if (m.kind === 'daily') {
    save.daily = m.date;
    markCleared(save, m.id);
    showResult("Today's scene, cleared", `${stats(g)} A new one appears tomorrow.`,
      [{ label: 'All scenes', fn: c.openScenes, primary: true }, { label: 'Replay', fn: c.replay }], g.level);
  }
}

export function lose(c: OutcomeCtx): void {
  const g = c.game;
  tone([330, 247, 196], 0.12, 'sine', 0.08);
  const can = g.undos > 0 && g.hist.length > 0;
  showResult('Your ants are stuck',
    'Every holding slot is full and none of those colors can be reached from the track or a tunnel. Undo your last tap or start over.',
    [{ label: can ? `Undo last tap (${g.undos} left)` : 'No undos left', fn: c.undo, primary: true, disabled: !can },
      { label: 'Restart', fn: c.replay }]);
}
