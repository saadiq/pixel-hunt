/// <reference types="vite/client" />
// Boot: load the save, resume a saved board if it still fits a scene, else start the next campaign scene.
import { SCENES } from './scenes';
import { MANIFEST } from './scenes/manifest';
import { nextScene } from './state/progress';
import { fromRun, load } from './state/save';
import { current, init, resume, start } from './ui/controller';

const save = load();
init(save);
const game = save.run ? fromRun(save.run, SCENES) : null;
if (game && save.run && Number.isFinite(save.run.seed)) {
  resume(game, save.run.seed);
} else {
  save.run = null;
  start({ kind: 'campaign', id: nextScene(MANIFEST, new Set(save.cleared)) });
}

if (import.meta.env.DEV) (window as unknown as { __game: typeof current }).__game = current;
