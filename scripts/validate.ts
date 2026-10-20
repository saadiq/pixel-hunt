import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import { checkColors, checkDeals, checkStructure, estimateWinRate } from './checks';
import { type Choices, measureChoices, measureLevel } from './choices';
import { enclosureDepth } from './depth';
import { TARGETS } from '../src/core/targets';
import { randomLevel } from '../src/random/level';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const ids = args.filter((a) => !a.startsWith('--'));
const DEALS = quick ? 50 : 500;
const PLAYOUTS = 200;
const CHOICE_DEALS = quick ? 3 : 8;

const pad = (v: string | number, n: number) => String(v).padEnd(n);
const header = [pad('id', 18), pad('band', 7), pad('WxH', 8), pad('col', 4), pad('slots', 6), pad('taps', 6), pad('ms', 7), pad('win', 6), pad('depth', 9), pad('choice', 7), pad('decide', 7), pad('mindless', 9), 'flags'];
console.log(header.join(' '));

let failed = false;
for (const id of ids.length ? ids : MANIFEST) {
  const s = SCENES[id];
  if (!s) {
    console.log(`${pad(id, 18)} ERROR: unknown scene id`);
    failed = true;
    continue;
  }
  const flags: string[] = [];
  const structure = checkStructure(s);
  const errs = [...structure, ...checkColors(s)];
  const t = TARGETS[s.band];
  let taps = '-', ms = '-', win = '-', depth = '-', choice = '-', decide = '-', mindless = '-';
  if (!structure.length) {
    const d = checkDeals(s, DEALS);
    if (d.failures) errs.push(`${d.failures}/${DEALS} deals failed`);
    taps = String(d.medianTaps);
    ms = d.medianMs.toFixed(1);
    const [tlo, thi] = t.taps;
    if (d.medianTaps < tlo || d.medianTaps > thi) flags.push(`WARN taps ${d.medianTaps} outside ${tlo}-${thi}`);
    if (!d.failures) {
      const w = estimateWinRate(s, PLAYOUTS);
      win = w.toFixed(2);
      const [wlo, whi] = t.winRate;
      if (w < wlo || w > whi) flags.push(`WARN win rate ${win} outside ${wlo}-${whi}`);
      const c = measureChoices(s, CHOICE_DEALS);
      choice = c.choice.toFixed(2);
      decide = c.decisions.toFixed(1);
      mindless = c.mindless.toFixed(2);
      const [dlo, dhi] = t.decisions;
      if (c.decisions < dlo || c.decisions > dhi) flags.push(`WARN ${decide} decisions per board, wants ${dlo}+`);
      if (c.mindless > t.maxMindless) flags.push(`WARN mindless ${mindless} above ${t.maxMindless}`);
    }
    const dep = enclosureDepth(s);
    depth = `${dep.avg.toFixed(2)}/${dep.max}`;
  }
  if (errs.length) failed = true;
  const colours = new Set(s.rows.join('')).size;
  const size = `${s.rows[0]?.length ?? 0}x${s.rows.length}`;
  const notes = [...errs.map((e) => `ERROR ${e}`), ...flags].join('; ');
  console.log([pad(id, 18), pad(s.band, 7), pad(size, 8), pad(colours, 4), pad(s.slots, 6), pad(taps, 6), pad(ms, 7), pad(win, 6), pad(depth, 9), pad(choice, 7), pad(decide, 7), pad(mindless, 9), notes].join(' '));
}
// Random mode shares the band targets, so check a few seeds of each band the same way.
if (!ids.length) {
  for (const band of ['easy', 'medium', 'hard'] as const) {
    const t = TARGETS[band], seeds = [11, 22, 33];
    const ms = seeds.map((seed) => measureLevel(randomLevel(band, seed), CHOICE_DEALS));
    const avg = (f: (c: Choices) => number) => ms.reduce((a, c) => a + f(c), 0) / ms.length;
    const decisions = avg((c) => c.decisions), mindless = avg((c) => c.mindless);
    const flags: string[] = [];
    if (decisions < t.decisions[0]) flags.push(`WARN ${decisions.toFixed(1)} decisions per board, wants ${t.decisions[0]}+`);
    if (mindless > t.maxMindless) flags.push(`WARN mindless ${mindless.toFixed(2)} above ${t.maxMindless}`);
    console.log(`${pad(`random-${band}`, 18)} decide ${decisions.toFixed(1)}  mindless ${mindless.toFixed(2)}  ${flags.join('; ')}`);
  }
}
process.exit(failed ? 1 : 0);
