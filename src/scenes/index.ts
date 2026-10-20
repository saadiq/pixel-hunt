import type { Scene } from '../core/types';
import { peacock } from './peacock';
import { roseWindow } from './rose-window';
import { arcadeCabinet } from './arcade-cabinet';
import { bentoBox } from './bento-box';
import { birthdayCake } from './birthday-cake';
import { brooklynBridge } from './brooklyn-bridge';
import { campfire } from './campfire';
import { coralReef } from './coral-reef';
import { desertCactus } from './desert-cactus';
import { goldfishBowl } from './goldfish-bowl';
import { hotAirBalloon } from './hot-air-balloon';
import { iceCreamTruck } from './ice-cream-truck';
import { koiPond } from './koi-pond';
import { lighthouseAtDusk } from './lighthouse-at-dusk';
import { mountFuji } from './mount-fuji';
import { nightOwl } from './night-owl';
import { paperBoat } from './paper-boat';
import { recordPlayer } from './record-player';
import { rubberDuck } from './rubber-duck';
import { sleepingFox } from './sleeping-fox';
import { toucan } from './toucan';
import { typewriter } from './typewriter';
import { veniceCanal } from './venice-canal';

/** Scene lookup by id. Each scene file is imported here as it is added. */
export const SCENES: Record<string, Scene> = Object.fromEntries(
  [hotAirBalloon, rubberDuck, goldfishBowl, recordPlayer, lighthouseAtDusk, sleepingFox, toucan, desertCactus, paperBoat, iceCreamTruck, brooklynBridge, typewriter, coralReef, veniceCanal, mountFuji, arcadeCabinet, birthdayCake, nightOwl, koiPond, campfire, bentoBox, roseWindow, peacock].map((s) => [s.id, s]),
);
