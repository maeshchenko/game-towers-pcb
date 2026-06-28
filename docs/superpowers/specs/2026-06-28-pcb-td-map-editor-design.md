# PCB Tower Defense — Milestone 1: Map Editor + Level Format + Auto-Generator

Status: **Draft for review**
Date: 2026-06-28

## Goal

Build the first deliverable of a PCB/circuit-board-styled 2D Tower Defense game: a
browser-based **map editor** where the user draws a glowing PCB trace (the enemy path)
with the mouse; tower build-spots are then **auto-computed** at coverage-optimal cells;
the board **auto-grows** decorative SVG components (ICs, capacitors, resistors, SMD parts,
pads, vias); and an **auto-generator** produces complete, guaranteed-solvable, good-looking
levels. Output is a versioned **Level JSON** that the future game runtime consumes.

Gameplay (enemies/towers/waves) is **out of scope** for this milestone — see "Out of scope".

### Hard requirement: visual fidelity 1:1 with reference

The on-screen result must match the provided reference image **1:1** in style — dark green
substrate, multi-layer glowing octilinear traces with rounded corners, wide translucent
enemy-path fill with directional chevrons, gold build-spot brackets, cyan special-spot
octagons, green START pad, red FINISH pad, dense realistic decor, and the side panels
(LEGEND / TIPS / LEVEL-info). This is a primary acceptance criterion, not a nice-to-have.

## Decisions (locked with user)

| Topic | Decision |
|---|---|
| Renderer / stack | **Pixi.js v8 (WebGL2)** + TypeScript + Vite — true-2D |
| Depth look | **Fake-3D via 2D shading** (bevel gradients, drop-shadow, specular, AO, blur-glow). No 3D engine — reference is a flat top-down illustration; all its depth is shading, reproducible in 2D |
| First release scope | Editor + Level JSON format + **auto-generator** (no play loop) |
| Trace geometry | **Octilinear** (0/45/90°) with **rounded corners** |
| Map geometry | **Grid with snapping** |
| Pipeline manual/auto | User **draws trace**; spots + decor **auto** (recompute live), tweakable later |
| Path topology | **Single winding path**, START → FINISH |
| Decor source | **Procedural package generator** (1:1 with reference); SVG slots optional later. Revised from "real SVG" after research — see Decor decision |
| Generator router | **A\* on grid with turn/wander cost shaping** (controllable length & bendiness) |

## Reuse from `../tower-defence-game`

That repo is 3D Babylon.js; its rendering is not reusable, but several **theme-agnostic
logic modules** are. Port TS → 2D (`Vec3` → `Vec2`, drop `y`):

- `src/sim/balance.ts`: `pathSamples()`, `coverage()` → spot scoring. `effectiveDamage()`,
  `singleDps()` kept for the later game.
- `src/world/Level.ts` `fromPathStrategic()` (greedy coverage placement) → `computeTowerSpots`.
- `src/world/Decor.ts` seeded splitmix PRNG + greedy collision-checked placement → `growDecor`.
- `src/sim/config.ts` difficulty curves → generator `difficulty` parameter.
- `src/enemies/WaveManager.ts` `mapWaves()` → kept for the later game.

## Architecture

Layered, single Vite app. Each unit has one purpose and a typed interface.

```
src/
  model/      data types + Level (de)serialization
  geom/       grid snap, octilinear constraint, corner fillet, A* router, path sampling
  pipeline/   computeTowerSpots, growDecor, Generator.generateLevel
  render/     Pixi layers (Board, Trace, Spot, Decor, Overlay) + camera
  editor/     tools, toolbar, live-recompute orchestration, save/load
  assets/     SVG component manifest + Pixi texture loader (+ procedural fallback)
  style/      palette + render constants (single source of visual truth)
```

### 1. `model/`

```ts
type Cell = [number, number]            // integer grid coords (col, row)
interface Board { cols: number; rows: number; pitch: number }  // pitch = px per cell
interface Trace { waypoints: Cell[]; cornerRadius: number }    // [0]=START, last=FINISH
interface TowerSpot { cell: Cell; score: number; kind: 'build' | 'special' }
interface DecorItem {
  kind: string                 // 'soic' | 'qfp' | 'dip' | 'smdRes' | 'smdCap' | 'electrolytic' | 'pad' | 'via' | ...
  variant: number              // procedural variant (pin count, size class) — drives the generator
  cell: Cell
  rot: 0|90|180|270
  scale: number
  svg?: string                 // optional curated-art override; absent ⇒ procedural generator
}
interface Level {
  version: 1
  board: Board
  seed: number
  trace: Trace
  spots: TowerSpot[]
  specialSpots: TowerSpot[]
  decor: DecorItem[]
  meta: { name: string; difficulty: number }
}
```

`Level.serialize()` / `Level.parse()` with a version check. JSON round-trip is loss-free.

### 2. `geom/`

- **Octilinear builder** — raw mouse points → grid-snapped vertices → each segment forced
  to a direction in {0/45/90°}; auto-insert an intermediate corner vertex when a freehand
  segment is neither axis- nor diagonal-aligned (split into one axis + one 45° run).
- **Corner fillet** — render-time only: replace each interior vertex with a quadratic/arc
  of radius `cornerRadius * pitch`. Does not alter stored waypoints.
- **A\* router** — 8-direction grid A*. Cost = step + `turnPenalty` (discourage zig-zag) with
  optional `wanderBonus` to lengthen. Used by generator; guarantees a connected octilinear
  path. Avoids re-using occupied cells (no self-crossing).
- **Path sampling** — `pathSamples(trace, step)` dense points along centerline; `coverage(cell,
  range, samples)` count within range. Ports of `balance.ts`.

### 3. `pipeline/`

- `computeTowerSpots(level, budget)` — sample path; for each free non-path candidate cell
  near the path, score = uncovered samples within `range`; greedily pick highest, enforce
  min separation, up to `budget`. Marks a few as `special` (kind === 'special'). Pure
  function of `(trace, board, budget)`.
- `growDecor(level, seed)` — seeded PRNG. For each component kind a placement spec
  (count band, footprint, clearance). Greedy placement in free board area respecting
  trace clearance + spot clearance + other decor. Realistic clustering, 90° rotations.
  Deterministic for a given `(level, seed)`.
- `Generator.generateLevel({ board, difficulty, seed })` — pick START/FINISH on opposite
  edges; A*-route a trace toward a target length/turn-count derived from `difficulty`;
  run `computeTowerSpots` then `growDecor`. **Invariant: the returned Level is always
  solvable** (path connected by construction; `spots.length ≥ minSpots`). Retries with a
  perturbed seed if a soft constraint (length/turns/spot budget) is missed.

### 4. `render/` (Pixi v8) — the 1:1 visual layer

Layers, back to front:

1. `BoardLayer` — dark-green substrate fill + faint silkscreen grid / micro-texture.
2. `TraceLayer` — the wide enemy path: **multi-stroke compositing** to reproduce the
   reference glow — (a) outer soft blur halo, (b) mid translucent green fill band, (c)
   inner bright lane lines, (d) directional **chevrons** animated/static along the path.
   Rounded corners via filleted geometry. START pad (green, ► glyph), FINISH pad (red,
   ■ glyph, red glow). Uses Pixi `Graphics` + a blur/glow filter, batched.
3. `SpotLayer` — gold **build-spot brackets** (corner ticks + center cross), cyan
   **special-spot octagons** with ring.
4. `DecorLayer` — procedurally-drawn package art (chips, SMD parts, pads, vias) with
   **fake-3D shading**: bevel/gradient body, drop-shadow on substrate, specular highlight,
   AO darkening at footprint edges. Drawn under the trace glow where appropriate. Each
   item baked to a Pixi texture (cached per kind+variant) for batch performance.
5. `OverlayLayer` — editor only: snap preview, hover highlight, waypoint handles, grid dots.

Camera: pan (drag/space) + zoom (wheel) with clamp.

Side panels (LEGEND, TIPS, LEVEL/WAVE/LIVES/CURRENCY) are HTML/CSS over the canvas,
styled to match the reference; values are static placeholders this milestone.

### 5. `editor/`

Tools: **Draw Trace** (click to add octilinear vertices, live snap+preview, double-click /
Enter to finish), **Edit** (drag/insert/delete waypoint), **Set START/FINISH**, **Regen
Spots**, **Regen Decor**, **Reseed**.

Toolbar actions: New, **Auto-Generate Level**, Save (download JSON), Load (upload JSON).

Live recompute: editing the trace triggers a **debounced** `computeTowerSpots` + `growDecor`
so the board visibly "grows" as the user draws — matching the user's described workflow.

### 6. `assets/`

Primary path is **procedural package art** (see `pipeline/growDecor` + `render/DecorLayer`):
parametric component generators (`drawSoic`, `drawQfp`, `drawSmdRes`, `drawElectrolytic`,
`drawPad`, `drawVia`, …) bake to cached Pixi textures keyed by `kind+variant`. No external
art is required to hit 1:1.

An optional **SVG override slot** remains: `manifest.ts` maps `kind` → optional SVG file;
if present the loader rasterizes it to a texture, else the procedural generator is used.
This is a future hook for curated hero pieces — not on the M1 critical path. See Asset
Appendix for the (schematic-only) free packs and why they are not the primary source.

### 7. `style/` — single source of visual truth

Palette extracted from the reference image (hex approximate, to be tuned against the PNG):

```ts
export const PALETTE = {
  substrate:      0x0b1611,  // board base, dark green-black
  substrateEdge:  0x0d1f17,  // vignette / panel bg
  silk:           0x1c3a2b,  // faint grid / silkscreen lines
  traceHalo:      0x1f8f4d,  // outer glow
  traceBand:      0x2bd06a,  // mid path fill
  traceCore:      0x6cf2a0,  // bright lane lines
  chevron:        0x8effbe,
  startGreen:     0x35e07a,
  finishRed:      0xe8503a,
  buildGold:      0xe8c84a,
  specialCyan:    0x3fb6d8,
  icBody:         0x14140f,  // chip bodies
  pinSilver:      0x9aa0a0,
  textDim:        0x6f8f7e,
}
```

`RENDER` constants: trace band width, halo blur, core line width, chevron spacing, corner
radius, spot bracket size — all centralized so tuning to 1:1 is a single-file effort.

## Level JSON (the contract)

```json
{
  "version": 1,
  "board": { "cols": 64, "rows": 48, "pitch": 24 },
  "seed": 12345,
  "trace": { "waypoints": [[2,4],[2,20],[30,20],[30,8]], "cornerRadius": 0.5 },
  "spots": [{ "cell": [9,8], "kind": "build", "score": 12 }],
  "specialSpots": [{ "cell": [20,15], "kind": "special", "score": 0 }],
  "decor": [{ "kind": "soic", "variant": 8, "cell": [5,30], "rot": 90, "scale": 1 }],
  "meta": { "name": "Level 05", "difficulty": 5 }
}
```

Board default: **64 × 48 cells @ 24 px** (1536 × 1152 logical), pan/zoom beyond.

## Testing (Vitest)

- octilinear snapping: arbitrary points → only 0/45/90° segments, corners inserted.
- corner fillet: stored waypoints unchanged; rendered geometry continuous.
- A* router: connectivity over 100 random START/FINISH pairs; no self-crossing.
- coverage scoring: known fixture path → expected top cells.
- decor placement: no overlap with path / spots / other decor; determinism per seed.
- Level JSON round-trip: `parse(serialize(x)) deep-equals x`.
- **generator solvability invariant**: 100 seeds → every Level connected START→FINISH
  and `spots.length ≥ minSpots`.

## Out of scope (later specs)

Real gameplay (enemies, towers, projectiles, targeting, waves, economy runtime), campaign
progression, audio, persistence/profiles, multiplayer. The ported logic stubs (`balance`,
`mapWaves`, difficulty curves) are included only insofar as the editor/generator needs them.

## Asset Appendix (from deep-research, all claims 3-0 verified)

### Routing / pathfinding libs
- **PathFinding.js** (MIT) — A*/Dijkstra/BFS/JPS, `allowDiagonal` + `dontCrossCorners`
  → 45° octilinear movement. Best fit for our A* trace router.
  https://github.com/qiao/PathFinding.js
- **tscircuit-autorouter** (MIT) + **tscircuit/autorouting** (MIT) — full PCB autorouters,
  `simple-grid` + `infinite-grid-ijump-astar` solvers. Reference for algorithms; uses its
  own JSON I/O, so adapt rather than depend.
  https://github.com/tscircuit/tscircuit-autorouter · https://github.com/tscircuit/autorouting

### Trace rendering reference
- **PCB-trace-animation** (MIT) — dependency-free canvas-2D animated PCB traces (turns,
  vias, collision-aware grid). Study its multi-color trace + via rendering.
  https://github.com/jackestar/PCB-trace-animation
- **KiCanvas** (TS) — real KiCad board viewer (Canvas/WebGL); reference for layer/copper look.
  https://github.com/theacodes/kicanvas
- **tracespace** (MIT) — Gerber→SVG renderer; reference for copper/silk styling.
- **PCB-Circuit_Generator** — **NO LICENSE (all-rights-reserved)**. Visual reference only,
  do **not** copy code. https://github.com/sch0penheimer/PCB-Circuit_Generator

### Procedural TD generation
- **Red Blob Games — Tower Defense pathfinding** — Dijkstra-map distance field + flow field
  (one goal-rooted search for all enemies). Canonical, adopt for the future game runtime.
  https://www.redblobgames.com/pathfinding/tower-defense/
- **tower-defense-route-gen** — Drunkard random-walk / Dijkstra-Direct / Traveling-Gnome
  detour path generators. Algorithm reference for our generator's bendiness/wander.
  https://github.com/austinmilt/tower-defense-route-gen
- **GA path-existence fitness** (Kraner/Fister/Brezočnik) — guarantee-solvable map idea
  (restart if no start→end path). We get this for free via A* (path connected by
  construction), but the fitness shaping is a useful reference.
- WFC-for-paths and the ACM 4-module PCG architecture: noted, not adopted for M1.

### Engine validation
- **Shirajuki JS rendering benchmark** — Pixi.js 47 FPS vs Phaser 43 FPS @ 10k sprites
  (one low-end machine; relative only). Confirms Pixi.js is a sound choice.

### Decor art (IMPORTANT caveat → see decision below)
Available free packs are **schematic symbols** (resistor zigzags, cap/transistor symbols),
NOT the **top-down SMD/IC package art** the reference shows:
- SchematicSymbolsSVG (MIT) https://github.com/sjgallagher2/SchematicSymbolsSVG
- FreeSVG.org electronic-components (CC0) https://freesvg.org/electronic-components
- Wikimedia "Electrical symbols library.svg" (public domain)
- OpenGameArt CC0: **no** circuit sprites at all.

## Decor decision — REVISED by research

The reference image's decor is **top-down package art** (SOIC/QFP/DIP chip bodies with
pins, SMD resistor/cap rectangles, electrolytic cans, gold pads, vias) — a literal copper
look. The verified free SVG packs are **schematic diagram symbols**, which render the wrong
aesthetic and would break the 1:1 requirement.

**Therefore: primary decor = a procedural package generator** (`growDecor` draws chips,
SMD parts, pads, vias as parametric Pixi `Graphics`/textures using the `style/PALETTE`).
This is the only path to a 1:1 match with full palette/seed control, and it is
self-contained (no asset-license risk). SVG asset slots remain in the loader as an optional
override for hero/detail pieces if curated art appears later. This supersedes the earlier
"real SVG from the start" choice **for the package look**. **Confirmed by user.**

## Open questions

None blocking.
