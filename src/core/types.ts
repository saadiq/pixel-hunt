export type Band = 'easy' | 'medium' | 'hard';
export interface Params {
  slots: number; lanes: number; chunk: [number, number]; wait: number;
  /** Waiting squads may be dealt while fewer than `slots - waitSlack` slots are in use. Default 2. */
  waitSlack?: number;
}
export interface Art { rows: string[]; pal: Record<string, string> }
export interface Scene extends Art, Params { id: string; name: string; blurb: string; band: Band }
export interface Level extends Art, Params { key: string; name: string; band: Band }
export interface Board { W: number; H: number; grid: Int8Array; colors: string[] }
export interface Squad { color: number; cap: number; total: number }
export type Lanes = Squad[][];
export type Slots = (Squad | null)[];
export interface Deal { lanes: Lanes; line: number[] } // line[k] = lane to tap for the k-th squad
export type Meta =
  | { kind: 'campaign'; id: string }
  | { kind: 'random'; band: Band; seed: number }
  | { kind: 'daily'; date: string; id: string };
export type BiteFn = (slot: number, cell: number, color: number, dist: Int16Array) => void;
