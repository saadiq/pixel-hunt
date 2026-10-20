import { describe, expect, test } from 'bun:test';
import { measureChoices } from '../../scripts/choices';
import { SCENES } from '../../src/scenes';

describe('measureChoices', () => {
  test('a teaching board has no taps that matter', () => {
    const c = measureChoices(SCENES['hot-air-balloon'], 2);
    expect(c.choice).toBe(0);
    expect(c.trap).toBe(0);
    expect(c.mindless).toBeGreaterThan(0.75);
  });

  test('a hard board has many wrong taps that lose, and punishes mindless tapping', () => {
    const c = measureChoices(SCENES['rose-window'], 3);
    expect(c.decisions).toBeGreaterThan(10);
    expect(c.trap).toBeLessThanOrEqual(c.choice);
    expect(c.mindless).toBeLessThan(0.5);
  }, 60_000);

  test('is deterministic', () => {
    expect(measureChoices(SCENES['goldfish-bowl'], 1)).toEqual(measureChoices(SCENES['goldfish-bowl'], 1));
  }, 60_000);
});
