import type { Scene } from '../core/types';
import { hotAirBalloon } from './hot-air-balloon';

/** Scene lookup by id. Each scene file is imported here as it is added. */
export const SCENES: Record<string, Scene> = Object.fromEntries(
  [hotAirBalloon].map((s) => [s.id, s]),
);
