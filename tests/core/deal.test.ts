import { describe, expect, test } from 'bun:test';
import { parseArt, sceneLevel } from '../../src/core/board';
import { deal, replayLine } from '../../src/core/deal';
import { exposedMask } from '../../src/core/path';
import { stepSlots } from '../../src/core/step';
import type { Level, Scene } from '../../src/core/types';
import { bentoBox } from '../../src/scenes/bento-box';
import { median } from '../../scripts/checks';
import { bridge, d20, upscale } from '../fixtures/proto';

const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);
const SLOW = 30_000; // 200-seed sweeps take a few seconds; bun's default timeout is 5s

describe.each([
  ['bridge', sceneLevel(bridge)],
  ['d20', sceneLevel(d20)],
])('deal on %s', (_name, level: Level) => {
  const board = parseArt(level);

  test('replaying the recorded line clears the board for seeds 1..200', () => {
    const failed = SEEDS.filter((s) => !replayLine(level, board, deal(level, board, s)));
    expect(failed).toEqual([]);
  }, SLOW);

  test('the same seed deals identical lanes and line', () => {
    expect(deal(level, board, 7)).toEqual(deal(level, board, 7));
  });

  test('line has one entry per squad and matches lane lengths', () => {
    const d = deal(level, board, 3);
    const squads = d.lanes.reduce((a, l) => a + l.length, 0);
    expect(d.line.length).toBe(squads);
    d.lanes.forEach((l, k) => expect(d.line.filter((x) => x === k).length).toBe(l.length));
  });

  test('caps per colour sum to that colour cell count', () => {
    for (const s of [1, 2, 3, 50, 199]) {
      const d = deal(level, board, s);
      const caps = board.colors.map(() => 0);
      for (const lane of d.lanes) for (const sq of lane) {
        caps[sq.color] += sq.cap;
        expect(sq.total).toBe(sq.cap);
      }
      const cells = board.colors.map((_, c) => board.grid.filter((v) => v === c).length);
      expect(caps).toEqual(cells);
    }
  });

  test('deal does not mutate the board grid', () => {
    const before = board.grid.slice();
    deal(level, board, 11);
    expect(board.grid).toEqual(before);
  });
});

describe('deal under hostile params', () => {
  test('wait 0.99 with 3 slots never throws and still solves', () => {
    for (const scene of [bridge, d20]) {
      const level: Level = { ...sceneLevel(scene), wait: 0.99, slots: 3 };
      const board = parseArt(level);
      for (const s of SEEDS) {
        const d = deal(level, board, s);
        expect(replayLine(level, board, d)).toBe(true);
      }
    }
  }, SLOW);

  test('a single slot still deals a solvable line', () => {
    const level: Level = { ...sceneLevel(d20), wait: 0.99, slots: 1 };
    const board = parseArt(level);
    for (const s of [1, 2, 3, 4, 5]) expect(replayLine(level, board, deal(level, board, s))).toBe(true);
  });
});

describe('waitSlack', () => {
  const hard = (scene: Scene): Level => ({ ...sceneLevel(scene), waitSlack: 1, wait: 0.9, slots: 3 });

  test.each([['d20', d20], ['bento', bentoBox]])('waitSlack 1 on %s replays to a win for seeds 1..200', (_n, scene) => {
    const level = hard(scene);
    const board = parseArt(level);
    const failed = SEEDS.filter((s) => !replayLine(level, board, deal(level, board, s)));
    expect(failed).toEqual([]);
  }, SLOW);

  test('waitSlack 1 lets the first squad of a 2-slot deal wait on a hidden colour', () => {
    const level: Level = { ...hard(d20), slots: 2 };
    const board = parseArt(level);
    const exp = exposedMask(board.grid, board.W, board.H);
    const exposed = new Set(board.grid.filter((v, i) => v >= 0 && exp[i]));
    const firstHidden = (lv: Level) => SEEDS.slice(0, 50).filter((s) => {
      const d = deal(lv, board, s);
      return !exposed.has(d.lanes[d.line[0]][0].color);
    }).length;
    expect(firstHidden({ ...level, waitSlack: undefined })).toBe(0);
    expect(firstHidden(level)).toBeGreaterThan(0);
  });

  test('sceneLevel carries waitSlack through', () => {
    expect(sceneLevel({ ...d20, waitSlack: 1 }).waitSlack).toBe(1);
    expect('waitSlack' in sceneLevel(d20)).toBe(false);
  });
});

describe('replayLine', () => {
  test('an invalid line fails rather than throwing', () => {
    const level = sceneLevel(d20);
    const board = parseArt(level);
    const d = deal(level, board, 1);
    const bad = d.line.map(() => d.lanes.length); // lane index out of range
    expect(replayLine(level, board, { lanes: d.lanes, line: bad })).toBe(false);
  });

  test('replay does not consume the deal lanes', () => {
    const level = sceneLevel(bridge);
    const board = parseArt(level);
    const d = deal(level, board, 5);
    const copy = JSON.parse(JSON.stringify(d));
    replayLine(level, board, d);
    expect(d).toEqual(copy);
  });
});

describe('deal regression snapshot', () => {
  // Hashes of JSON(deal) under the bottom-nest rule; dealing results must not change without a rule change.
  const EXPECTED: Record<string, string[]> = {
    bridge: ['8846367228725212653', '2571254804605134906', '9606635892004353818', '10723694866415574192', '16232942428313124052'],
    d20: ['18147549956487942444', '14476679805938065525', '8842219575004843854', '5472506450005942546', '7126568951273321671'],
    up56: ['5806449731117554373', '2185038578748239760', '17956440163516032889', '11292728261112496968', '8930184986821178255'],
  };
  const levels: Record<string, Level> = {
    bridge: sceneLevel(bridge),
    d20: sceneLevel(d20),
    up56: { ...sceneLevel(bridge), ...upscale(bridge, 56) },
  };
  test.each(Object.keys(EXPECTED))('%s deals are unchanged for seeds 1,2,3,7,42', (name) => {
    const board = parseArt(levels[name]);
    const got = [1, 2, 3, 7, 42].map((s) => Bun.hash(JSON.stringify(deal(levels[name], board, s))).toString());
    expect(got).toEqual(EXPECTED[name]);
  });
});

describe('perf', () => {
  test('median deal on a 56-wide bridge is under 30ms', () => {
    const level: Level = { ...sceneLevel(bridge), ...upscale(bridge, 56) };
    const board = parseArt(level);
    deal(level, board, 99); // warm-up: JIT and geometry caches
    const times: number[] = [];
    for (let s = 1; s <= 20; s++) {
      const t0 = performance.now();
      deal(level, board, s);
      times.push(performance.now() - t0);
    }
    expect(median(times)).toBeLessThan(30);
  });

  test('median stepSlots tick with 4 occupied slots on a 56x56 board is under 2ms', () => {
    const art = upscale(bridge, 56);
    const level: Level = { ...sceneLevel(bridge), ...art };
    const board = parseArt(level);
    const { W, H } = board;
    const times: number[] = [];
    for (let n = 0; n < 40; n++) {
      const g = board.grid.slice();
      const mk = (cap: number) => Array.from({ length: 4 }, (_, k) => ({ color: (k + n) % board.colors.length, cap, total: cap }));
      // open up a large region first so the tick has real search work to do
      const warm = mk(400);
      for (let t = 0; t < 400; t++) stepSlots(g, W, H, warm);
      const slots = mk(50);
      const t0 = performance.now();
      stepSlots(g, W, H, slots);
      times.push(performance.now() - t0);
    }
    expect(median(times)).toBeLessThan(2);
  });
});
