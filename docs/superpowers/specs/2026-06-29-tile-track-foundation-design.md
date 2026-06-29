# PCB TD — Milestone T0: Tile-Based Track Foundation

Status: **Draft for review**
Date: 2026-06-29

## Goal
Replace ad-hoc polyline path generation with a **tile-based track** that is the single source
of truth for the enemy path: a coarse grid of typed tiles (straight / corner / fork / bridge /
start / finish / empty) whose ports must match neighbors, guaranteeing a connected, dead-end-free
path **by construction**. Tiles **compile** to the existing runtime contract — `paths: Trace[]`
(centerline polylines) + tower `spots` — so all downstream code (render, decor, and the planned
gameplay) consumes the same contract unchanged. This is the foundation the gameplay (G1) and the
smart-placement optimizer (G2) build on, chosen *before* gameplay to avoid reworking the generator.

## Why now (fit to end goal)
End goal = production game with tile fields + conditional crossings + waves + smart tower
management. Gameplay logic is decoupled (needs only routes+spots), so it survives a tile switch;
the **generator/authoring** is the part that would otherwise be rewritten. Building the tile model
first means the generator is tile-native once and gameplay is built on the stable contract.

## Tile model

### Grid
- A coarse **tile grid** overlays the existing fine cell grid. `tileSize = 6` fine cells per tile.
- `tcols = floor(board.cols / tileSize)`, `trows = floor(board.rows / tileSize)`.
- Tile `(tc, tr)` covers fine cells; its **center** in fine cells is
  `[tc*tileSize + tileSize/2, tr*tileSize + tileSize/2]`. Render/decor stay in fine-cell px.

### Tile types + ports (orthogonal)
- `type Port = 'N' | 'E' | 'S' | 'W'`
- `type TileType = 'straight' | 'corner' | 'fork' | 'bridge' | 'start' | 'finish' | 'empty'`
- `interface Tile { type: TileType; rot: 0|90|180|270; forkRule?: 'split5050'|'byType'|'timer'|'membrane' }`
- **Canonical ports (rot 0), rotated clockwise by `rot` (N→E→S→W):**
  - `straight`: `[N, S]`
  - `corner`: `[N, E]` (rendered rounded / 45°-chamfered = the octilinear look)
  - `fork`: `[W, E, S]` (a T-junction; serves both split and merge — see compiler)
  - `bridge`: `[N, E, S, W]` as **two independent through-routes** (N↔S and E↔W do NOT connect — over/under crossing)
  - `start`: `[N]` (spawn; 1 port) · `finish`: `[N]` (base; 1 port)
  - `empty`: `[]` (no path; decor fills)
- **Connectivity rule:** for every shared edge between adjacent tiles, either both expose the
  matching port or both do not. The generator guarantees this; the editor validates it.
- True diagonal tile-to-tile routing is intentionally NOT supported (4-port only); the 45° look is
  a render style of `corner`.

### Fork logic (data only in T0)
`fork.forkRule` defaults to `'split5050'`. Other values (`byType`/`timer`/`membrane`) are stored in
the format for the future game to interpret; T0 only emits the route geometry and tags the rule.

## Compiler: tiles → routes + spots (`src/tiles/compile.ts`)
- `tilePorts(tile): Port[]` — canonical ports rotated by `rot`.
- `compileRoutes(grid): Trace[]` — from each `start` tile, walk tile→tile following matched ports to
  a `finish`, emitting fine-cell waypoints (tile centers; corner tiles bend at center). At a `fork`,
  branch into multiple routes (one per outgoing port). At a `bridge`, a route entering one port exits
  the **opposite** port (the two axes are independent). Returns one `Trace` per distinct
  start→finish route. Octilinear by construction (tile centers are axis-aligned neighbors);
  `octilinearize` + `filletPath` render it.
- `tileSpots(grid, board, routes): { spots, specialSpots }` — derive candidate tower-spot cells from
  tile geometry (cells adjacent to `corner`/`fork` tiles get a placement bonus), then run the existing
  coverage-greedy `computeTowerSpots` over the compiled routes with that bonus; guarantee
  `>= minSpots(difficulty)` via the existing relax-retry.
- Validation: `compileRoutes` ignores unmatched/dangling ports (no route through them) so a malformed
  hand-edited grid degrades gracefully rather than throwing.

## Generator: archetype → tile layout (`src/tiles/generator.ts`)
Replaces the polyline archetype builders as the source of truth. Each archetype becomes a
**tile-placement strategy** that writes a `TileGrid` (then compiled to routes+spots+decor):
- `serpentineH/V`: rows/cols of `straight` tiles joined by `corner` tiles at lane ends.
- `spiral`: concentric ring of `straight`+`corner` tiles inward to a center `finish`.
- `branching`: `start` → `fork` → two straight/corner branches → `fork` (merge) → `finish`.
- `multiSpawn`: N `start` tiles → straights/corners → `fork` merges → one `finish` (N by difficulty).
- `cross`: two routes crossing through a `bridge` tile.
Connectivity guaranteed by laying matched-port tile chains. `generateLevel({board,difficulty,seed,archetype?})`
builds the grid, compiles routes+spots, grows decor, sets `level.tiles` + derived `paths`/`spots`.

## Editor: tile palette (`src/editor/TilePalette.ts` + wiring)
- Palette of tile types; select a type, click a tile cell to place it; `R` rotates the hovered/last tile.
- On any tile edit, recompile → update `paths`/`spots`/decor (debounced), redraw.
- Keep **Auto-Generate** (archetype tile layout) and Save/Load (now persists `tiles`).
- The existing freehand polyline draw-trace stays available as a legacy authoring mode during the
  transition but is secondary; tiles are the primary model.

## Render
`compileRoutes` yields `paths: Trace[]` → existing `TraceLayer`/render draws them unchanged. Optionally
draw a faint tile-grid guide in the editor overlay. `bridge` renders the crossing with an over/under
gap on one axis so it reads as a real crossing, not a merge.

## Format / model (`src/model/level.ts`)
- Add `tiles?: TileGrid` to `Level` (`interface TileGrid { tileSize: number; tcols: number; trows: number; tiles: Tile[] }`, row-major).
- `tiles` is the **source of truth**; `paths`/`spots` are **derived** and stored (runtime + back-compat).
  Editor/generator recompile on edit. JSON round-trip preserves `tiles`.
- `levelPaths()` unchanged (reads `paths`). Gameplay/render contract unchanged.

## Testing (Vitest)
- `tilePorts`: rotation maps canonical ports correctly for each type/rot.
- connectivity: matched ports between neighbors detected; mismatches rejected.
- `compileRoutes`: straight/corner emit a connected octilinear route; `fork` → 2 routes sharing the
  trunk; `bridge` → 2 independent routes that cross but don't merge; `start`→`finish` terminates.
- `tileSpots`: spots ≥ `minSpots`; corner/fork cells favored.
- generator: each archetype over 100 seeds → `level.tiles` compiles to ≥1 route, every route
  connected + octilinear, spots ≥ minSpots; deterministic per seed.
- JSON round-trip preserves `tiles` and derived `paths`/`spots`.

## Out of scope (later milestones)
- Gameplay (enemies/towers/combat/waves/economy) — Milestone G1, built on the routes+spots contract.
- Fork runtime behavior (by-type/timer/membrane) — data only here; implemented with gameplay.
- Smart-placement optimizer with Monte-Carlo balance — Milestone G2.
- Production polish (audio, save-progress, real art) — later.

## Open questions
None blocking. Bridge over/under render style tuned during implementation.
