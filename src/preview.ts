// Dev-only scene preview: every manifest scene as glossy cubes at 10px/cell and as a 64px thumb, with validator stats.
import { checkColors, checkDeals, checkStructure } from '../scripts/checks';
import { enclosureDepth } from '../scripts/depth';
import { TARGETS } from './core/targets';
import { drawThumb } from './render/thumb';
import { SCENES } from './scenes';
import { el } from './ui/dom';
import { MANIFEST } from './scenes/manifest';
import type { Scene } from './core/types';

const DEALS = 20;

function stats(s: Scene, out: HTMLElement): void {
  const structure = checkStructure(s);
  const errs = [...structure, ...checkColors(s)];
  const W = s.rows[0]?.length ?? 0, colours = new Set(s.rows.join('')).size;
  const lines = [
    `${s.band}  ${W}x${s.rows.length}  ${colours} colours  slots ${s.slots}  lanes ${s.lanes}  chunk ${s.chunk.join('-')}  wait ${s.wait}`,
  ];
  if (!structure.length) {
    const d = checkDeals(s, DEALS);
    const [tlo, thi] = TARGETS[s.band].taps;
    lines.push(`${DEALS} deals: ${d.failures} failed, median taps ${d.medianTaps} (target ${tlo}-${thi}), median ${d.medianMs.toFixed(1)} ms`);
    if (d.failures) errs.push(`${d.failures}/${DEALS} deals failed`);
    const dep = enclosureDepth(s);
    lines.push(`depth avg ${dep.avg.toFixed(2)} max ${dep.max} (>=3: ${Math.round(dep.deep3 * 100)}%)`);
  }
  out.append(el('div', '', lines.join('\n')));
  out.append(errs.length ? el('div', 'err', errs.join('\n')) : el('div', 'ok', 'no errors'));
}

function card(id: string): HTMLElement {
  const s = SCENES[id];
  const box = el('section', 'scene');
  if (!s) {
    box.append(el('h2', 'err', `${id}: unknown scene id`));
    return box;
  }
  box.append(el('h2', '', `${MANIFEST.indexOf(id) + 1}. ${s.name} (${s.id})`), el('p', 'blurb', s.blurb));
  const art = el('div', 'art');
  const full = el('canvas'), thumb = el('canvas');
  drawThumb(full, s, (s.rows[0]?.length ?? 0) * 10);
  drawThumb(thumb, s, 64);
  art.append(full, thumb);
  const out = el('div', 'stats', '');
  box.append(art, out);
  // Deal checks take a moment; let the art paint first.
  setTimeout(() => stats(s, out), 0);
  return box;
}

const root = document.getElementById('scenes');
if (root) for (const id of MANIFEST) root.append(card(id));
