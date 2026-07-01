# Handcrafted Campaign Levels — Design Spec

Status: Design (approved, pre-plan)
Date: 2026-06-30

## Context / problem

The 12 campaign levels are currently produced by `generateBalancedLevel(seed)` (`src/main.ts:315`
via `makeLevel`). They feel generic, and the procedural background wiring (`pipeline/decor.ts` MST +
`pipeline/copper.ts`) routes copper that does NOT lead from component to component — teardrops/traces
dangle into empty space (user screenshot). The user wants **12 hand-authored levels**: beautiful
custom TD fields that get more interesting level to level, with **hand-built, properly-wired decor**.
Not the generator — by hand, exactly 12, one after another.

Decisions locked with the user:
- **Authoring format:** code builders (TypeScript DSL), not editor-JSON.
- **Path forms:** mix all of — winding serpentine, branch & merge, multi-spawn, crossings/bridges,
  plus *light* maze elements (choke gates, not full mazes). Escalate across the 12.
- **`drawRoutingWeb` stays** (user likes the faint via↔via background texture).
- Honest pad-to-pad wiring is required (fixes the dangling-copper bug).

## Design grounding (from `docs/research/td-map-design.md`, verified ✓ principles)

- **More turns = easier** (tower range covers more path tiles); straight = harder; longer = easier
  (reaction time). Tune difficulty via shape, not just length.
- **Hairpin / U-turn double-coverage** (two parallel runs ≤ 2× tower range apart) = strongest spot.
- **Pacing zones:** open near spawn (0–25%) → first choke (25–50%) → kill-zone (50–75%) → cleanup.
- START/FINISH on opposite edges/corners; 2–3 competing high-value spots; fits one screen.
- **Spot tiers:** S = hairpin fold, A = inside 90°/45° corner, B = beside a choke, C = open straight.
- **HARD INVARIANT (existing):** every level has exactly ONE finish; all paths converge to it.

## Part A — Authoring architecture

### A1. New `src/levels/` module (the DSL)
- `src/levels/dsl.ts` — `LevelBuilder`, a framework-free fluent builder:
  - `path(waypoints: Cell[])` — add an enemy path (`Trace`, cornerRadius from `RENDER`). Multiple
    `path()` calls = multi-spawn; the builder asserts all paths share the same LAST waypoint (finish).
  - `buildSpot(cell)` / `specialSpot(cell)` — push a `TowerSpot` (kind `build`/`special`).
  - `block(name, cell, rot?)` — place a circuit block from `pipeline/circuits.ts` (e.g. `powerSupply`,
    `mcuCore`, `opAmp`, `transistorSwitch`, `ledBar`, `timer555`, `amplifierStage`, `passiveBank`)
    translated to `DecorItem[]` + local nets, offset to `cell`. Re-bases net indices by the global
    decor offset (same pattern as `pipeline/decor.ts:mergeBlock`).
  - `part(kind, cell, rot?, opts?)` — place a single vintage part (for accents) as one `DecorItem`.
  - `build(): Level` — assembles `Level` (version 1, board, seed, trace=paths[0], paths, spots,
    specialSpots, decor, nets, copper via blockRoute, meta). Validates the one-finish invariant.
- `src/levels/campaign/level01.ts` … `level12.ts` — one builder fn each: `(board) => Level` (or a
  fixed board inside). `src/levels/index.ts` — `AUTHORED_LEVELS: ((board?) => Level)[]` length 12.

### A2. Reuse existing pad-to-pad router — `src/pipeline/copper.ts:routeCopper`
`routeCopper(level)` already routes `nets` (decor-index lists) into `Copper[]` on a 2× grid using
`vintageLeadEnds`/`VFOOT`, per-kind body + path keep-out, escape dirs, and `routeOctilinear` — every
copper polyline's endpoints land on real pads. So the DSL does NOT need a new module: `.build()`
assembles `decor` + `nets` and calls `routeCopper({ decor, nets, board, trace, paths })` to populate
`Level.copper`. The game renders it via the existing `Renderer.drawCopper` + `copperStyle`.

The dangling copper in the user screenshot came from a GENERATED level: `pipeline/decor.ts`'s MST fed
long inter-block nets and my `bestD ≤ 18` skip plus the brighter copper exposed escape stubs. Authored
levels avoid this by construction — connected parts are placed adjacent and only short, local nets are
wired (intra-block nets from `circuits.ts` + short hand-added links). `kit2.ts` keeps its own pixel
router (different coordinate system) — out of scope to refactor.

### A3. Campaign integration — `src/game/campaign.ts` + `src/main.ts`
- `CampaignLevelDef` gains `build?: (board: Board) => Level`. Wire each of the 12 to
  `AUTHORED_LEVELS[i]`.
- `main.ts`: add `loadAuthoredOrGenerated(index)` — if `CAMPAIGN_LEVELS[index].build` exists, load
  the authored `Level` directly (`editor.state.loadLevel(...)`, `frameLevel()`, set name/`?t=` to a
  stable `authored-NN` code); else fall back to `makeLevel(seed)`. Replace the campaign call sites
  (`main.ts:315`, and next/restart at ~`619/625/660`). `/editor`, "Новая карта", and `?t=COLSxROWS…`
  keep using `makeLevel`/generator unchanged.

### A4. Generator dangling-teardrop fix (small)
In `Renderer.drawCopper`, only emit the endpoint `teardrop` when `getPadPixel` actually resolved the
endpoint to a real pad (skip the teardrop for unresolved endpoints). Keeps the random/`?t=` boards
clean too. `drawRoutingWeb` unchanged.

## Part B — The 12-level arc

Names + board sizes reuse the existing `CAMPAIGN_LEVELS`. Difficulty number feeds waves/HP (existing).
Per research, EASY levels use many gentle turns + length; HARD levels add multi-spawn, choke
kill-zones, crossings, and straighter kill lanes.

| # | Name | Board | Diff | Path form | Hook / decor theme |
|---|------|-------|------|-----------|--------------------|
| 1 | Вводные шины | 24×18 | 1 | gentle serpentine | tutorial, 1 special · supply rails |
| 2 | Поворот ключа | 24×18 | 2 | serpentine + 1 hairpin | first double-coverage spot |
| 3 | Двойной контур | 32×24 | 3 | branch → merge | split defence · two loops |
| 4 | Шунт питания | 32×24 | 4 | serpentine + choke kill-zone | linear PSU block (diode·cap·7805) |
| 5 | Спиральный мост | 32×24 | 5 | inward spiral + 1 bridge | central S-tier spot |
| 6 | Широкая магистраль | 44×33 | 5 | long boustrophedon, pacing zones | 2 specials, wide lanes |
| 7 | Сетка контактов | 44×33 | 6 | branch ×2 + choke gates | light maze elements |
| 8 | Высокое напряжение | 44×33 | 7 | 2 spawns → merge | tesla theme, main spine |
| 9 | Частотный разделитель | 60×45 | 7 | branch → parallel → merge | crystal / oscillator |
| 10 | Многослойный мост | 60×45 | 8 | multiple bridge crossings | multilayer |
| 11 | Критический перегруз | 60×45 | 8 | 3 spawns → spine → finish | dense, MCU support |
| 12 | Финал: Генератор | 60×45 | 9 | spawns + branch + bridge + central spiral kill-zone | generator centrepiece |

Each level: hand-placed spots tiered S/A/B/C, 1–3 special spots, themed decor wired pad-to-pad,
START/FINISH on opposite edges, a clear pacing arc, fits one screen via existing `frameLevel`.

## Part C — Decor, validation, testing

- **Decor by hand:** each builder places circuit blocks + accent parts in the free regions around the
  path (path cells are kept clear), themed to the level name; wired via `blockRoute`. Background
  `drawRoutingWeb` provides the faint via texture.
- **Validation test** `tests/levels/authored.test.ts` — for each of the 12:
  1. exactly ONE finish (all paths share last waypoint);
  2. spot count ≥ a per-tier threshold;
  3. every `copper` polyline's endpoints coincide with a real decor pad (no dangling);
  4. **winnable** via `src/game/sim.ts` (`basicPlacement` + `simulate`) with `pressure` inside a band
     by tier (EASY lower, HARD higher) — the same guarantee `generateBalancedLevel` gives.
- `npm run build` (tsc noEmit + vite) green; `npm test` green; visual screenshot check of each level
  vs `ref-A-board.png` / `ref-B-gameplay.png`.

## Files

- New: `src/levels/dsl.ts`, `src/levels/index.ts`, `src/levels/campaign/level01..12.ts`,
  `tests/levels/authored.test.ts`.
- Edit: `src/game/campaign.ts` (`build?` field), `src/main.ts` (`loadAuthoredOrGenerated` + call
  sites), `src/render/Renderer.ts` (teardrop guard).
- Reuse: `pipeline/copper.ts` (`routeCopper`), `pipeline/circuits.ts`, `render/vintageDecor.ts`,
  `render/copperStyle.ts`, `geom/router.ts`, `model/level.ts`, `game/sim.ts`, `game/balance.ts`.

## Out of scope

- No changes to enemy/tower mechanics, waves, HUD, or the generator's archetypes.
- Generator stays for `/editor`, "Новая карта", and `?t=` codes.
- Tile editor / save-load tiles (separate roadmap item) untouched.

## Implementation order

Infrastructure first (A2 blockRoute → A1 DSL → A3 integration → A4 fix), then author levels 1→12 one
at a time, each: build + the validation test green + visual check, before moving to the next.
