export interface Fit { cs: number; T: number; nest: number; CW: number; CH: number }

const MIN_CS = 0.25, MIN_NEST = 14, MARGIN = 12;

/**
 * Sizes the canvas to the stage. The canvas is the board plus a thin track (T = 0.6 cs) on three sides
 * and a nest strip below. Cells may be fractional and shrink as far as the stage forces
 * (tiny cells draw as flat squares); cs is always finite and positive.
 */
export function fitBoard(stageW: number, stageH: number, W: number, H: number): Fit {
  const w = Math.max(1, W), h = Math.max(1, H);
  const avW = Math.max(0, (Number.isFinite(stageW) ? stageW : 0) - MARGIN);
  const avH = Math.max(0, (Number.isFinite(stageH) ? stageH : 0) - MARGIN);
  const byW = avW / (w + 1.2);
  let cs = Math.min(byW, avH / (h + 0.6 + 1.6));
  if (cs * 1.6 < MIN_NEST) cs = Math.min(byW, (avH - MIN_NEST) / (h + 0.6)); // nest floored at 14px
  if (!(cs >= MIN_CS)) cs = MIN_CS; // degenerate stages only
  const T = cs * 0.6, nest = Math.max(MIN_NEST, cs * 1.6);
  return { cs, T, nest, CW: w * cs + 2 * T, CH: T + h * cs + nest };
}
