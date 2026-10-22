import type { Band } from './types';

export interface BandTargets {
  slots: [number, number];
  /** Win rate of the prototype's mostly-sensible random player. It loses more on longer boards, so the range is loose. */
  winRate: [number, number];
  /** Median taps per deal. Harder boards take longer: smaller squads, so one tap never clears a whole outline. */
  taps: [number, number];
  /** Turns per board where a wrong tap loses the board (see scripts/choices.ts). This carries the difficulty. */
  decisions: [number, number];
  /** Highest win rate allowed for a player who taps any eatable-looking lane without thinking. */
  maxMindless: number;
}

/**
 * Per-band targets for hand-drawn scenes and random mode alike. Browser-safe. Easy boards teach;
 * from Medium on, taps must matter.
 */
export const TARGETS: Record<Band, BandTargets> = {
  easy: { slots: [4, 5], winRate: [0.7, 1], taps: [30, 60], decisions: [0, Infinity], maxMindless: 1 },
  medium: { slots: [3, 4], winRate: [0.15, 0.85], taps: [60, 90], decisions: [6, Infinity], maxMindless: 0.85 },
  hard: { slots: [3, 3], winRate: [0, 0.5], taps: [90, 150], decisions: [14, Infinity], maxMindless: 0.55 },
};

/** The tap count a band aims for: the middle of its range. */
export const tapTarget = (band: Band): number => (TARGETS[band].taps[0] + TARGETS[band].taps[1]) / 2;

/** Grid size is a property of the art, not of difficulty, so it is the same for every band. */
export const WIDTH_RANGE: [number, number] = [40, 56];
export const HEIGHT_RANGE: [number, number] = [36, 60];
