import type { Band, Level, Params } from '../core/types';
import { makeScene } from './scene';

type BandSpec = Omit<Params, 'chunk'> & { size: number };

export const RANDOM_BANDS: Record<Band, BandSpec> = {
  easy: { size: 42, slots: 5, lanes: 3, wait: 0.3 },
  medium: { size: 48, slots: 4, lanes: 4, wait: 0.5 },
  hard: { size: 54, slots: 3, lanes: 4, wait: 0.85 },
};

export const randomKey = (band: Band, seed: number): string => `r-${band}-${seed}`;

/** A random scene as a playable level; squad size scales so a board takes about 45 taps. */
export function randomLevel(band: Band, seed: number): Level {
  const { size, slots, lanes, wait } = RANDOM_BANDS[band];
  const art = makeScene(seed, size);
  const avg = Math.max(1, Math.round((size * size) / 45));
  const chunk: [number, number] = [Math.max(1, Math.round(avg * 0.75)), Math.max(1, Math.round(avg * 1.25))];
  return { key: randomKey(band, seed), name: art.name, band, rows: art.rows, pal: art.pal, slots, lanes, wait, chunk };
}
