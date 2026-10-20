import { hashStr } from '../core/rng';

export function isUnlocked(id: string, manifest: string[], cleared: Set<string>): boolean {
  const i = manifest.indexOf(id);
  if (i < 0) return false;
  return i === 0 || cleared.has(manifest[i - 1]);
}

/** First unlocked, uncleared scene; the last scene if all are cleared. Ids not in the manifest are ignored. */
export function nextScene(manifest: string[], cleared: Set<string>): string {
  const next = manifest.find((id) => !cleared.has(id) && isUnlocked(id, manifest, cleared));
  return next ?? manifest[manifest.length - 1];
}

/** Stable pick for a date from cleared scenes (manifest order) plus the next scene. */
export function dailyPick(date: string, manifest: string[], cleared: Set<string>): string {
  const next = nextScene(manifest, cleared);
  const pool = manifest.filter((id) => cleared.has(id) || id === next);
  return pool[hashStr('crumb' + date) % pool.length];
}

export interface DailyChoice { date: string; id: string }

/** The day's scene: the stored choice while its date matches and its scene still exists, else a fresh pick. */
export function dailyFor(date: string, manifest: string[], cleared: Set<string>, stored: DailyChoice | null | undefined): DailyChoice {
  if (stored && stored.date === date && manifest.includes(stored.id)) return stored;
  return { date, id: dailyPick(date, manifest, cleared) };
}

export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
