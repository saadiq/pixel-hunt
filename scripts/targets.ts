import type { Band } from '../src/core/types';

export interface BandTargets {
  width: [number, number];
  slots: [number, number];
  winRate: [number, number];
  taps: [number, number];
  /** The validator WARNs when a scene's average enclosure depth is below this. */
  minAvgDepth: number;
}

/** Per-band authoring targets. Browser-safe: no node imports. */
export const TARGETS: Record<Band, BandTargets> = {
  easy: { width: [40, 44], slots: [4, 5], winRate: [0.7, 1], taps: [30, 60], minAvgDepth: 0 },
  medium: { width: [46, 50], slots: [3, 4], winRate: [0.45, 0.75], taps: [30, 60], minAvgDepth: 0 },
  hard: { width: [52, 56], slots: [2, 3], winRate: [0, 0.45], taps: [30, 60], minAvgDepth: 1.5 },
};

export const HEIGHT_RANGE: [number, number] = [36, 60];
