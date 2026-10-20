import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import { checkColors, checkDeals, checkStructure, estimateWinRate } from './checks';
import { TARGETS } from './targets';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const ids = args.filter((a) => !a.startsWith('--'));
const DEALS = quick ? 50 : 500;
const PLAYOUTS = 200;

const pad = (v: string | number, n: number) => String(v).padEnd(n);
console.log([pad('id', 18), pad('band', 7), pad('WxH', 8), pad('col', 4), pad('taps', 6), pad('ms', 7), pad('win', 6), 'flags'].join(' '));

let failed = false;
for (const id of ids.length ? ids : MANIFEST) {
  const s = SCENES[id];
  if (!s) {
    console.log(`${pad(id, 18)} ERROR: unknown scene id`);
    failed = true;
    continue;
  }
  const flags: string[] = [];
  const errs = [...checkStructure(s), ...checkColors(s)];
  let taps = '-', ms = '-', win = '-';
  if (!checkStructure(s).length) {
    const d = checkDeals(s, DEALS);
    if (d.failures) errs.push(`${d.failures}/${DEALS} deals failed`);
    taps = String(d.medianTaps);
    ms = d.medianMs.toFixed(1);
    const [tlo, thi] = TARGETS[s.band].taps;
    if (d.medianTaps < tlo || d.medianTaps > thi) flags.push(`WARN taps ${d.medianTaps} outside ${tlo}-${thi}`);
    const w = estimateWinRate(s, PLAYOUTS);
    win = w.toFixed(2);
    const [wlo, whi] = TARGETS[s.band].winRate;
    if (w < wlo || w > whi) flags.push(`WARN win rate ${win} outside ${wlo}-${whi}`);
  }
  if (errs.length) failed = true;
  const colours = new Set(s.rows.join('')).size;
  const size = `${s.rows[0]?.length ?? 0}x${s.rows.length}`;
  console.log([pad(id, 18), pad(s.band, 7), pad(size, 8), pad(colours, 4), pad(taps, 6), pad(ms, 7), pad(win, 6), [...errs.map((e) => `ERROR ${e}`), ...flags].join('; ')].join(' '));
}
process.exit(failed ? 1 : 0);
