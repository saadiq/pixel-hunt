import type { Scene } from '../core/types';
import { bentoBox } from './bento-box';
import { birthdayCake } from './birthday-cake';
import { brooklynBridge } from './brooklyn-bridge';
import { coralReef } from './coral-reef';
import { desertCactus } from './desert-cactus';
import { goldfishBowl } from './goldfish-bowl';
import { hotAirBalloon } from './hot-air-balloon';
import { lighthouseAtDusk } from './lighthouse-at-dusk';
import { paperBoat } from './paper-boat';
import { recordPlayer } from './record-player';
import { rubberDuck } from './rubber-duck';
import { sleepingFox } from './sleeping-fox';
import { toucan } from './toucan';

/** Scene lookup by id. Each scene file is imported here as it is added. */
export const SCENES: Record<string, Scene> = Object.fromEntries(
  [hotAirBalloon, rubberDuck, goldfishBowl, recordPlayer, lighthouseAtDusk, sleepingFox, toucan, desertCactus, paperBoat, brooklynBridge, birthdayCake, coralReef, bentoBox].map((s) => [s.id, s]),
);
