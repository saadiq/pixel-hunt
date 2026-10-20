import type { Band } from '../src/core/types';

export interface BandTargets {
  slots: [number, number];
  winRate: [number, number];
  taps: [number, number];
  /** The validator WARNs when a scene's average enclosure depth is below this. */
  minAvgDepth: number;
  /** Share of turns where a wrong tap loses the board (see choices.ts). */
  choice: [number, number];
  /** Highest win rate allowed for a player who taps any eatable-looking lane without thinking. */
  maxMindless: number;
}

/** Per-band authoring targets. Browser-safe: no node imports. Easy boards teach; from Medium on, taps must matter. */
export const TARGETS: Record<Band, BandTargets> = {
  easy: { slots: [4, 5], winRate: [0.7, 1], taps: [30, 60], minAvgDepth: 0, choice: [0, 1], maxMindless: 1 },
  medium: { slots: [3, 4], winRate: [0.3, 0.8], taps: [30, 60], minAvgDepth: 0, choice: [0.12, 1], maxMindless: 0.85 },
  // depth was a stand-in for difficulty before choices were measured directly; it stays in the report only
  hard: { slots: [2, 3], winRate: [0, 0.5], taps: [30, 60], minAvgDepth: 0, choice: [0.18, 1], maxMindless: 0.5 },
};

/** Grid size is a property of the art, not of difficulty, so it is the same for every band. */
export const WIDTH_RANGE: [number, number] = [40, 56];
export const HEIGHT_RANGE: [number, number] = [36, 60];
