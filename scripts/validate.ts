import { SCENES } from '../src/scenes';
import { MANIFEST } from '../src/scenes/manifest';
import { checkColors, checkDeals, checkStructure, estimateWinRate } from './checks';
import { enclosureDepth } from './depth';
import { TARGETS } from './targets';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const ids = args.filter((a) => !a.startsWith('--'));
const DEALS = quick ? 50 : 500;
const PLAYOUTS = 200;

const pad = (v: string | number, n: number) => String(v).padEnd(n);
const header = [pad('id', 18), pad('band', 7), pad('WxH', 8), pad('col', 4), pad('slots', 6), pad('taps', 6), pad('ms', 7), pad('win', 6), pad('depth', 9), 'flags'];
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
  let taps = '-', ms = '-', win = '-', depth = '-';
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
    }
    const dep = enclosureDepth(s);
    depth = `${dep.avg.toFixed(2)}/${dep.max}`;
    if (dep.avg < t.minAvgDepth) flags.push(`WARN avg depth ${dep.avg.toFixed(2)} below ${t.minAvgDepth}`);
  }
  if (errs.length) failed = true;
  const colours = new Set(s.rows.join('')).size;
  const size = `${s.rows[0]?.length ?? 0}x${s.rows.length}`;
  const notes = [...errs.map((e) => `ERROR ${e}`), ...flags].join('; ');
  console.log([pad(id, 18), pad(s.band, 7), pad(size, 8), pad(colours, 4), pad(s.slots, 6), pad(taps, 6), pad(ms, 7), pad(win, 6), pad(depth, 9), notes].join(' '));
}
process.exit(failed ? 1 : 0);
