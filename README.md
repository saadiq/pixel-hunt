# Pixel Hunt

A mobile-first pixel-art puzzle game. Each board is a hand-drawn picture made of coloured pixels. Send squads of ants out to eat it, one colour at a time, until the picture is gone.

It runs in the browser, installs as an offline PWA, and is built with TypeScript, Vite and bun.

## How to play

1. Tap a lane to send its **top squad** to a holding slot.
2. **Ants eat what they can reach, closest to the nest first.** The nest runs along the whole bottom of the board. Ants run the **track around the board** and tunnel through gaps that have already been eaten to reach pixels of their colour from any side. Ties go to the pixel nearest the bottom centre, and the slot a squad sits in doesn't matter.
3. **Press and hold a lane** to see what its squad can reach right now: the board dims and those pixels light up. Slide to compare lanes. Letting go never sends anything.
4. A squad leaves once it has eaten its fill. If every slot is full and no squad can reach food, **you're stuck**.
5. Every deal has at least one winning order. You get **3 undos** per board, and **restart** is free: it deals new squads for the same picture.
6. A wrong tap can doom a board long before you're stuck. Once per board, a stuck board can **rewind** to the last tap it could still be won from; the lane you tapped next is lit, since that's the tap that lost it.

The game is about choices, not speed. On harder boards, sending a squad whose colour is still buried can clog a slot and lose the board, so look before you tap.

## What's in it

- **50 hand-drawn scenes** in three bands:
  - **Easy (5):** teaching boards with roomy slots that you can tap through.
  - **Medium (10):** some taps matter.
  - **Hard (35):** tight slots, longer boards, and real decisions on most turns.
- **Daily:** one scene a day, chosen from the boards you've unlocked.
- **Random:** generated pictures at any difficulty, tuned to the same targets as the scenes.
- **Offline play** after the first load, progress saved on the device, a mute button and a 2× speed toggle.

## Quick start

```sh
bun install
bun run dev        # http://localhost:5173
```

To try it on a phone on the same network, run `bun run dev --host 0.0.0.0` and open the Network URL it prints.

## Commands

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server. `/preview.html` is a dev-only page that shows every scene with its validator stats |
| `bun test` | Unit tests |
| `bun run lint` | ESLint (at most 300 lines per file and 100 per function) |
| `bun run build` | Type-check, then build to `dist/`, including the service worker and manifest |
| `bun run validate [id...] [--quick]` | Solvability and difficulty table for scenes; with no id it checks every scene and random mode |
| `bun run build-scenes [id...]` | Turn `scenes/art/<id>.svg` into scene data |
| `bun run export-pngs [id...]` | Export PNG previews of scenes |
| `bun run colour-pairs` | The closest colour pairs (CIEDE2000) across every scene and random palette |

## Project layout

| Path | Contents |
| --- | --- |
| `src/core` | Game rules: board parsing, the ants' distance field, dealing, ticking, difficulty targets |
| `src/state` | Game state, undo, saves and progression |
| `src/random` | The random-picture generator and calibration for random mode |
| `src/render` | Canvas rendering of the board, ants and thumbnails |
| `src/ui` | Controller, HUD, sheets and sound |
| `src/scenes` | Generated scene data, plus `manifest.ts`, which sets the play order |
| `scenes/art` | Source SVGs for the scenes |
| `scripts` | Scene build, validator, difficulty metrics and PNG export |
| `docs/superpowers` | Design spec and implementation plan |

## How deals and difficulty work

A deal is made by playing the board forward: the dealer builds each lane's squads from a recorded winning order, so every deal can be won.

`validate` measures how much the player's choices matter:

- **`choice`:** the share of turns where some other tap would make the board unwinnable, for a player who waits for the ants to finish.
- **`decide`:** how many such turns a board has.
- **`mindless`:** the win rate of a player who taps any lane whose colour can be eaten right now.

The band gates in `src/core/targets.ts` apply to scenes and random mode alike:

| Band | Holding slots | Taps (median) | Decisions per board | Mindless win rate |
| --- | --- | --- | --- | --- |
| Easy | 4–5 | 30–60 | any | any |
| Medium | 3–4 | 60–90 | 6+ | ≤ 0.85 |
| Hard | 3 | 90–150 | 14+ | ≤ 0.55 |

The main lever is `waitSlack: 1`, which lets the dealer put a squad whose colour is still buried into a lane while slots are scarce. Open scenes with little enclosed art produce few choices whatever the settings, so they belong in Easy, unless a frame (a window, tile border or postcard edge) encloses them. When a hard board's mindless win rate is too high, try `wait` between 0.8 and 1.0 or larger squads (`chunk`) (its effect varies by board), and check that decisions stay at 14 or more. Squad size (`chunk`) sets the board's length, so a single tap never clears a whole outline.

## Adding a scene

Scenes come from an SVG pipeline. Don't hand-edit the generated TypeScript.

1. Draw `scenes/art/<id>.svg` with `viewBox="0 0 W H"` (one unit per cell) and a `<metadata>` JSON block containing `id`, `name`, `blurb`, `band`, `W`, `H`, `slots`, `lanes`, `chunk`, `wait`, `bg` and, optionally, `waitSlack`.
2. Run `bun run build-scenes <id>`. This also regenerates `src/scenes/index.ts`.
3. Add the id to `src/scenes/manifest.ts` where it should sit in the progression.
4. Run `bun run validate <id>` and `bun run export-pngs <id>`, and check the results against the band gates.

Scene rules:
- At most 9 colours, none with fewer than 4 cells.
- No two colours, background included, closer than CIEDE2000 12 (`MIN_DE00` in `scripts/checks.ts`). Players match a lane's colour against the board by eye, so whites and pale greys, or yellows and tans, must read as different.
- Colours visually distinct, and the picture recognisable at 64px.
- Progress is stored by scene id, so ids must not change once released.

## Deploying

Live at https://pixel-hunt.saadiq.workers.dev. `bun run build` produces a fully static site in `dist/`, served as a Cloudflare Workers static-assets site configured in `wrangler.jsonc`. Workers Builds is connected to this repo, so every push to `main` builds (`bun run build`) and deploys (`bunx wrangler deploy`). To deploy by hand, run `bun run build && bunx wrangler deploy`. Assets use relative paths (`base: './'`), so the build also works from a sub-path.

The service worker precaches every build asset, so the game works offline after the first load. Google Fonts are cached at runtime; without them the UI falls back to system fonts.

## PWA icons

`public/icon.svg` is the source icon. Regenerate the PNGs and `favicon.ico` with `bunx pwa-assets-generator` (configured in `pwa-assets.config.ts`).
