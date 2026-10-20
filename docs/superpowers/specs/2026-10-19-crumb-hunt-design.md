# Crumb Hunt — Mobile Web App Design

Date: 2026-10-19
Status: Ready for review

## Intent

Turn the Crumb Hunt prototype (a single-file artifact, saved at
`docs/reference/crumb-hunt-artifact.html`, live at
https://claude.ai/artifact/8HY37csxEpxCSgUKYMquZn) into a real mobile-first web
app built around a progression of hand-drawn pixel-art scenes.

The appeal of the game is watching a recognizable picture get eaten away by
ants, one color at a time, while planning which squads to send. The scenes are
the reward, so they need to be good pictures, with more detail than the
prototype allows.

## The game (unchanged from the prototype)

The prototype's rules carry over exactly. The pure logic in the artifact
(`parseLevel`, `distField`, `pickNear`, `stepSlots`, `generate`, `playout`,
`makeScene`) is the reference implementation to port to typed modules.

- The board is a pixel-art grid. Each cell is a block of one color.
- A one-cell **track** surrounds the board. Below it is the **nest**, with one
  hole per holding slot.
- At the bottom are **lanes**, each a queue of **squads**. A squad has a color
  and a capacity, which is how many blocks it eats.
- Tapping a lane moves its top squad into a free **holding slot**.
- Each tick, every occupied slot takes one bite: the nearest block of its
  color that can be reached (by walking distance from its nest hole) via the
  track or through cells that have already been eaten. When its capacity hits
  0, the squad leaves.
- **Stuck:** every slot is full and none of their colors can be reached, so
  the player loses. **Win:** all blocks are eaten.
- Ants animate the walk out, chew, and carry the crumb home. The 1×/2× speed
  toggle and sound effects carry over.

## Goals

1. **30 hand-drawn scenes** in a fixed progression: 10 Easy, then 10 Medium,
   then 10 Hard. Each one unlocks when the scene before it is cleared.
2. **Smaller pixels, so the scenes can be more varied.** Grids are bigger than
   the prototype's 22–28 cells.
3. **Every board is solvable.** Every deal the player sees has at least one
   winning order.
4. **Easy, Medium and Hard** feel clearly different.
5. **Easy to add more scenes.** Scene 31 is a new data file plus one line in a
   manifest, with no code changes.
6. **Mobile-first.** It plays one-handed in portrait on a ~390px-wide phone,
   can be installed to the home screen, and works offline.
7. Keep **every** prototype feature: 3 undos and a restart per board, 3 hints,
   the 2× speed toggle, sound, random mode (Easy/Medium/Hard), and the daily
   scene.

## Non-goals

- Accounts, a backend, cloud sync, leaderboards.
- A native app.
- A level editor UI. Scenes are authored as data files.
- Monetization.

## Anti-goals (a failure even if it technically works)

- A board that turns out to be unwinnable.
- Scenes that read as abstract patterns, or a lone object on a background
  pattern. The **boule** scene is the example of what the user does *not*
  want.
- Pixels too small to read or tap around on a phone.
- Adding a scene that requires touching game code, or that wipes players'
  saved progress.

## Decisions made with the user

- **Fixed scenes, re-dealt squads.** A scene's picture is always the same.
  Each start or restart deals a new set of squads, generated so the deal is
  solvable. This matches the prototype.
- **Scenes are recognizable pictures that I (Claude) draw,** not output from
  the random generator. Subjects are a mix of **places, animals, objects and
  moments**. The prototype's **Brooklyn Bridge** is the quality bar. It is
  liked because it's a real scene with depth: sky, a landmark, water.
- **Progression:** easy to hard, unlocked one at a time.
- **Keep all the extras:** hints, speed, sound, daily scene, random mode.
- **Hosting:** run locally for now. Cloudflare (Pages) eventually.

## Calls I made (the user can override any of these)

### Stack
- TypeScript, Vite, bun (`bun install`, `bun run dev`, `bun test`). No UI
  framework. The game is one canvas plus a few DOM panels, like the
  prototype. Vanilla TS modules.
- PWA via `vite-plugin-pwa`: manifest, icons, and an offline cache of all
  assets and scenes.
- Static build output, ready to deploy to Cloudflare Pages unchanged.
- ESLint with `max-lines: 300` (error) per file, `max-lines-per-function: 100`,
  and `complexity: 15` (warn). This follows the user's global preferences.

### Grid sizes and difficulty bands (revised after the art check-in)
The first art check-in (30–38 wide) was rejected as too low-resolution. The
reference games (Colony Flow, Food Hunt: Pixel Puzzle) use ~48–60 cubes
across, drawn as small raised cubes at ~6–7px. So:

| Band   | Grid width (height 36–60) | Slots | Lanes | Squad size | `wait` |
|--------|---------------------------|-------|-------|------------|--------|
| Easy   | 40–44 wide                | 5     | 3     | scaled     | ~0.3   |
| Medium | 46–50 wide                | 4     | 4     | scaled     | ~0.5–0.7 |
| Hard   | 52–56 wide                | 3–4   | 4–5   | scaled     | ~0.8–0.95 |

- Cell size may be fractional and goes down to ~6px (56 wide on a 390px
  phone). The track around the board is thin, as in the reference games.
- Squads are correspondingly large (roughly 30–90 per squad).

- Grids may be portrait (e.g. 32×40) when the art needs it. The board fits
  within the stage by both width and height.
- **Squad size scales with block count** so a board takes roughly 30–60
  taps (about 2–5 minutes at 1×). Bigger grids get bigger squads instead of
  more taps. Each scene's exact numbers are set in its data file and tuned by
  the validator (below).
- Difficulty also comes from the art itself. Hard scenes use dark outlines
  and nested shapes that wall colors inside other colors (the prototype's
  "d20" idea). Easy scenes have most colors touching open edges.
- Random mode uses these same bands and grid sizes.

### Random mode and the daily scene (decided with the user)
- **Random mode** keeps the prototype's `makeScene` generator, ported and
  widened to the new grid sizes. It's a separate bonus mode, so its
  pattern-style art is acceptable there. The anti-goal about abstract
  patterns applies to the 30 hand-drawn scenes and the daily scene.
- **Daily scene** no longer uses the generator. Each day it picks one
  hand-drawn scene from the player's pool (cleared scenes plus the next
  unlocked one), chosen by a date seed so it's stable for the whole day. It
  plays with that scene's own parameters. Its first deal is seeded by date,
  and restarts re-deal as usual.

### Solvability (must hold for every deal)
- Keep the prototype's approach: `generate()` plays the board forward with the
  real game rules and records the squad sequence it used. That sequence is a
  winning order by construction (send squads in that order, waiting for slots
  to finish eating each time).
- Fix the prototype's weak spot: if `generate()` throws 25 times, the fallback
  (`wait: 0`) can still throw in theory. The shipped app must never fail to
  deal. The validator proves every scene deals successfully across many
  seeds. At runtime, the last fallback is a guaranteed-safe dealer (wait 0,
  squad capacity capped to currently reachable count).
- Deals are generated in the browser at start or restart time. Keep the
  generator fast enough that a 40×40 deal takes well under 100ms on a
  mid-range phone. Precompute if it doesn't.

### Scene validator (build-time tool)
`bun run validate` checks every scene in the manifest and fails the build on
any violation:
- Rows have equal length, and every character is in the palette.
- Grid size is within the scene's band.
- ≤ 9 colors, and no color with fewer than 4 cells.
- Colors are visually distinct from each other (a minimum color-distance
  threshold) so lane tiles and blocks can be told apart.
- 500 seeded deals all succeed, and the recorded sequence replays to a win.
- **Difficulty estimate:** win rate of the prototype's `playout()` policy
  across N deals. Each band has a target range, and the report flags scenes
  outside it so their parameters (slots, lanes, `wait`, squad size) can be
  tuned. Easy should be clearly above Medium, and Medium clearly above Hard.
- A text report per scene: size, colors, typical tap count, and estimated win
  rate.

### Scene data format and adding scenes
- One file per scene: `src/scenes/<id>.ts` exporting a `Scene`:
  `{ id, name, blurb, band, rows: string[], pal: Record<char, hex>, slots,
  lanes, chunk: [min,max], wait }`.
- `src/scenes/manifest.ts` is the ordered list of scene ids. That order *is*
  the progression.
- Progress is stored by **scene id**, never by index, so inserting or
  appending scenes doesn't break saved progress. Unlock rule: a scene is
  unlocked if it's first or the scene before it in the manifest is cleared.
  Appending scene 31 unlocks it for anyone who has cleared scene 30.
- Saved data has a schema version so it can be migrated later.

### The 30 scenes (draft list, my call, open to edits)
Mixed across places, animals, objects and moments, with each band roughly
balanced. The Brooklyn Bridge is redrawn at the larger size. No other
prototype scenes carry over.

- **Easy:** Hot Air Balloon, Goldfish Bowl, Lighthouse at Dusk, Birthday
  Candles, Sleeping Fox, Record Player, Desert Cactus at Noon, Paper Boat in
  the Rain, Toucan, Ice Cream Truck
- **Medium:** Brooklyn Bridge, Koi Pond, Mount Fuji in Bloom, First Snow at
  the Bus Stop, Arcade Cabinet, Night Owl, Venice Canal, Campfire Under the
  Stars, Typewriter, Jellyfish
- **Hard:** Golden Gate in Fog, Coral Reef, Northern Lights over a Cabin,
  Peacock, Rose Window, Tokyo Street in the Rain, Fireworks over the Harbor,
  Chameleon, Hummingbird & Flowers, Santorini Rooftops

Every scene must read as its subject at thumbnail size (64px).

### Art direction (decided with the user after the first check-in)
- Reference: the iOS games Colony Flow and Food Hunt: Pixel Puzzle.
- One bold subject, close-up and centred, filling most of the frame (a
  bento box, a rainbow tongue, a pile of pencils), on a simple background.
  Cartoon-sticker look, not a wide landscape with tiny details.
- Clean dark outlines, flat fills, 5–9 colours, with one lighter or darker
  band for shading on curves.
- Blocks render as small raised cubes with a gap, in the game, the preview
  page and the PNG export alike.
- Subjects in the list above may be reframed as close-ups (e.g. Coral Reef
  becomes a clownfish in an anemone), and weak subjects swapped for bolder
  ones in the same category; swaps are shown at the next check-in.

### How scenes are made (revised)
- Each scene is drawn as an SVG illustration (`scenes/art/<id>.svg`) with
  flat fills and strokes at least one cell wide, plus a small metadata block
  (name, blurb, band, grid size, params).
- `bun run build-scenes [id…]` rasterises each SVG to the grid by
  supersampling and taking the majority colour per cell, snapped to the
  SVG's own palette, and writes `src/scenes/<id>.ts`. Generated files are
  committed, so the app and validator are unchanged.
- Adding a scene: draw the SVG, run build-scenes, add it to the manifest,
  run validate.

### Art sign-off (decided with the user)
- Build a dev-only **scene preview page** early, before the game UI is
  polished. It shows every scene at full size and as a 64px thumbnail, next
  to its validator stats.
- **Checkpoint:** draw 3 scenes first, one per band (my call: Hot Air
  Balloon, Brooklyn Bridge, Coral Reef). Stop for the user's review, then
  draw the other 27 with that feedback in mind.
- **Check-in 1 result (2026-10-19):** rejected, because the resolution was
  too low and the scenes didn't look good. This led to the revised grid
  sizes, art direction and SVG pipeline above. The same three scenes get
  redrawn the new way for a second check-in.

### Screens and UI
- Keep the prototype's layout and visual language: header (title/scene name
  plus undo, hint, restart and speed buttons), the board canvas, a meter,
  holding slots, and lanes. Max-width 520px column, 16px gutters, safe-area
  insets, light and dark themes.
- **Scenes sheet:** a 30-scene list grouped by band. Cleared scenes show their
  art thumbnail. The next playable scene is highlighted. Locked scenes show a
  lock with no art, so the picture is the reward. Any unlocked scene can be
  replayed.
- Below the list, the same sheet has a **Random** section (Easy/Medium/Hard
  picker plus a "New scene" button) and the **Daily** scene. Both are always
  available.
- **Win sheet:** the full scene art, stats (squads sent, undos and hints
  used), and Next/Replay. Clearing scene 30 points to random mode.
- **Stuck sheet:** Undo (if any are left), Restart, and Skip for random
  scenes.
- First launch opens scene 1 with the prototype's one-line tip.
- On small canvases, scale the ant sprite with cell size but keep a minimum
  size so ants stay visible. Cells may be fractional, down to ~6px before shrinking further.

### Undo, restart, hints
- 3 undos per board. Restarts are unlimited, as in the prototype. A restart
  deals a new set of squads and resets undos and hints to 3.
- A board in progress survives the app being closed: the grid, lanes, slots,
  undo history and counters are saved after each tap and restored on launch.
  This is part of the versioned save format from day one.
- Hints use the prototype's playout search. Improvement: when the player's
  state is still on the generator's recorded winning line, the hint can
  return the next squad from that line directly (a guaranteed-good answer
  with no search).

### Code layout (the builder may adjust this)
- `src/core/`: pure logic (grid, pathing, step, generator, playout, solver
  helpers). No DOM, unit tested with `bun test`.
- `src/render/`: canvas board, ants, crumbs, thumbnails.
- `src/ui/`: header, lanes, slots, sheets, sound.
- `src/state/`: game state, undo history, persistence.
- `src/scenes/`: scene files and manifest. `src/random/`: the prototype's
  `makeScene` generator.
- `scripts/validate.ts`: the scene validator.

## Left to the builder
- Exact module boundaries, file names and internal APIs.
- Exact per-scene parameters, tuned by the validator report.
- Exact win-rate target ranges per band, picked so the bands separate
  clearly.
- PWA icon art, app name casing, and theme colors (start from the
  prototype's tokens).
- Drawing the scenes themselves, within the constraints above.

## Acceptance
- `bun run dev` serves the app locally, and it plays well in mobile Safari
  and Chrome at 390×844.
- All 30 scenes pass `bun run validate`, and the per-band difficulty estimates
  separate cleanly.
- Core logic has unit tests (rules, generator solvability, undo, unlock
  rules).
- `bun run build` produces a static bundle that works offline after first
  load.
