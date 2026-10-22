# Readable Ants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ants eat what they can reach, closest to the bottom nest first. The visuals show exactly that, players can press and hold a lane to see what it could eat, and the validator catches colours too close to tell apart.

**Architecture:** The core swaps per-hole distance fields for one multi-source field seeded from the whole bottom track, with a bottom-centre tie-break. Every consumer (step, deal, solve, scripts, renderer) already goes through `src/core`, so they pick it up. The renderer spawns ants from their route's start cell, tints them, and marks targets. A small pure press state machine drives tap vs. hold on the lanes. The preview reads the on-screen grid (`cells.vis`), not game state.

**Tech Stack:** TypeScript, Vite, bun (`bun test`, `bun run lint`, `bun run build`), Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-22-readable-ants-design.md`

## Global Constraints

- Files at most 300 lines and functions at most 100 (`bun run lint`). Complexity ≤ 15 is a warning.
- Use bun/bunx, never npm.
- Granular commits: one logical change per commit. End each message with `Claude-Session: https://claude.ai/code/session_018MGDogo8NLFF5f9RZpGyNf`.
- Scene ids never change. Don't hand-edit `src/scenes/*.ts`; edit `scenes/art/<id>.svg` and run `bun run build-scenes <id>`.
- Scenes keep their band. Moving one needs the owner's approval. The bar is the gates in `src/core/targets.ts`.
- **Checkpoint after Task 3:** stop and show the owner the before/after table and the flagged colour pairs. Do not start Task 4 without their go-ahead.
- Taps still fill the leftmost free slot. Undo, rewind, restart and band targets are unchanged.

## Review Focus

1. **Slow taps around the hold threshold:** a press released at 299 ms sends, and one at 301 ms previews and sends nothing. Pinned in Task 5 tests.
2. **Lanes re-rendered mid-press** (undo or restart while a finger is down): the press must end cleanly, with no send and no stuck preview. Pinned in Task 5 (`cancel` event).
3. **Two same-colour squads out at once:** slot order still decides who gets a contested pixel, and both are tinted the same. Pinned in Task 2 (`stepSlots` same-colour test).
4. **Old in-progress saves after the rule change:** `load` must return a fresh board, not crash or resume a mismatched one. Pinned in Task 2 (save test with a lane that doesn't match the deal).
5. **Preview with reduced motion or 2× speed:** dim and highlight appear instantly, and markers don't animate under reduced motion. Checked by hand in Task 4/5 run steps.

---

### Task 1: Baseline numbers

**Files:**
- Create: `/private/tmp/claude-501/-Users-saadiq-dev-pixel-hunt/3067b15e-f197-4dd1-9057-da0b2e7717e5/scratchpad/baseline.txt` (scratch, not committed)

- [ ] **Step 1:** Create a worktree of the current `main` at `.claude/worktrees/baseline` (`git worktree add .claude/worktrees/baseline main`; `.claude/worktrees/` is already gitignored), run `bun install` there, then run `bun run validate > <scratch>/baseline.txt 2>&1` from it in the background. It takes about 40 minutes (≈45 s per scene). Start Task 2 in the main tree meanwhile. Remove the worktree when done.
- [ ] **Step 2:** Confirm the file has one row per manifest id (50) plus three `random-*` rows.

### Task 2: One nest along the bottom (core rule)

**Files:**
- Modify: `src/core/path.ts` (`distField` → `nestField`; `pickNear`; tie-break; keep `holeCol` for now, render-only)
- Modify: `src/core/field.ts` (one shared field)
- Modify: `src/core/step.ts`
- Modify: `tests/core/path.test.ts`, `tests/core/field.test.ts`, `tests/state/save.test.ts`

**Interfaces:**
- Produces:
  - `nestField(grid: Int8Array | Int16Array, W: number, H: number): Int16Array`: walking distance over the ext grid from every cell of the bottom track row (ext row `H+1`, ext columns `0..W+1`), each seeded at 0. Same walking rules as today; `-1` = unreached.
  - `closer(a: number, b: number, da: number, db: number, W: number): boolean`: true if cell `a` at distance `da` beats `b` at `db`. Order: lower distance; then smaller `|2*col - (W-1)|` (nearer the centre column); then larger row (lower on the board); then smaller col (left).
  - `pickNear(grid, W, H, color, d): number` with the `closer` tie-break.
  - `nearest(f: Field, color: number): { i: number; d: Int16Array }`, with no `g` or hole argument.
  - `Field.dist: Int16Array` replaces `Field.fields`.
  - `exposedMask(grid: Int8Array | Int16Array, W, H): Uint8Array`, unchanged behaviour, widened type (Task 5 passes `cells.vis`).
  - `tracePath(d, i, W, H)`: unchanged. Its first element is now a bottom-track ext cell (`d === 0`).
- `BiteFn` keeps its signature.

- [ ] **Step 1: Write failing tests** in `tests/core/path.test.ts`:
  - `nestField seeds the whole bottom track`: on an empty 5×4 grid, `d[extIdx(4, c)] === 0` for c in -1..5 (ext row H+1), and the top-left board cell has distance 4.
  - `pickNear prefers the cell nearest the bottom`: a 5×5 grid of colour 1 with colour 0 only at (row 0, col 2) and (row 4, col 2) picks the row-4 cell (its nest distance is 0, the top one's is 9).
  - `ties go to the centre column`: 7×3 grid of colour 0, with colour 1 at bottom-row columns 0, 3 and 6 (all at nest distance 0) → picks column 3.
  - `mirror ties go left`: 6×3 grid, colour 1 at bottom-row columns 1 and 4 (equal offset from centre 2.5) → picks column 1.
  - `tracePath starts on the bottom track`: `d[p[0]] === 0` and `p[0]` lies in ext row `H+1`.
  - Delete the `distField(..., hole)`-based cases. Keep the `holeCol` test until Task 4.
- [ ] **Step 2:** Run `bun test tests/core/path.test.ts`. Expect FAIL (`nestField` not exported).
- [ ] **Step 3:** Implement `nestField` (multi-source BFS: queue every bottom-row ext cell at distance 0, then the existing unrolled loop), `closer` and the new `pickNear` in `src/core/path.ts`. `exposedMask` uses `nestField`.
- [ ] **Step 4:** Update `src/core/field.ts`. `build` makes one `nestField` as `f.dist`, which also drives exposure. `eat` repairs only `f.dist` (`repair(f, f.dist, i, true)`). `nearest(f, color)` scans `f.exposed[color]` with `minAround` and `closer`. Update the header comment. Update `src/core/step.ts` to call `nearest(f, sq.color)` and drop the `holeCol` import. Slots still bite in slot order.
- [ ] **Step 5:** Update `tests/core/field.test.ts`: `refStep` uses `pickNear(g, W, H, sq.color, nestField(g, W, H))`. Add `two same-colour squads: slot 0 takes the contested pixel`: two slots of colour c with one exposed c pixel; after one `stepSlots`, slot 0's cap dropped and slot 1's didn't.
- [ ] **Step 6:** Add to `tests/state/save.test.ts`: `a saved run whose lanes don't match its seed's deal loads as null`. Take a valid saved run, swap two squads' colours in `lanes`, and expect `findLevel`/load to return null (use the same helpers the file already uses).
- [ ] **Step 7:** Run `bun test`. Expect all PASS. Tests that asserted specific picks under the hole rule are updated to the new rule, never deleted. The `stepSlots` < 2 ms perf test must still pass.
- [ ] **Step 8:** Run `bun run lint` and `bunx tsc --noEmit`. Expect 0 errors.
- [ ] **Step 9: Commit** `feat(core): ants eat from one nest along the whole bottom, ties to bottom centre`.

### Task 3: Colour check on drawn tones, then the checkpoint run

**Files:**
- Modify: `scripts/checks.ts` (CIEDE2000, drawn tones, threshold)
- Create: `scripts/colour-pairs.ts` (report: closest pairs across scenes and random palettes)
- Modify: `package.json` (script `colour-pairs`)
- Test: `tests/scripts/checks.test.ts`

**Interfaces:**
- Consumes: `cubeShades(hex)` from `src/render/cube.ts`.
- Produces:
  - `deltaE2000(a: string, b: string): number`
  - `drawnDelta(a: string, b: string): number`: the minimum `deltaE2000` between one colour's lane swatch (its hex, `face`) and the other's board tones `{face, body, hl}`, taken both ways.
  - `MIN_DRAWN_DE`: start at `12` (provisional, set at the checkpoint).
  - `checkColors(s)` flags `colours "x" and "y" too similar (dE00 n.n)` using `drawnDelta` < `MIN_DRAWN_DE`, including pairs with the background colour (it's a palette colour like any other).
  - `checkPalette(p: Palette): string[]` for random-mode palettes (all of `dark`, `light`, `acc`).

- [ ] **Step 1: Write failing tests:** `deltaE2000` matches published reference pairs from Sharma et al. 2005 (e.g. Lab (50, 2.6772, -79.7751) vs (50, 0, -82.7485) → 2.0425, via a `labDelta2000` helper exported for the test); `drawnDelta('#ffffff', '#d9d9d9')` is below 12; `drawnDelta('#ff0000', '#0000ff')` is above 40. Keep the existing `checkColors` tests passing (the "near-identical" case must still flag).
- [ ] **Step 2:** Run `bun test tests/scripts/checks.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement in `scripts/checks.ts`. Remove CIE76 `deltaE` and `MIN_DELTA_E` once nothing uses them.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Write `scripts/colour-pairs.ts`: for every manifest scene and every `PALETTES` entry, print the 3 closest `drawnDelta` pairs (id, chars, hexes, value), sorted ascending overall, plus how many scenes `MIN_DRAWN_DE` values of 8, 10, 12, 15 and 18 would flag. Add `"colour-pairs": "bun scripts/colour-pairs.ts"` to package.json.
- [ ] **Step 6:** Commit `feat(scripts): judge colour pairs as drawn, with CIEDE2000`.
- [ ] **Step 7: Checkpoint run.** Run `bun run validate > <scratch>/after.txt 2>&1` and `bun run colour-pairs > <scratch>/pairs.txt`. Build a before/after table (taps, win, decide, mindless, flags per scene, plus the random rows) from `baseline.txt` and `after.txt`, and list the scenes that leave their band. Export PNG contact sheets of the scenes with the lowest pairs (`bun run export-pngs <ids>`). **Stop and present this to the owner.** Record their threshold choice and recolouring go-ahead before Task 4.

### Task 4: Ants show the rule (visuals)

**Files:**
- Create: `src/render/marks.ts` (target markers, chew outline, preview overlay; keeps `ants.ts` and `board.ts` under 300 lines)
- Modify: `src/render/ants.ts` (spawn from route start, tinted body)
- Modify: `src/render/board.ts` (remove `drawHoles`, nest strip, draw markers)
- Modify: `src/core/path.ts` (remove `holeCol`), `tests/core/path.test.ts` (drop the `holeCol` test)
- Test: `tests/render/marks.test.ts`

**Interfaces:**
- Consumes: `tracePath` (Task 2): `path[0]` is a bottom-track ext cell.
- Produces:
  - `spawnAnt(g: Geom, cell: number, color: number, path: number[], now: number, reduce: boolean, fast: boolean): Ant`: the first point is in the nest strip directly below `path[0]`'s column (`extCenter` x, `holeY` y).
  - `drawAnt(ctx, x, y, ang, sz, body: string, carry: string | null, t)`: the body is filled with the squad colour and outlined dark (`#1d130d`) at ≥ 1 px.
  - `targets(ants: Ant[]): Map<number, number>`: cell → colour index for ants in phase 0 or 1 (in flight or chewing).
  - `drawMarkers(ctx, geo: Geom, marks: Map<number, number>, colors: string[], now: number, reduce: boolean): void`: a ring in the ant colour with a contrasting edge (white or dark by luminance, via `textOn` logic) on each marked cell.
  - `drawChewing` (in `layer.ts`) adds a contrasting outline around the shrinking cube.
- [ ] **Step 1: Write failing tests** in `tests/render/marks.test.ts`: `targets` returns only phase-0/1 ants' cells with their colours; two ants on different cells give two entries.
- [ ] **Step 2:** Run `bun test tests/render/marks.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `targets` and `drawMarkers` in `src/render/marks.ts`.
- [ ] **Step 4:** Change `spawnAnt`/`drawAnt` as above. `stepAnts` passes `cells.colors[a.color]` as the body.
- [ ] **Step 5:** In `board.ts`: drop `drawHoles` and the `holeCol` import, and stop passing `slot` to `spawnAnt`. Draw the nest as one continuous burrow strip in `drawGround` (styling is the builder's call). Call `drawMarkers(ctx, geo, targets(ants), cells.colors, now, reduce)` after `drawChewing`. Remove `holeCol` from `src/core/path.ts` and its test.
- [ ] **Step 6:** Run `bun test`, `bun run lint` and `bunx tsc --noEmit`. Expect all pass.
- [ ] **Step 7: Check by hand:** `bun run dev`, play two boards with two squads out at once. Ants rise directly below their targets, streams are tinted per squad, targets are ringed until eaten, and chewing is visible on a pale-on-pale scene (e.g. snowman). Repeat with 2× speed and with OS reduced motion on.
- [ ] **Step 8: Commit** in pieces: `feat(render): ants rise from the nest below their target`, `feat(render): tint ants in their squad's colour`, `feat(render): ring each target until it is eaten, outline chewed cells`.

### Task 5: Press and hold a lane to preview its reach

**Files:**
- Create: `src/ui/press.ts` (pure state machine plus DOM binding)
- Modify: `src/ui/hud.ts` (lanes stop wiring `click` per button)
- Modify: `src/ui/controller.ts` (wire preview to the renderer)
- Modify: `src/render/board.ts` and `src/render/marks.ts` (`preview` overlay)
- Test: `tests/ui/press.test.ts`

**Interfaces:**
- Consumes: `exposedMask(grid: Int16Array, …)` (Task 2), `targets(ants)` (Task 4).
- Produces:
  - `HOLD_MS = 300`.
  - `type PressEvent = { t: 'down'; lane: number; at: number } | { t: 'move'; lane: number | null } | { t: 'timer'; at: number } | { t: 'up'; at: number } | { t: 'cancel' }`.
  - `type PressOut = { send?: number; preview?: number | null }`.
  - `pressStep(s: PressState, e: PressEvent): [PressState, PressOut]`. Rules:
    - `up` before `HOLD_MS` sends the down lane.
    - `timer` at ≥ `HOLD_MS` enters preview of the lane under the finger.
    - `move` while previewing switches lanes (null = off the lanes: preview off, still holding).
    - `up` or `cancel` while previewing outputs `preview: null` and never a send.
    - `move` off the lanes before `HOLD_MS` and then `up` sends nothing.
    - `cancel` always ends the press with no send.
  - `bindLanePress(box: HTMLElement, onTap: (lane: number) => void, onPreview: (lane: number | null) => void): void`. Pointer events delegated on `#lanes` (it survives `renderLanes` rebuilds), `setPointerCapture`, the lane found via `elementFromPoint(...).closest('.lane')` and its index. The first preview calls `navigator.vibrate?.(10)`. Keyboard `click` (`event.detail === 0`) still taps. `contextmenu` and text selection are suppressed on lanes.
  - `Renderer.preview(color: number | null): void`. While set, each frame dims the board and highlights every cell where `exposedMask(cells.vis, W, H)` is 1, `cells.vis[i] === color`, and the cell isn't in `targets(ants)`.
- [ ] **Step 1: Write failing tests** in `tests/ui/press.test.ts`: `release at 299 ms sends`; `timer at 300 then release previews and never sends`; `sliding switches the preview lane`; `sliding off the lanes then releasing sends nothing`; `cancel mid-preview clears it with no send`; `cancel before the threshold sends nothing`.
- [ ] **Step 2:** Run `bun test tests/ui/press.test.ts`. Expect FAIL.
- [ ] **Step 3:** Implement `pressStep` and `bindLanePress` in `src/ui/press.ts`.
- [ ] **Step 4:** Run the tests. Expect PASS.
- [ ] **Step 5:** Wire it up. `renderLanes` no longer adds per-button click handlers, and the controller calls `bindLanePress($('lanes'), onTap, (l) => renderer.preview(l === null ? null : game.lanes[l][0]?.color ?? null))` once at start. Restart, undo, rewind and scene changes send `cancel`, and also call `renderer.preview(null)`. Add `preview` to `Renderer` and draw the overlay in `marks.ts`.
- [ ] **Step 6:** Run `bun test`, `bun run lint` and `bunx tsc --noEmit`. Expect all pass.
- [ ] **Step 7: Check by hand** on a phone (`bun run dev --host 0.0.0.0`) and with a mouse: a quick tap sends; holding dims the board and ticks; sliding compares lanes; releasing sends nothing; an empty lane previews nothing; it works while ants are moving.
- [ ] **Step 8: Commit** `feat(ui): press and hold a lane to see what its squad can reach`.

### Task 6: Recolour and retune (from the checkpoint)

**Files:**
- Modify: `scenes/art/<id>.svg` for each flagged or out-of-band scene, then `bun run build-scenes <id>` regenerates `src/scenes/<id>.ts`
- Modify: `src/random/palettes.ts` (flagged palettes), and `START` in `src/random/level.ts` if random calibration drifts
- Modify: `scripts/checks.ts` (`MIN_DRAWN_DE` to the owner's chosen value)

- [ ] **Step 1:** Set `MIN_DRAWN_DE` to the value agreed at the checkpoint. Commit `chore(scripts): set the colour threshold`.
- [ ] **Step 2:** For each flagged scene, recolour the offending colour in place in its SVG, keeping its first appearance where it is (palette letters follow first-appearance order in `scripts/raster.ts`). Rebuild, export PNGs, look at them, and validate. One commit per scene: `fix(scenes): make <name>'s <colour> easier to tell apart`.
- [ ] **Step 3:** For each scene out of its band under the new rule, retune chunk, slots, wait and small art edits per the README until `bun run validate <id>` shows no flags. One commit per scene: `fix(scenes): retune <name> for the bottom nest`.
- [ ] **Step 4:** Fix flagged random palettes and add a test in `tests/random/random.test.ts`: `every random palette passes checkPalette`. Run the full `bun run validate`; random rows must show no flags. Adjust `START` only if calibration needs a second pass on most seeds. Commit.
- [ ] **Step 5:** Run the full `bun run validate`. Expect exit code 0 and no WARN on any scene.

### Task 7: Say the rule

**Files:**
- Modify: `README.md` ("How to play" step 2; "How deals and difficulty work"; "Adding a scene" colour rule names CIEDE2000 on drawn tones; the commands table gains `colour-pairs`)
- Modify: `index.html` (help sheet `<li>` at ~line 49 and the tip at ~line 34)

- [ ] **Step 1:** Exact copy for the rule, used in both places: **"Ants eat what they can reach, closest to the nest first."** The help sheet also gains: **"Press and hold a lane to see what its squad can reach. Let go to cancel."**
- [ ] **Step 2:** Run `bun run build`. Expect success.
- [ ] **Step 3: Commit** `docs: explain the bottom nest and the reach preview`.
