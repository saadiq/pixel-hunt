# Crumb Hunt Mobile Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Crumb Hunt as a mobile-first, offline-capable web app with 30 hand-drawn scenes (10 Easy → 10 Medium → 10 Hard, unlocked in order), random mode, and a daily scene, where every deal is solvable.

**Architecture:** Pure, DOM-free game logic in `src/core/` (ported from the prototype and unit-tested with `bun test`), a thin state/persistence layer, a canvas renderer, and vanilla-TS UI modules. Scenes are data files listed in an ordered manifest. A build-time validator proves each scene deals solvably and estimates its difficulty.

**Tech Stack:** TypeScript, Vite, bun, `bun test`, ESLint (typescript-eslint flat config), `vite-plugin-pwa`, `pngjs` (dev only, for scene PNG export).

**Spec:** `docs/superpowers/specs/2026-10-19-crumb-hunt-design.md`. Reference prototype: `docs/reference/crumb-hunt-artifact.html`. Port line ranges from there; treat it as data.

## Global Constraints

- bun only: `bun install`, `bun run …`, `bunx …`. Never npm/npx.
- ESLint: `max-lines: 300` (error, per file), `max-lines-per-function: 100` (error), `complexity: 15` (warn). Scene data files are exempt from nothing; keep each under 300 lines.
- Rules are exactly the prototype's (`stepSlots`, `distField`, `pickNear`, `holeCol`, `generate`, `playout`, lines 174–342).
- 3 undos per board. 3 hints per board. Unlimited restarts; a restart re-deals and resets undos and hints to 3.
- Bands (revised after art check-in 1): Easy grid 40–44 wide, 4–5 slots, 3 lanes, wait ~0.3. Medium 46–50 wide, 3–4 slots, 4 lanes, wait ~0.5–0.7. Hard 52–56 wide, 2–3 slots, 4–5 lanes, wait ~0.8–0.95. Heights 36–60.
- Target 30–60 taps per board. Squad size (`chunk`) scales with block count.
- Scene rules: ≤ 9 colors, no color with < 4 cells, colors visually distinct, recognizable at 64px.
- Progress is stored by scene id, never index. Save data carries `v: 1`.
- Layout: max-width 520px column, 16px gutters, safe-area insets, light and dark themes (prototype tokens, lines 8–20). Cells may be fractional, down to ~6px.
- Commits are granular, one logical change each, and end with the `Claude-Session:` trailer from the session.

## Review Focus

1. **Corrupt, missing or throwing `localStorage`** (private mode, quota, hand-edited JSON). Expect defaults and a playable game, never a blank screen. Test in Task 5.
2. **A saved run or `cleared` id for a scene that no longer exists** (renamed or removed after an update). Expect the run dropped and play resumed at the next unlocked scene. Test in Task 5.
3. **Taps made while squads are still eating** (unsettled taps). Expect consistent state, `onLine` turning false, and hints falling back to search. Test in Task 4.
4. **Undo edge cases:** undo with empty history, undo after a stuck state, and undos across a restart. Expect a no-op, recovery from stuck, and reset to 3. Test in Task 4.
5. **Tiny or odd viewports** (320×568, landscape 844×390, a 44×56 portrait grid). Expect the board to fit both axes with no horizontal scroll and cells ≥ 6px where possible. Test in Task 8 (`fitBoard`).

## Shared Types (`src/core/types.ts`, created in Task 1)

```ts
export type Band = 'easy' | 'medium' | 'hard';
export interface Params { slots: number; lanes: number; chunk: [number, number]; wait: number }
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
```

---

### Task 1: Scaffold and core grid/pathing

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html` (placeholder), `src/main.ts` (placeholder), `src/core/types.ts`, `src/core/rng.ts`, `src/core/board.ts`, `src/core/path.ts`
- Test: `tests/core/path.test.ts`, `tests/fixtures/proto.ts`

**Interfaces:**
- Produces: `mulberry(seed: number): () => number`, `hashStr(s: string): number` (rng.ts, prototype 178, 559). `parseArt(a: Art): Board` (board.ts, prototype 180). In path.ts: `distField(grid, W, H, holeCol): Int16Array`, `minAround(d, i, W): number`, `pickNear(grid, W, H, color, d): number`, `tracePath(d, i, W, H): number[]`, `exposedMask(grid, W, H): Uint8Array`, `holeCol(slot, nSlots, W): number`.
- Also produces `sceneLevel(s: Scene): Level` (key = id) in board.ts.
- Fixtures: `tests/fixtures/proto.ts` exports `bridge: Scene` (band medium), `d20: Scene` (band hard) (rows/pal copied from prototype line 173, params from lines 530–531), and `upscale(a: Art, W: number): Art` (nearest-neighbour scale, for a 40-wide perf fixture).

- [ ] **Step 1:** `bun init`, then add dev deps `vite typescript eslint typescript-eslint @types/bun`. Scripts: `dev`, `build`, `test` (`bun test`), `lint` (`bunx eslint .`). Configure ESLint with the Global Constraints values.
- [ ] **Step 2: Write failing tests** in `tests/core/path.test.ts`:
  - `parseArt(bridge)` gives `W===28`, `H===28`, and `colors.length===Object.keys(bridge.pal).length`.
  - On a 3×3 all-filled grid, `exposedMask` marks the 8 border cells and not the centre.
  - With the centre's left neighbour set to `-1`, the centre becomes exposed (tunnel rule).
  - `holeCol(0,4,28)===3`, `holeCol(3,4,28)===24`.
  - `pickNear` returns the cell of the requested colour with the smallest `minAround`, or `-1` when unreachable.
- [ ] **Step 3:** Run `bun test tests/core/path.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 4:** Port the functions with types. Keep the `geo` cache.
- [ ] **Step 5:** Run `bun test` and `bun run lint`. Expected: PASS, no lint errors.
- [ ] **Step 6: Commit** the scaffold and core pathing as two commits (`chore: scaffold …`, `feat(core): grid parsing and pathing`).

### Task 2: Simulation step and solvable dealer

**Files:**
- Create: `src/core/step.ts`, `src/core/deal.ts`
- Test: `tests/core/deal.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `stepSlots(grid: Int8Array, W: number, H: number, slots: Slots, onBite?: BiteFn): boolean` (prototype 261). `deal(level: Level, board: Board, seed: number): Deal` never throws. `replayLine(level: Level, board: Board, deal: Deal): boolean` taps `line` in order, settling (`while(stepSlots)`) before each tap, and returns true if the board clears.

- [ ] **Step 1: Write failing tests:**
  - For seeds 1..200 on `bridge` and `d20`, `replayLine(level, board, deal(level, board, seed))` is true.
  - `deal` with the same seed returns identical lanes.
  - The sum of `cap` per colour across all lanes equals that colour's cell count.
  - `deal(level, board, s)` for a level with `wait: 0.99, slots: 3` never throws (seeds 1..200).
  - Perf: median `deal` time on `upscale(bridge, 40)` over 20 seeds is < 60ms.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Port `stepSlots` and `generate` (prototype 261–320). `generate` records, for each squad pushed to `seq`, which lane it lands in. Because lanes are FIFO and filled in `seq` order, `line` is that lane list. `deal` tries `generate` up to 25 times with `mulberry(seed)`, then `{...level, wait: 0}`, then a safe dealer: same loop, but always pick a currently exposed colour and cap at its exposed count. The safe dealer can't stall, because some block is always exposed while any remain.
- [ ] **Step 4:** Run. Expected: PASS. If perf fails, cache `distField` per (slot, grid version) inside the settle loop.
- [ ] **Step 5: Commit** `feat(core): solvable dealer with recorded winning line`.

### Task 3: Playout and hints

**Files:**
- Create: `src/core/playout.ts`, `src/core/hint.ts`
- Test: `tests/core/hint.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces: `playout(grid, W, H, slots, lanes, rng, first: number | null): boolean` (prototype 322). `lineHint(onLine: boolean, idle: boolean, line: number[], taps: number): number | null` returns `line[taps]` when `onLine && idle`, else null. `searchHint(snap: {grid, W, H, slots, lanes}, opts: {budgetMs: number; rng: () => number}): Promise<number | null>` is the prototype's chunked search (871–892): `setTimeout(0)` slices of 24ms, stopping at min 10 runs per lane, or 1.4s with ≥3 runs, or 3s. It returns the best lane, or null if no wins.

- [ ] **Step 1: Write failing tests:**
  - `lineHint(true, true, [2,0,1], 1) === 0`; `lineHint(false, true, …) === null`; `lineHint(true, false, …) === null`.
  - From a fresh `bridge` deal, `searchHint` resolves to a lane index with squads.
  - When only one lane is non-empty, it resolves to that lane.
  - `playout(…, first)` from the start of a fresh deal returns true for at least one seed in 1..20, so the policy isn't broken.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. PASS.
- [ ] **Step 5: Commit** `feat(core): playout and line-aware hints`.

### Task 4: Game state (taps, ticks, undo, end states)

**Files:**
- Create: `src/state/game.ts`
- Test: `tests/state/game.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
```ts
export interface Game {
  meta: Meta; level: Level; board: Board; grid: Int8Array; lanes: Lanes; slots: Slots;
  hist: Snapshot[]; undos: number; hints: number; usedUndo: number; usedHint: number;
  taps: number; remaining: number; stuck: boolean; idle: boolean; line: number[]; onLine: boolean;
}
export interface Snapshot { grid: Int8Array; lanes: Lanes; slots: Slots; remaining: number; taps: number; onLine: boolean }
export function newGame(meta: Meta, level: Level, seed: number): Game;
export function tapLane(g: Game, lane: number): 'ok' | 'full' | 'empty';
export function tick(g: Game, onBite?: BiteFn): boolean;          // one stepSlots; sets idle = !ate, stuck
export function undo(g: Game): boolean;
export function status(g: Game): 'playing' | 'won' | 'stuck';
```
  `tapLane` snapshots first (history capped at 40). It sets `onLine = onLine && idle && line[taps] === lane` before incrementing `taps`, then sets `idle = false`. `stuck = !ate && slots.every(Boolean) && remaining > 0`. `undo` requires `undos > 0 && hist.length`, restores the snapshot, clears `stuck`, and sets `idle = true`. A restart is `newGame` again; there is no separate function.

- [ ] **Step 1: Write failing tests:**
  - Tapping `line` with ticks to idle between taps wins, and `onLine` stays true throughout.
  - Tapping a lane while not idle sets `onLine` false (Review Focus 3).
  - Spam-tapping until slots are full returns `'full'`, the grid still conserves blocks (`remaining` equals the count of `grid >= 0`), and ticks still progress.
  - `undo` with empty history returns false and `undos` stays 3. After 3 undos, a 4th returns false (Review Focus 4).
  - Force stuck (fill slots with unreachable colours from a crafted 5×5 level): `status==='stuck'`, then `undo` brings it back to `'playing'`.
  - `newGame` on the same meta resets `undos` and `hints` to 3.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. PASS.
- [ ] **Step 5: Commit** `feat(state): game state with undo and end detection`.

### Task 5: Scenes manifest, progression and persistence

**Files:**
- Create: `src/scenes/manifest.ts`, `src/scenes/index.ts`, `src/state/progress.ts`, `src/state/save.ts`
- Test: `tests/state/progress.test.ts`, `tests/state/save.test.ts`

**Interfaces:**
- Produces: `MANIFEST: string[]` (ordered ids). `SCENES: Record<string, Scene>` (index.ts imports each scene file). `isUnlocked(id, manifest, cleared: Set<string>): boolean` is true if the scene is first or its predecessor is cleared. `nextScene(manifest, cleared): string` returns the first unlocked, uncleared scene, or the last scene if all are cleared. `dailyPick(date: string, manifest, cleared): string` uses the pool of cleared ids plus `nextScene`, indexed by `hashStr('crumb'+date) % pool.length`. `todayKey(d?: Date): string` (prototype 558).
- `save.ts`:
```ts
export interface SaveV1 { v: 1; cleared: string[]; wins: Record<Band, number>; daily: string | null;
  prefs: { sound: boolean; fast: boolean; band: Band }; run: SavedRun | null }
export interface SavedRun { meta: Meta; seed: number; grid: number[]; lanes: Lanes; slots: Slots;
  hist: SavedSnapshot[]; undos: number; hints: number; usedUndo: number; usedHint: number;
  taps: number; line: number[]; onLine: boolean }
export function load(storage?: Storage): SaveV1;
export function store(s: SaveV1, storage?: Storage): void;
export function toRun(g: Game, seed: number): SavedRun;
export function fromRun(r: SavedRun, scenes: Record<string, Scene>): Game | null;
```
  The key is `crumbhunt.v1`. `load` swallows every throw or parse error and returns defaults. `fromRun` returns null for unknown campaign or daily ids. For random metas it rebuilds the level via `randomLevel` (Task 10). Until then it returns null for random runs, and Task 10 fills that in.

- [ ] **Step 1: Write failing tests:**
  - Unlock: with `MANIFEST=['a','b','c']` and `cleared={'a'}`, `b` is unlocked and `c` is not. If `x` is inserted between `a` and `b`, `x` is unlocked and `b` is not.
  - `dailyPick` is stable for a date, and always in the pool.
  - `load` with a throwing storage, `'{bad json'`, `{v: 99}` or `null` returns defaults (Review Focus 1).
  - `fromRun` with `meta.id='gone'` returns null. `load` keeps unknown ids in `cleared` (harmless), and `nextScene(['a','b'], {'gone','a'})==='b'` (Review Focus 2).
  - `toRun`/`fromRun` round-trip keeps grid, lanes, slots, undos, hints, taps and onLine.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement. The manifest starts empty and fills from Task 7.
- [ ] **Step 4:** Run. PASS.
- [ ] **Step 5: Commit** `feat(state): progression, daily pick, versioned save`.

### Task 6: Scene validator and PNG export

**Files:**
- Create: `scripts/validate.ts`, `scripts/checks.ts`, `scripts/targets.ts`, `scripts/export-pngs.ts`
- Test: `tests/scripts/checks.test.ts`

**Interfaces:**
- Produces: `checkStructure(s: Scene): string[]` (errors), `checkColors(s: Scene): string[]` (errors: >9 colours, a colour <4 cells, any pair with CIE76 ΔE < 10), `checkDeals(s: Scene, n: number): { failures: number; medianTaps: number; medianMs: number }`, `estimateWinRate(s: Scene, n: number): number` (`playout(…, null)` from fresh deals). `TARGETS: Record<Band, { width: [number, number]; winRate: [number, number]; taps: [number, number] }>`, with initial values easy `[28,32]`, `[0.55,1]`, medium `[32,36]`, `[0.25,0.6]`, hard `[36,40]`, `[0,0.3]`, and taps `[30,60]` for every band. Tune the win-rate ranges once real scenes exist so the bands separate.
- `bun run validate [--quick] [id…]`: 500 deals (50 with `--quick`) plus 200 playouts per scene. It prints a table (id, band, W×H, colours, taps, ms, win rate, flags). It exits 1 on any structure, colour or deal failure. Win-rate and tap-count misses print as `WARN`.
- `bun run export-pngs [id…]`: writes `out/scenes/<id>.png` at 8× and `out/scenes/<id>-thumb.png` at 64px, using `pngjs`. These are for eyeballing art. Add `out/` to `.gitignore`.

- [ ] **Step 1: Write failing tests:** `checkStructure` flags ragged rows and unknown chars. `checkColors` flags a 3-cell colour and two near-identical colours (`#ff0000` vs `#fe0101`). `checkDeals(bridgeAsScene, 20).failures === 0`.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests, plus `bun run validate` with an empty manifest. Expected: PASS, and an empty table with exit 0.
- [ ] **Step 5: Commit** `feat(tools): scene validator and PNG export`.

### Task 7: Scene preview page and first 3 scenes — STOP for user review

**Files:**
- Create: `preview.html`, `src/preview.ts`, `src/render/thumb.ts`, `src/scenes/hot-air-balloon.ts`, `src/scenes/brooklyn-bridge.ts`, `src/scenes/coral-reef.ts`
- Modify: `src/scenes/manifest.ts`, `src/scenes/index.ts`, `vite.config.ts` (multi-page input in dev only, so `preview.html` is excluded from the production build)

**Interfaces:**
- Produces: `drawThumb(c: HTMLCanvasElement, art: Art, px: number): void` (prototype 834).
- The preview page lists every manifest scene: full-size art at 8px/cell, a 64px thumb, and the validator stats (computed in-browser with `checkColors` + `checkDeals(s, 20)`).

- [ ] **Step 1:** Draw the 3 scenes as `Scene` files. Hot Air Balloon is Easy, ~30×30, 5 slots/3 lanes. Brooklyn Bridge is Medium: redraw the prototype's dusk scene at ~34×34 with more cable, arch and water detail, 4/4. Coral Reef is Hard, ~38×38 with nested outlined shapes, 3–4 slots/4–5 lanes. Each needs depth (sky or water, a subject, a foreground).
- [ ] **Step 2:** Run `bun run validate` and fix every error. Tune `chunk`/`wait` until taps are within 30–60, and `Read` the PNGs from `bun run export-pngs`, revising until each reads as its subject at thumb size.
- [ ] **Step 3:** Run `bun run dev` and open `/preview.html`. All 3 render.
- [ ] **Step 4: Commit** the preview page, then each scene, as separate commits.
- [ ] **Step 5: STOP.** Show the user the 3 scenes (full and thumb PNGs) and the validator table. Wait for their feedback, and record any art direction they give in `docs/superpowers/specs/2026-10-19-crumb-hunt-design.md` under "Art sign-off" before Task 11.

### Task 7R: Higher-resolution art pipeline and redrawn check-in scenes — STOP for user review

Added after art check-in 1 was rejected as too low-resolution. Read the spec sections "Grid sizes and difficulty bands (revised…)", "Art direction" and "How scenes are made (revised)".

**Files:**
- Create: `scenes/art/hot-air-balloon.svg`, `scenes/art/brooklyn-bridge.svg`, `scenes/art/coral-reef.svg`, `scripts/build-scenes.ts`, `scripts/raster.ts`, `src/render/cube.ts`
- Modify: `scripts/targets.ts` (band widths and heights), `scripts/checks.ts` (height range 36–60), `scripts/export-pngs.ts` and `src/render/thumb.ts` (draw cubes), `src/preview.ts`, `package.json` (`build-scenes` script), regenerate `src/scenes/hot-air-balloon.ts`, `brooklyn-bridge.ts`, `coral-reef.ts`
- Test: `tests/scripts/raster.test.ts`

**Interfaces:**
- `rasterize(svg: string, W: number, H: number, opts?: { ss?: number }): Art` in `scripts/raster.ts`. It renders the SVG at `W*ss × H*ss` (default `ss = 8`) with `@resvg/resvg-js`, and for each cell takes the most common colour among its `ss×ss` samples after snapping every sample to the nearest colour in the SVG's palette. The palette is the set of distinct `fill`/`stroke` hex colours in the SVG, plus the background colour. Fully transparent samples count as the background colour. Palette chars are assigned `a, b, c, …` in order of first appearance.
- Scene SVG metadata is a `<metadata>` element holding JSON: `{ id, name, blurb, band, W, H, slots, lanes, chunk, wait, bg }`. `viewBox` is `0 0 W H`, so one SVG unit equals one cell.
- `build-scenes [id…]` writes `src/scenes/<id>.ts` exporting a `Scene` with a "generated by build-scenes, edit the SVG" header comment.
- `drawCube(ctx, x, y, s, hex)` in `src/render/cube.ts` draws a raised cube: an inset gap of `max(0.5, s*0.08)`, a lighter top-left bevel and a darker bottom-right bevel, matching the reference games. It is used by `thumb.ts`. `export-pngs.ts` uses the same geometry (Node port or shared pure math).
- `TARGETS` widths: easy `[40,44]`, medium `[46,50]`, hard `[52,56]`. Height for every band: `[36,60]`. Taps stay at `[30,60]`.

- [ ] **Step 1: Write failing tests** in `tests/scripts/raster.test.ts`:
  - A 4×4 SVG (white background, black `rect` at x=1 y=1 width=2 height=2) rasterises to rows `['aaaa','abba','abba','aaaa']` with `pal.a` white and `pal.b` black.
  - Anti-aliased edges never introduce a colour outside the palette: a circle SVG yields exactly 2 palette entries.
  - Metadata parsing returns the JSON fields.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement `raster.ts`, `build-scenes.ts` and the cube renderer, and update targets and checks.
- [ ] **Step 4:** Draw the 3 SVGs per the art direction: bold, close-up, outlined, flat fills, ≤ 9 colours. Hot Air Balloon is Easy, ~42×44, 5 slots/3 lanes. Brooklyn Bridge is Medium, ~48×48, a bold close-up of a gothic-arched tower and cables at dusk, 4/4. Coral Reef is Hard, ~54×54, a big outlined clownfish nestled in an anemone, 3–4 slots/4–5 lanes. Strokes must be ≥ 1 unit wide so outlines survive rasterising.
- [ ] **Step 5:** Run `build-scenes`, then `validate`, then `export-pngs`, and `Read` the PNGs. Iterate on the SVGs until each reads instantly as its subject at the 64px thumb and looks comparable to the reference games' scenes. Tune `chunk` so taps are 30–60.
- [ ] **Step 6:** Run `bun test`, `bun run lint` and `bunx tsc --noEmit`. All clean.
- [ ] **Step 7: Commit** separately: the pipeline, the cube renderer, then one commit per scene.
- [ ] **Step 8: STOP** for the user's second art check-in. The report lists the PNG paths and the validator table.

### Task 7S: Lock in the check-in 2 decisions (glossy cubes, depth metric, bento and cake)

Read the spec's "Check-in 2 + spike result" bullets and the revised band table first. The spike's throwaway code is in `out/spike/` (`render.ts` has `glossRects`, and there are `depth.ts`, `bento.svg` and `cake.svg`). Port from it; don't import it.

**Files:**
- Modify: `src/render/cube.ts` (style B replaces the current cube style), `scripts/export-pngs.ts`, `scripts/checks.ts`, `scripts/targets.ts`, `scripts/validate.ts`, `src/preview.ts`
- Create: `scripts/depth.ts`, `scenes/art/bento-box.svg`, `scenes/art/birthday-cake.svg`, generated `src/scenes/bento-box.ts` and `birthday-cake.ts`
- Modify: `scenes/art/{hot-air-balloon,brooklyn-bridge,coral-reef}.svg` (params, and art only where needed for the depth gate), `src/scenes/manifest.ts`, `src/scenes/index.ts`
- Test: `tests/render/cube.test.ts`, `tests/scripts/depth.test.ts`

**Interfaces:**
- `cubeRects(x, y, s, hex)` now returns style B geometry. The seam is a darker tone of the cube's own colour (no dark grout). There is a top highlight and a soft bottom shade. Cells under 4px still draw flat.
- `enclosureDepth(art: Art): { max: number; avg: number; deep3: number }` in `scripts/depth.ts` (browser-safe). Each cell's depth is the fewest colour changes along a 4-connected path from outside the board, where stepping into a cell of a different colour than the previous cell costs 1 and the first cell entered from outside costs 0. Use a 0-1 BFS. `deep3` is the fraction of cells with depth ≥ 3.
- `TARGETS` win rates: easy `[0.7,1]`, medium `[0.45,0.75]`, hard `[0,0.45]`. New `TARGETS[band].minAvgDepth`: easy 0, medium 0, hard 1.5 (WARN if below). Slot ranges: easy 4–5, medium 3–4, hard 2–3; `checkStructure` errors if slots are outside the band. Taps stay at 30–60.
- `validate` prints `depth` (avg/max) as a column.

- [ ] **Step 1: Write failing tests:**
  - `enclosureDepth` on a 5×5 board of `a` with a 3×3 ring of `b` around a centre `c` gives max 2 and avg `(0*16 + 1*8 + 2*1)/25`.
  - A uniform board gives max 0.
  - `cubeRects` seam colour is darker than, and the same hue family as, the face colour, never the fixed dark grout.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement depth, the style-B cubes, targets, checks and the validate column.
- [ ] **Step 4:** Promote the spike scenes.
  - Bento Box goes to Hard. Use `out/spike/bento.svg`, tidied, at 2–3 slots, with chunk tuned to keep taps ≤ 60.
  - Birthday Cake goes to Medium. Use `out/spike/cake.svg` with **no decorative border** (the user said a border "chokes" it), on a patterned tablecloth background, at 3–4 slots.
  - Re-tune Hot Air Balloon to 4–5 slots and Brooklyn Bridge to 3–4.
  - Coral Reef must meet the Hard depth gate (avg ≥ 1.5). Either redraw it boxed in (e.g. seen through a porthole or in an aquarium frame that belongs to the subject), or, if that hurts the art, move it to Medium and note that in the report.
- [ ] **Step 5:** Run `build-scenes`, then `validate` (full), then `export-pngs`. `Read` every PNG. Every scene must have 0 deal failures and taps of 30–60, and its win rate and depth must be within its band. Iterate params (slots first, then chunk) until they are.
- [ ] **Step 6:** Run `bun test`, lint and tsc. All clean.
- [ ] **Step 7: Commit** separately: cubes, depth/targets, then each scene.

### Task 7P: Dealer and simulation performance at the new grid sizes

**Files:** Modify `src/core/step.ts` and/or `src/core/path.ts`, `tests/core/deal.test.ts`.

- [ ] **Step 1:** Change the perf test to `upscale(bridge, 56)`: median `deal` time over 20 seeds < 80ms in bun on desktop. Add a test that the board-per-tick cost (one `stepSlots` with 4 occupied slots on a 56×56 board) has a median < 2ms.
- [ ] **Step 2:** Run. If it fails, optimise without changing results. For example, `pickNear` can scan only cells adjacent to open cells, and the `distField` per slot can be reused within a tick when the grid hasn't changed. Determinism tests (same seed gives same lanes, all replays win) must still pass unchanged.
- [ ] **Step 3: Commit** `perf(core): fast dealing on 56-wide boards`.

### Task 8: Canvas renderer (board, nest, ants, crumbs)

**Files:**
- Create: `src/render/fit.ts`, `src/render/board.ts`, `src/render/ants.ts`
- Test: `tests/render/fit.test.ts`

**Interfaces:**
- Produces: `fitBoard(stageW, stageH, W, H): { cs: number; T: number; nest: number; CW: number; CH: number }`. It ports prototype 713–723, with fractional `cs` (min 5, never NaN/0) fitting both axes and a thin track (`T = cs*0.6`). `createRenderer(canvas: HTMLCanvasElement): Renderer`, where
```ts
interface Renderer {
  reset(g: Game): void;                 // copy grid to vis, clear ants
  resize(stageW: number, stageH: number): void;
  bite: BiteFn;                         // spawns an ant (prototype 738)
  frame(now: number, g: Game, fast: boolean): void;
  busy(): boolean;                      // ants still in flight
  onChew?: () => void;                  // sound hook
}
```
  Port the drawing from prototype 734–831. The renderer owns `vis`/`chew`. Logic stays in `Game`. The ant sprite size is `max(9, cs*0.95)`, so ants stay visible on 6px cells. Blocks are drawn with `drawCube` (Task 7R).

- [ ] **Step 1: Write failing tests** for `fitBoard` (Review Focus 5):
  - (358, 420, 56, 56): `cs >= 6` and `CW <= 358`.
  - (288, 300, 44, 56): `CH <= 300`.
  - (812, 200, 30, 30): `CH <= 200`.
  - `cs` is always an integer ≥ 1 even when space is tiny (no NaN or 0).
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement `fitBoard`, then the renderer.
- [ ] **Step 4:** Run. PASS.
- [ ] **Step 5: Commit** `feat(render): fit and canvas renderer`.

### Task 9: App UI and game loop

**Files:**
- Create/replace: `index.html` (markup from prototype ~120–170 adapted), `src/styles.css` (prototype CSS lines 8–120), `src/ui/dom.ts`, `src/ui/hud.ts`, `src/ui/sheets.ts`, `src/ui/sound.ts`, `src/ui/controller.ts`, `src/main.ts`

**Interfaces:**
- Consumes: Tasks 2–8.
- `hud.ts`: `renderLanes(g, onTap, hintLane)`, `renderSlots(g)`, `renderMeter(g)`, ported from prototype 668–708.
- `sound.ts`: `ensureAudio()`, `bite()`, `tone(freqs, dur?, type?, vol?)`, plus a `setEnabled(on)` that the controller calls from prefs (prototype 547–551).
- `sheets.ts`: `openScenes(ctx)` shows 3 band groups. Cleared scenes show a thumb plus "Cleared", the next scene is highlighted, and locked scenes show a lock icon with no art. Below are the Random section (band segmented control plus "New scene") and Daily ("Today's scene ✓" when done). `showResult(title, text, buttons, art?)`. Copy comes from prototype 630–665. Clearing the last manifest scene points to random mode.
- `controller.ts`: `start(meta: Meta, seed?: number)`, the rAF loop (tick every `95/speed` ms, up to 4 per frame), end checks once `!renderer.busy()`, a save via `toRun` after every tap and on `visibilitychange`→hidden, and hint wiring (`lineHint` first, then `searchHint`). `run = null` on win or stuck.
- Boot: `load()`. If `run` restores via `fromRun`, resume it. Otherwise start the campaign at `nextScene`. The first-ever launch shows the prototype's one-line tip.

- [ ] **Step 1:** Implement the modules.
- [ ] **Step 2:** Run `bun run dev`. In a 390×844 mobile emulation, verify by hand:
  - Scene 1 plays to a win, and scene 2 unlocks.
  - Get stuck, then use undo.
  - Restart re-deals.
  - A hint highlights a lane.
  - 2× speeds up the game; sound toggles.
  - Reloading mid-board resumes the same board.
  - Locked scenes show no art.
  - Dark mode works.
- [ ] **Step 3:** Run `bun test` and `bun run lint`. PASS.
- [ ] **Step 4: Commit** in pieces: `feat(ui): hud`, `feat(ui): sheets`, `feat(ui): sound`, `feat(app): controller and boot`.

### Task 10: Random mode and daily

**Files:**
- Create: `src/random/palettes.ts` (prototype 347–363), `src/random/backgrounds.ts`, `src/random/motifs.ts`, `src/random/scene.ts`, `src/random/level.ts`
- Modify: `src/state/save.ts` (`fromRun` handles random), `src/ui/controller.ts`
- Test: `tests/random/random.test.ts`

**Interfaces:**
- Produces: `makeScene(seed: number, size: number): Art & { name: string; type: string }`, ported from prototype 364–522 and split by responsibility so each file is under 300 lines. Critter size scales with `size` (`S = round(size*0.6)`), not a fixed 14–18. `RANDOM_BANDS: Record<Band, Params & { size: number }>` = easy `{size:42, slots:5, lanes:3, wait:.3}`, medium `{size:48, slots:4, lanes:4, wait:.5}`, hard `{size:54, slots:3, lanes:4, wait:.85}`. `chunk` is derived from block count to hit ~45 taps. `randomLevel(band, seed): Level`.
- Daily: `start({kind:'daily', date, id: dailyPick(...)}, hashStr(date + id))`. Its first deal is date-seeded; restarts use a random seed. Clearing it sets `save.daily = date`.

- [ ] **Step 1: Write failing tests:**
  - `makeScene(s, n)` is deterministic per seed.
  - Rows are n×n.
  - There are ≤ 9 colours.
  - For seeds 1..30 per band, `deal(randomLevel(band, seed), …)` replays its line to a win.
  - A random `SavedRun` round-trips through `fromRun`.
- [ ] **Step 2:** Run. FAIL.
- [ ] **Step 3:** Implement and wire into the scenes sheet.
- [ ] **Step 4:** Run tests, then play one random scene per band and the daily in the browser.
- [ ] **Step 5: Commit** `feat(random): port scene generator`, then `feat(app): random mode and daily`.

### Task 11: Easy scenes 2–10

**Files:** Create 9 files in `src/scenes/` and modify `manifest.ts` and `index.ts`. The scenes are Goldfish Bowl, Lighthouse at Dusk, Rubber Duck, Sleeping Fox, Record Player, Desert Cactus at Noon, Paper Boat in the Rain, Toucan and Ice Cream Truck. Follow the spec's art direction and check-in 2 results: style-B cubes, borders only where they don't cramp the subject, open subject on a plain background (mostly). Easy scenes need taps 30–60 and win rates within the Easy band.

- [ ] **Step 1:** Draw each scene as an SVG in `scenes/art/` (Task 7R pipeline and the spec's art direction), in the Easy band, then run `build-scenes`. Most colours should touch open edges.
- [ ] **Step 2:** Run `bun run validate` until there are no errors. Taps should be 30–60 and win rate within the Easy target. Check every PNG thumb reads as its subject.
- [ ] **Step 3: Commit** one commit per scene.

### Task 12: Medium scenes 12–20

Same as Task 11 for Koi Pond, Mount Fuji in Bloom, Arcade Cabinet, Night Owl, Venice Canal, Campfire Under the Stars, Typewriter and Jellyfish (8 new). Brooklyn Bridge is scene 11 and Birthday Cake is already drawn (Task 7S). Mostly the 'subject on a patterned background' layout.

### Task 13: Hard scenes 22–30

Same as Task 11 for Golden Gate in Fog, Northern Lights over a Cabin, Peacock, Rose Window, Fireworks over the Harbor, Chameleon, Hummingbird & Flowers and Santorini Rooftops (8 new). Coral Reef and Bento Box are already drawn (Task 7S). Use the boxed or compartmented layout (bento-like) so the Hard depth gate (avg ≥ 1.5) is met.

- [ ] **Final step for Task 13:** Run full `bun run validate` (500 deals). Tune `TARGETS.winRate` so Easy, Medium and Hard medians are clearly separated, with no scene in the wrong band. Commit `chore: tune difficulty targets`.

### Task 14: PWA, build and acceptance

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon.svg`, generated icons (via `bunx @vite-pwa/assets-generator`), and `README.md` (dev, validate, build, and how to add a scene: create the file, add it to `index.ts` and `manifest.ts`, then run validate)

- [ ] **Step 1:** Add `vite-plugin-pwa` (`registerType: 'autoUpdate'`). Precache all build assets. The manifest uses `name: 'Crumb Hunt'`, `display: 'standalone'`, `orientation: 'portrait'` and theme colours from the tokens.
- [ ] **Step 2:** Run `bun run build && bunx vite preview`. Load the app, go offline in devtools, reload, and confirm it still plays. Lighthouse should report it as installable.
- [ ] **Step 3:** Run `bun test`, `bun run lint` and `bun run validate`. All pass.
- [ ] **Step 4: Commit** `feat: PWA and offline support`, then `docs: README`.
