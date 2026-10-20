// End-to-end regression: play the recorded winning line through the real game state (tapLane/tick),
// with detours — an off-line tap that is undone, and save -> JSON -> restore both between taps and
// mid-eat — and check the board still clears.
import { describe, expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { deal } from '../../src/core/deal';
import { mulberry } from '../../src/core/rng';
import type { Band, Level, Meta } from '../../src/core/types';
import { randomLevel } from '../../src/random/level';
import { SCENES } from '../../src/scenes';
import { MANIFEST } from '../../src/scenes/manifest';
import { type Game, newGame, status, tapLane, tick, undo } from '../../src/state/game';
import { fromRun, toRun } from '../../src/state/save';

const settle = (g: Game): void => { while (tick(g)); };
const roundtrip = (g: Game, seed: number): Game | null => fromRun(JSON.parse(JSON.stringify(toRun(g, seed))), SCENES);

/** Taps a random lane off the line, lets it eat a little, then undoes it. */
function detour(g: Game, rng: () => number): string | null {
  const open = g.lanes.map((l, k) => (l.length ? k : -1)).filter((k) => k >= 0);
  if (tapLane(g, open[Math.floor(rng() * open.length)]) !== 'ok') return null;
  for (let k = 0; k < 5; k++) tick(g);
  if (!undo(g)) return `undo failed at tap ${g.taps}`;
  settle(g);
  return null;
}

/** Plays one deal to the end; returns why it failed, or null when it was won. */
function play(meta: Meta, level: Level, seed: number, rng: () => number): string | null {
  const line = deal(level, parseArt(level), seed).line;
  let g = newGame(meta, level, seed);
  while (status(g) === 'playing' && g.taps < line.length) {
    settle(g);
    const x = rng();
    if (x < 0.15 && g.undos > 0) {
      const err = detour(g, rng);
      if (err) return err;
    } else if (x < 0.3) {
      const back = roundtrip(g, seed);
      if (!back) return `restore failed at tap ${g.taps}`;
      g = back;
      settle(g);
    }
    if (tapLane(g, line[g.taps]) !== 'ok') return `tap ${g.taps} refused`;
    if (rng() < 0.1) {
      for (let k = 0; k < 3; k++) tick(g);
      const back = roundtrip(g, seed);
      if (!back) return `mid-eat restore failed at tap ${g.taps}`;
      g = back;
    }
  }
  settle(g);
  return status(g) === 'won' ? null : `not won: ${g.remaining} left after ${g.taps}/${line.length} taps`;
}

const BANDS: Band[] = ['easy', 'medium', 'hard'];

describe('winning line survives undo detours and save/restore', () => {
  for (const band of BANDS) {
    const ids = MANIFEST.filter((id) => SCENES[id].band === band);
    const sample = [ids[0], ids[Math.floor(ids.length / 2)], ids[ids.length - 1]];
    for (const id of sample) {
      test(`${band}: ${id}`, () => {
        const rng = mulberry(id.length * 97);
        for (const seed of [1009, 2018]) expect(play({ kind: 'campaign', id }, sceneLevel(SCENES[id]), seed, rng)).toBeNull();
      });
    }
    test(`${band}: random levels`, () => {
      const rng = mulberry(7);
      for (const s of [31, 62]) {
        expect(play({ kind: 'random', band, seed: s }, randomLevel(band, s), s, rng)).toBeNull();
      }
    });
  }
});
