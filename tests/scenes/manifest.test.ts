import { describe, expect, test } from 'bun:test';
import { SCENES } from '../../src/scenes';
import { MANIFEST } from '../../src/scenes/manifest';

describe('scene manifest', () => {
  test('every id is unique and names a registered scene with that id', () => {
    expect(new Set(MANIFEST).size).toBe(MANIFEST.length);
    for (const id of MANIFEST) {
      expect(Object.hasOwn(SCENES, id)).toBe(true);
      expect(SCENES[id].id).toBe(id);
    }
  });

  test('bands run easy, then medium, then hard', () => {
    const rank = { easy: 0, medium: 1, hard: 2 };
    const ranks = MANIFEST.map((id) => rank[SCENES[id].band]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('every registered scene is in the manifest', () => {
    for (const id of Object.keys(SCENES)) expect(MANIFEST).toContain(id);
  });
});
