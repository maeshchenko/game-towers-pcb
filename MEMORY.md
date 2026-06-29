# MEMORY — PCB Tower Defense

Single source of project notes/decisions. Everything persistent goes here (see AGENTS.md).

## Product
PCB/circuit-board-styled **2D tower-defense game**. Visual target: **1:1 with the reference image** (dark-green substrate; multi-stroke glowing octilinear traces with rounded corners; gold build-spot brackets; cyan special octagons; green START / red FINISH pads; realistic procedural PCB decor).

## Stack
Pixi.js v8 (WebGL2) + TypeScript (strict) + Vite + Vitest. **True-2D**; depth is faked via 2D shading (bevel/shadow/specular/AO/glow) — no 3D engine. `tsc` has `noEmit` (vite bundles); never let `.js` get emitted into `src/`/`tests/`.

## Commit rules (STRICT)
Commits in **Russian**, short, clear. **Never** mention AI/Claude/Opus/neural nets — not in the message, not in trailers. No `Co-Authored-By`, no AI/session trailers. (User controls git; don't propose commits/pushes.)

## Reference repo (reusable logic)
`/Users/rabota/Study/tower-defence-game` (note the "defenCe" spelling). 3D Babylon.js — rendering NOT reusable, but theme-agnostic logic ported to 2D: `sim/balance.ts` coverage/pathSamples → spots; `world/Decor.ts` PRNG+greedy placement → decor; `sim/config.ts` difficulty curves; `enemies/{EnemyTypes,WaveManager}.ts`, `towers/{TowerTypes,Tower,TowerManager}.ts` → G1 gameplay.

## Architecture
- `src/geom/` grid/vec, octilinear, fillet, sampling, A* router.
- `src/model/level.ts` `Level` (board, trace, **paths: Trace[]**, spots, specialSpots, decor, nets, copper, **tiles?: TileGrid**, meta). `levelPaths(level)` = paths ?? [trace].
- `src/pipeline/` spots (coverage-greedy; **`minSpots` lives here**, re-exported from generator), decor (functional PCB blocks + nets), copper (routes traces between pads), generator (`generateLevel` — now tile-based), rng.
- `src/tiles/` (T0): types/ports/layout/compile/spots/generator. Tiles compile to `paths`+`spots`.
- `src/render/` Pixi layers (board+hatch, copper, decor, trace, spot, game, overlay), Camera, builders.
- `src/editor/`, `src/ui/`.

## Tile model (T0)
Coarse tile grid over fine cells, **tileSize=6**. Tiles: `straight/corner/fork/bridge/start/finish/empty`, orthogonal ports (N/E/S/W), 45° is a render style of `corner`. Ports matched between neighbors → **connectivity by construction**. `compileRoutes` walks start→finish emitting tile-center waypoints; fork branches; bridge = independent crossing (opposite-port exit). Compiler uses a per-walk visited-set (cycle-safe for hand-edited grids).

### HARD INVARIANT — one finish
**Every archetype routes ALL paths to ONE shared FINISH cell** (one base to defend). Multi-route archetypes (branching, multiSpawn, cross) converge via `fork` tiles used as merges before the finish. Enforced by a generator test (per archetype/seed: all paths share the last waypoint).

### Archetypes (tile layouts)
serpentineH/V, spiral, branching (split→merge→one finish), multiSpawn (N spawns → collector spine → one finish), cross (two spawns cross at a bridge → merge → one finish). Selected by seed/difficulty.

## Milestone order (locked)
1. **Map editor + generator + 1:1 PCB decor** — DONE (functional circuit blocks + copper traces between pads, subtle vias, 4 mounting holes).
2. **T0 tile-track foundation** — IN PROGRESS. Done: model→ports→layout→compile→spots→generator (all archetypes, one-finish invariant). Remaining: bridge over/under render, tile editor palette, save/load tiles.
3. **G1 gameplay** — enemies/waves/towers/combat/economy/UI on the `paths`+`spots` contract. Spec+plan: `docs/superpowers/{specs,plans}/2026-06-29-pcb-td-gameplay-g1*`.
4. **G2 smart tower placement / balance** — DONE (core). `src/game/sim.ts` = headless combat auto-playtester (`basicPlacement` builds+upgrades, `simulate` runs all waves → `{won, pressure}`). `src/game/balance.ts` `generateBalancedLevel` re-rolls seeds until a level is winnable + pressure in [0.15,0.65] (target 0.4); tags `meta.balance`. Auto-Generate uses it. Measured: difficulty 5 ≈ 0.49 pressure, basic defense wins ~8/8.
5. **Production polish** — balance tuning, audio, save-progress, real art (towers/enemies are simple shapes now), finish T0 (tile editor/save-load).

**Generator robustness (fixed):** `generateLevel` must NEVER throw. Spiral is a connected turtle (not concentric rings); branching/multiSpawn/cross fall back to serpentineH on too-small grids. Regression test covers 4 boards × 6 archetypes × difficulties (`tests/tiles/generator.test.ts`).

## Docs
Specs/plans under `docs/superpowers/{specs,plans}/`; TD-map taxonomy + PCB-realism research under `docs/research/` and `.superpowers/sdd/` (gitignored scratch: briefs, reports, progress ledger).

## Gotchas
- Background `Agent` (subagent) calls have HUNG (one stalled ~28 min, empty output). If a subagent's output file doesn't grow for minutes, `TaskStop` it and do the work inline.
- `.superpowers/` is gitignored (ledger/briefs/reports live there).
