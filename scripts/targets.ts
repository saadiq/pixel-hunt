import type { Band } from '../src/core/types';

/** Per-band authoring targets. Browser-safe: no node imports. */
export const TARGETS: Record<Band, { width: [number, number]; winRate: [number, number]; taps: [number, number] }> = {
  easy: { width: [40, 44], winRate: [0.55, 1], taps: [30, 60] },
  medium: { width: [46, 50], winRate: [0.25, 0.6], taps: [30, 60] },
  hard: { width: [52, 56], winRate: [0, 0.3], taps: [30, 60] },
};

export const HEIGHT_RANGE: [number, number] = [36, 60];
