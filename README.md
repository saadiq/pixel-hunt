# Crumb Hunt

A mobile-first pixel-art puzzle. Tap lanes to send ant squads to holding slots; they run the track around the board and eat the crumbs of their colour. Every deal has at least one winning order. TypeScript, Vite and bun; installable as an offline PWA.

## Commands

| Command | What it does |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Dev server. `/preview.html` is a dev-only page that shows the scenes (it is not part of the production build) |
| `bun test` | Unit tests |
| `bun run lint` | ESLint (max 300 lines per file, 100 per function) |
| `bun run build` | Type-check, then build to `dist/` (includes the service worker and manifest) |
| `bun run validate [id...]` | Solvability and difficulty table for scenes (all scenes, 500 deals each, when no id is given) |
| `bun run build-scenes [id...]` | Turn `scenes/art/<id>.svg` into scene data |
| `bun run export-pngs [id...]` | Export PNG previews of scenes |

## Adding a scene

Scenes come from an SVG pipeline; do not hand-edit the generated TypeScript.

1. Draw `scenes/art/<id>.svg` with `viewBox="0 0 W H"` (one unit per cell) and a `<metadata>` JSON block with: `id`, `name`, `blurb`, `band`, `W`, `H`, `slots`, `lanes`, `chunk`, `wait`, `bg`, and optionally `waitSlack`.
2. Run `bun run build-scenes <id>`.
3. Add the id to `src/scenes/index.ts` and `src/scenes/manifest.ts`.
4. Run `bun run validate <id>` and `bun run export-pngs <id>`.
5. Check the result against the band gates in `scripts/targets.ts`.

Difficulty is about choices, not speed. `validate` reports `choice`, the share of turns where a wrong tap loses the board for a player who waits for the ants to finish, and `mindless`, the win rate of a player who taps any lane whose colour is eatable right now. Easy boards (only the first 5) may have no choices. Medium needs `choice` ≥ 0.12 and Hard needs ≥ 0.17. The main lever is `waitSlack: 1`, which lets the dealer put squads whose colour is still buried into a lane while slots are scarce. Open scenes with little enclosed art produce few choices whatever the params, so give them the Easy band.

Scene rules: at most 9 colours, no colour with fewer than 4 cells, colours visually distinct, recognisable at 64px. Progress is stored by scene id, so ids must stay stable once released.

## Deploying

`bun run build` produces a fully static site in `dist/`. It deploys to Cloudflare Pages as-is: build command `bun run build`, output directory `dist`. Assets use relative paths (`base: './'`), so it also works from a sub-path.

The service worker precaches every build asset, so the game works offline after the first load. Google Fonts are cached at runtime; without them the UI falls back to system fonts.

## PWA icons

`public/icon.svg` is the source icon. Regenerate the PNGs and `favicon.ico` with `bunx pwa-assets-generator` (configured in `pwa-assets.config.ts`).
