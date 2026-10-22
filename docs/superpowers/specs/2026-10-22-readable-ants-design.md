# Readable Ants: one nest, coloured squads, and a reach preview

## Why

Pixel Hunt is a cozy, readable puzzle: pick which colour goes next, and look before you tap. Three things currently work against that:

1. **A hidden rule decides what gets eaten.** Each holding slot has its own nest hole on the bottom track (`holeCol` in `src/core/path.ts`), and a squad eats the reachable pixel of its colour nearest *its* hole. A tap always fills the leftmost free slot, so the only way to reach the right-hand hole is to load up the slots to its left, which is the risky move the game punishes. The owner played for a long time without noticing holes mattered at all. A rule that changes outcomes but that players can't see or control feels like luck when it bites.
2. **You can't always see what's being eaten.** A chewed pixel shrinks for 130 ms and throws crumbs in its own colour. When that colour is close to a neighbouring colour or the scene background, the owner has known pixels were being eaten without being able to tell which.
3. **You can't tell what's exposed.** The core decision is "can this colour be eaten yet, or will it clog a slot?", but nothing shows which pixels are reachable, so players guess.

The guiding principle, from the owner: **the game must be intuitive, and the visuals must match the mechanic.**

## Goals

- One rule a player can hold in their head: **ants eat what they can reach, closest to the nest first.** The slot a squad sits in has no effect on what it eats.
- What you see the ants do is exactly what the rule says.
- At any moment a player can find out which pixels a lane's squad could eat.
- Every pixel being eaten is visible, whatever its colour.

## Non-goals

- Changing what "reachable" means. A pixel is still eatable only when it touches the outer track or an eaten cell. Buried centres stay hard to reach; that's the core of the game.
- Changing taps (leftmost free slot), undo, rewind, restart or the band targets.
- New art. Scenes are retuned and recoloured only where the new rule or the colour check demands it.

## Anti-goals

- Anything that adds planning about *where* ants come from. If players have to reason about entry points, this has failed.
- Ants visibly walking a route that differs from the one the rule used to choose the target.
- A preview gesture that can send a squad by accident.
- Visual clutter during normal play. The extra feedback should be quiet until you ask for it, or brief and tied to an action.

## The design

### 1. One nest along the whole bottom (core rule)

- **Distance** is walking distance from the nearest bottom-track cell, not from a slot's hole. Implement as a multi-source BFS seeded with every bottom-track cell (ext row `H`, every column). Walking rules are unchanged: the one-cell track around the board plus eaten cells.
- **Pick:** among exposed pixels of the squad's colour, the lowest distance wins (distance measured to the pixel's nearest open neighbour, as now via `minAround`).
- **Ties (decided by the owner):** prefer the pixel nearest **bottom centre**. Among equal distances, the smallest horizontal offset of the pixel's column from the board's centre column wins. If still tied (mirror images either side of centre), a fixed last rule settles it so deals stay deterministic. The builder picks the rule (suggest left first) and can make the validator report how often it is reached.
- **One field for all squads:** distance no longer depends on the slot, so `Field.fields` collapses from one field per hole to one shared field. `nearest()` and `stepSlots()` drop the hole argument. Slots still bite in slot order within a tick, so two same-colour squads competing for one pixel resolve the same way every time.
- **Everything that plays the game uses the same rule:** stepping, the dealer (`deal.ts`), the solver (`solve.ts`), the choices/mindless metrics (`scripts/`), random-mode calibration and the renderer. They already share `src/core`, so the change belongs there.
- **Saves:** in-progress runs replay from the seed's deal, which will change, so `load` will reject them through its existing deal check. That's acceptable; cleared progress is keyed by scene id and is unaffected. Builder's call whether to bump the storage key for a clean break.

### 2. Ants show the rule (visuals)

- **Entry point:** each ant comes up from the bottom-track cell where its shortest route starts, and walks that route (`tracePath` over the shared field already returns it, ending at distance 0 on the bottom track). The ant spawns in the nest strip directly below that cell. Ants never appear from a fixed slot position.
- **No per-slot holes:** `drawHoles` goes. The nest is drawn as one continuous burrow strip along the bottom.
- **Ants carry their squad's colour (owner: must work with several squads out at once):** tint each ant's body in its squad's colour, with a dark outline so it reads against any pixel or background. Each squad's stream of ants is then its own colour. Two squads of the same colour look alike, which is fine now that slots don't change targets. The holding slots in the HUD keep showing their squad's colour.
- **Target marker:** when an ant sets off, mark its target pixel (a ring or outline in the ant's colour, with a contrasting edge) until it has been eaten. The player sees which pixel is going *before* it disappears.
- **Chew contrast:** the shrinking chewed cell gets a contrasting outline rather than relying on its own colour, so it's visible against similar neighbours.
- Reduced-motion and 2× speed keep working: markers and outlines appear with no movement under reduced motion, and scale with speed.

### 3. Press and hold a lane to preview its reach (input)

- **Tap** (finger or mouse down and up within a short threshold, start at ~300 ms) sends the squad, as now.
- **Hold** past the threshold enters preview: the board dims and every pixel the lane's top squad could eat right now lights up. Releasing from a preview **never** sends anything. To send after previewing, tap again.
- **Slide to compare:** while holding, moving onto another lane switches the preview to that lane's top squad. Lifting off anywhere commits nothing.
- **Feedback when preview starts:** the dim/highlight appears immediately, plus a short haptic tick (`navigator.vibrate`) where supported, so a slow tap that crossed the threshold is obviously a preview, not a missed tap.
- Empty lanes preview nothing. Preview is available while ants are moving. Keyboard access is left to the builder (the lanes are buttons today).
- **The preview follows the screen, not the game state (owner's call).** The game ticks every 95 ms and eats in state at once, while a pixel only disappears on screen when its ant arrives and finishes chewing, so state runs several bites ahead. The preview lights pixels of that colour that look exposed on screen (touching the track or a cell already cleared on screen), excluding pixels an ant is already heading for (those carry their target marker). Pacing is unchanged: the game does not wait for the screen. The existing quirk where an ant's route occasionally crosses a pixel whose own ant hasn't finished chewing it stays.

### 4. Catch colours too close to tell apart (tooling)

- Add a validator check that flags any scene whose palette has two colours too similar to distinguish, including against the background colour. The builder chooses the metric (a perceptual distance such as CIEDE2000 is the natural fit).
- **What prompted it (owner):** boards with whites, greys and several shades of brown. More than once the owner tapped a lane believing its colour matched pixels on the board, and it didn't. So the comparison must use colours as actually drawn: the shaded cube faces on the board (`src/render/cube.ts`) and the squad swatches in the lanes, not just the raw palette hex values.
- **Calibrating the threshold:** the owner doesn't remember which boards. List the closest pairs across all 50 scenes, propose a threshold that catches the near-neutral white/grey and brown clusters, and show the owner the flagged boards side by side at the checkpoint before recolouring anything.
- The same check covers random-mode palettes (`src/random/palettes.ts`). Fix offenders there too, then re-run random-mode calibration if colours change.
- Fix flagged scenes by adjusting colours in their SVGs. Palette letters come from colour order in the file (`scripts/raster.ts`), so recolouring in place keeps the generated grid layout.

### 5. Re-validate and retune

- Re-run `bun run validate` on all 50 scenes and random mode under the new rule, and compare decisions, mindless win rate and taps against today's numbers before changing visuals.
- Retune any scene that leaves its band (chunk, slots, wait, small art edits), as in the README's tuning advice. Scenes keep their band; moving one to another band (which changes the 5/10/35 split, the manifest and README counts) needs the owner's approval. Passing the gates in `targets.ts` is the bar, not matching today's numbers. Ids never change. Random-mode calibration constants (`START` in `src/random/level.ts`) may need updating too.
- Update the README ("How to play", "How deals and difficulty work") and the in-game help sheet and tip in `index.html` to state the rule in one line.

## Order of work

1. Core rule plus a full re-validation, compared against today, and a first run of the colour check. **Checkpoint:** stop and show the owner the before/after numbers and the flagged colour pairs before steps 2–5.
2. Ant visuals: shared entry point, colours, target markers, chew outline, nest strip.
3. Press-and-hold preview.
4. Colour check, then colour fixes and retuning.
5. Docs and help text.

## Left to the builder

- Exact tie-break code, the final fixed tie rule, and whether to report its frequency.
- Visual styling of the ant tint, target marker, chew outline, dimming and nest strip, within "quiet unless asked, readable on any colour".
- Hold threshold value (start ~300 ms, tune after play), haptic duration, keyboard access to the preview.
- Colour-distance metric and threshold.
- Whether to bump the save key.
- How retuning is split across commits (granular, per the owner's preference).
