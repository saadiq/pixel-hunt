import type { Scene } from '../core/types';
import { bentoBox } from './bento-box';
import { birthdayCake } from './birthday-cake';
import { brooklynBridge } from './brooklyn-bridge';
import { coralReef } from './coral-reef';
import { goldfishBowl } from './goldfish-bowl';
import { hotAirBalloon } from './hot-air-balloon';

/** Scene lookup by id. Each scene file is imported here as it is added. */
export const SCENES: Record<string, Scene> = Object.fromEntries(
  [hotAirBalloon, goldfishBowl, brooklynBridge, birthdayCake, coralReef, bentoBox].map((s) => [s.id, s]),
);
