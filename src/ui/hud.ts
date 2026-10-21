// Lanes, holding slots and the meter, ported from the prototype's DOM rendering.
import type { Squad } from '../core/types';
import { canUndo, type Game } from '../state/game';
import { $, ANT_SVG, el, textOn } from './dom';

export function renderLanes(g: Game, onTap: (lane: number) => void): void {
  const box = $('lanes');
  box.style.setProperty('--l', String(g.lanes.length));
  box.innerHTML = '';
  g.lanes.forEach((lane, l) => {
    const b = el('button', 'lane');
    b.disabled = !lane.length;
    b.setAttribute('aria-label', lane.length ? `Send squad of ${lane[0].cap}` : 'Empty lane');
    if (!lane.length) {
      b.innerHTML = '<span class="tile empty">Empty</span><span class="more"></span>';
    } else {
      let h = '';
      lane.slice(0, 3).forEach((s, k) => {
        const col = g.board.colors[s.color];
        h += `<span class="tile ${k ? 'next' : 'top'}" style="--c:${col};--t:${textOn(col)}">${k ? '' : ANT_SVG}${s.cap}</span>`;
      });
      for (let k = lane.length; k < 3; k++) h += '<span class="tile next" style="--c:transparent;opacity:0"></span>';
      h += `<span class="more">${lane.length > 3 ? '+' + (lane.length - 3) + ' more' : ''}</span>`;
      b.innerHTML = h;
    }
    b.addEventListener('click', () => onTap(l));
    box.appendChild(b);
  });
}

// A slot element is replaced only when that slot gets a different squad, so its drop animation plays once.
let shown: (Squad | null)[] = [];

export function renderSlots(g: Game): void {
  const box = $('slots');
  box.style.setProperty('--n', String(g.slots.length));
  if (box.children.length !== g.slots.length) {
    box.replaceChildren(...g.slots.map(() => el('div', 'slot')));
    shown = [];
  }
  g.slots.forEach((s, k) => {
    if (s !== shown[k]) box.children[k].replaceWith(el('div', 'slot'));
  });
  shown = g.slots.slice();
  g.slots.forEach((s, k) => {
    const d = box.children[k] as HTMLElement;
    if (!s) { d.className = 'slot'; d.innerHTML = ''; d.removeAttribute('style'); return; }
    const col = g.board.colors[s.color];
    d.className = 'slot full' + (g.stuck ? ' stuck' : '');
    d.style.setProperty('--c', col);
    d.style.setProperty('--t', textOn(col));
    if (!d.firstChild) d.innerHTML = ANT_SVG + '<span></span>';
    (d.lastChild as HTMLElement).textContent = String(s.cap);
  });
}

/** Pixels left, holding count, and the undo badge. */
export function renderMeter(g: Game): void {
  $('left').textContent = `${g.remaining} pixels left`;
  const used = g.slots.filter(Boolean).length, n = g.slots.length;
  const h = $('hold');
  h.textContent = g.stuck ? 'Stuck: no reachable food' : `Holding ${used}/${n}`;
  h.className = g.stuck || used >= n - 1 ? 'warn' : '';
  $('undoN').textContent = String(g.undos);
  ($('undoBtn') as HTMLButtonElement).disabled = !canUndo(g);
}

/** Brief shake of the slot row when every slot is full. */
export function shakeSlots(): void {
  const s = $('slots');
  s.classList.remove('shake');
  void s.offsetWidth;
  s.classList.add('shake');
}
