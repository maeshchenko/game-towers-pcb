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
- `src/editor/`, `src/ui/`. `src/ui/i18n.ts` обеспечивает перевод (RU/EN) интерфейса, настроек, описаний и подсказок обучения.


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
5. **Presentation pass (visual hero + UX)** — DONE (core). Trace is the visual hero (thick multi-lane glowing ribbon; decor darker/fewer/bigger). Vintage through-hole decor set. Reproducible seed tracks. Routes split editor vs game. See "Game presentation / UX" below.
6. **Production polish** — balance tuning, audio, save-progress, real art (enemies are simple neon tokens now), finish T0 (tile editor/save-load), top-HUD restructure to ref (LEVEL/WAVE/LIVES/CREDITS row + transport).

## Game presentation / UX (current)
- **Routes:** `/` = game, plays immediately on a fresh random level (difficulty climbs `DIFFICULTY_RAMP=[1,2,4,5,7,8,9]` per "Новая карта"). `/editor` = level editor. Vite dev middleware appends trailing slash for `/kit`, `/kit2`, `/editor`. `/kit` (archive) and `/kit2` (component library) are static pages.
- **Reproducible tracks:** `generateBalancedLevel({board,difficulty,seed})` is deterministic. Track code = `COLSxROWS.DIFF.SEED`, shown bottom-right (`.pcb-seed`, copyable) and written to URL `?t=...` via `history.replaceState`. Opening same URL reproduces the track. Parsed by `/^(\d+)x(\d+)\.(\d+)\.(\d+)$/`.
- **Sizes:** `MAP_PRESETS` (`src/app/viewport.ts`) S 24×18, M 32×24, L 44×33, XL 60×45. Fixed `PITCH_PX=30` → bigger board = bigger track + more turns/spots.
- **Camera framing (`frameLevel` in `main.ts`):** DYNAMIC fit-to-area. Fits path bbox (+`pitch*1.2` pad) into the free rectangle with UI margins `mL=180`(legend) `mR=24` `mT=56`(mode-bar) `mB=88`(HUD), `0.97` fill, zoom clamped `[0.2,4]`. Tidy at every preset (verified S and XL): trace centered, legend never covers it, no overflow/empty-margin. **Do not** revert to fixed zoom — that broke small (tiny+empty) and XL (overflow+legend overlap).
- **Pan:** drag canvas to pan (`pointerdown`→`pointermove` if moved >4px); a click without drag builds/selects. `editor.enabled=false` in play so canvas drag pans (no freehand trace).
- **Spots & towers (linked sizes):** build spot = gold bracket+crosshair+glow plate, half-size `max(11,pitch*0.62)`. Special spot = cyan octagon, gives boost `k=1.35` to range+damage+aura (`Tower.update`). Tower = navy IC chip + gold pin rows + neon function icon, size `max(11,pitch*0.55)` (fits the bracket); small substrate mask hides bracket under chip without covering the path; special tower wears a cyan octagon badge.
- **Decor:** vintage through-hole top-down set (`src/render/vintageDecor.ts`), mapped from SMD kinds via `VINTAGE_MAP` in `Renderer.ts`. Functional blocks (`pipeline/circuits.ts`) placed in free space and linked into ONE network via MST output→input (`pipeline/decor.ts` §5). `vintageLeadEnds`/`vintagePins` must stay index-aligned.
- **kit2** (`src/kit2.ts`): 4 sections — (1) component library, (2) pairwise channel-routed connections (head-on pad entry, no crossings), (3) compact hand-laid board, (4) 20 large circuits.
- **kit2 routing/styling conventions**: traces are routed pad-to-pad (from exact lead end positions) using `routeOctilinear` and smoothed via `filletPathPixels` to turn at 45° and follow realistic PCB channels without body overlaps. Components include high-fidelity visual features like LED leadframes, cylindrical reflections on axial parts, and printed value/part labels.

**Generator robustness (fixed):** `generateLevel` must NEVER throw. Spiral is a connected turtle (not concentric rings); branching/multiSpawn/cross fall back to serpentineH on too-small grids. Regression test covers 4 boards × 6 archetypes × difficulties (`tests/tiles/generator.test.ts`).

## Handcrafted campaign levels (`src/levels/`)
The 12 campaign levels are **hand-authored**, not seed-generated. `dsl.ts` `LevelBuilder` composes path(s) + build/special spots + decor blocks (`pipeline/circuits.ts`) + wires; `build()` enforces the one-finish invariant; copper via `routeCopper`. `campaign/level01..12.ts` build each; `index.ts` exports `AUTHORED_LEVELS`. `campaign.ts` attaches `build` fns to `CAMPAIGN_LEVELS` by index; `main.ts:loadAuthoredOrGenerated` loads the authored `Level` when present, else falls back to the generator. **Deep-link `?t=authored-N`** (boot parses it; the app also writes it on load). Tests: `tests/levels/{dsl,authored,_harness}.test.ts` (one-finish + copper-on-pads + winnable per level).
- **Tower spots = PRIMARY**, decor = secondary. `b.autoSpots(budget)` → `computeTowerSpots` (coverage-greedy), enhanced with: `pathGap` (dilate path → pads keep a gap from the trace, never touch/cross it), `occupied` (exclude decor footprints +gap), `candidateCells` whitelist; spots carry a coverage `score`. `patrolSpots` (neat lane-hugging even rows, count/spacing-driven) also exists but `autoSpots` is what ships (proven winnable). Lvl 2/3/8 use `patrolSpots({spacing})` to thin the pad field (see cliff gotcha).
- **Decor is HIDDEN:** `SHOW_DECOR=false` in `Renderer.ts` skips decor+copper draw (focus = trace + towers). Decor data still builds (tests stay green). Substrate reverted to the pre-"gemini" look: silk cell grid + 45° hatch + simple via dots (the minimal/empty board read worse).
- `LevelBuilder.fillBlocks` exists (validated placement: footprint keeps a gap from path + other decor) for re-enabling decor *around* the spots later.

## Per-map balance optimizer (`scripts/balance-optimize.ts`, `npm run balance:optimize`)
Mine, pcb-specific (NOT the reference repo's). Runs the real pcb sim (`game/sim.ts:simulate`) per authored level and **sweeps the per-map enemy-HP knob `meta.tune.hpMul`** (declared in `model/level.ts`, applied in `Game.ts`) to hit a difficulty-ramped target pressure (gentle tutorial → tense finale). It recommends; bake `hpMul` into each level's meta by hand. Runs via `vitest.scripts.config.ts` (separate include = `scripts/**`). Re-run after changing levels / tower / enemy numbers.
- Reference defense `basicPlacement` now builds **best-coverage spots first** (`Game.buildOrder()` ordered by spot `score`) = a competent player, not arbitrary order.
- Balance numbers were tuned in the reference sim (`tower-defence-game/src/sim/config.ts`). Only the **tesla/mortar buffs** ported to pcb (kills cannon's near-monopoly; test-safe because the reference defense only builds cannon). cannon-cost↑ / armor↑ / economy-tighten did **NOT** port — they make pcb's hard levels unwinnable (pcb is already at its difficulty ceiling; the two projects have different map economies).

## Tutorial / build-menu UX
- **Build radial:** affordability re-evaluated live each frame (`GameUI.refreshRadialAffordability`) so gold earned mid-menu unlocks chips without re-opening; dim **backdrop scrim** (`.pcb-radial-backdrop`, z90 — dims board, not the top HUD) so the menu reads as a modal; item tooltips suppressed during the tutorial.
- **Tower sell** = two-click confirm + a fixed disabled "МАКС" slot holding the Upgrade position (so Sell never jumps under the cursor on a max-upgrade → no accidental sell).
- **Enemy intros only on level 1** (`activeCampaignLevelIndex===0`); later levels never pause.
- **Level # label** decoupled from wave number (`GameUI.setLevelNumber`, set on load) — it's the campaign level, fixed for all 10 waves. Wave shows separately ("ВОЛНА X/10").
- **Tutorial camera frozen** (no zoom/pan while a spot is highlighted) via a **capture-phase wheel/pointer blocker in `GameUI`** keyed on `.pcb-tutorial-bubble` visibility (DOM-detected) — see HMR gotcha. Tutorial bubble offset 150px clear of the radial ring.
- **Names consistent:** the upgrade panel uses the themed name (`TOWER_THEMES[kind].name` = PULSE/MISSILE/LASER/…), matching the build menu (was the raw `kind`).
- **Trackpad zoom:** proportional to scroll delta with a separate gentle path for pinch (`ctrlKey`) — replaced the fixed ±15%/event that avalanched on a trackpad's high-frequency deltas; wheel feel preserved.
- **`frameLevel` fits path AND spots** (spot cells added to the bbox so pads never clip off-screen) and is tighter (pad `pitch*0.4`, fill `0.99`, margins `mL=156 mR=24 mT=56 mB=64`) so large boards fill more screen while everything stays in frame.
- **Mobile Orientation & Input Translation:** If portrait viewport (`width < height`), `#game-container` is rotated 90 degrees clockwise using CSS transforms and set to swapped `height x width`. Pointer coordinates are mathematically mapped back to the horizontal workspace on capture phase. `app.canvas.getBoundingClientRect` is overridden to return `{ left: 0, top: 0, width: logicalW, height: logicalH }` for pixel calculations.
- **Mobile Responsive Layout:** On widths < 800px, `.pcb-legend` and `.pcb-tips` are hidden, and `frameLevel` margins adjust (`mL = 16px` instead of `156px`), maximizing canvas size. Top HUD buttons are compacted, `.pcb-towerpanel` moves to bottom-right, and radial build menus are scaled `0.85x`. Settings/bestiary/intro cards clamp to `90%` max-width.
- **Radial Menu Scrim Backdrop:** The radial menu backdrop (`.pcb-radial-backdrop`) has `pointer-events: auto` when open and captures `pointerdown` to call `closeRadialMenu()`. This blocks clicks from hitting underlying game elements while providing a reliable way to dismiss the menu by tapping/clicking anywhere outside of it on both mobile and desktop viewports.

## Docs
Specs/plans under `docs/superpowers/{specs,plans}/`; TD-map taxonomy + PCB-realism research under `docs/research/` and `.superpowers/sdd/` (gitignored scratch: briefs, reports, progress ledger).

## Challenge & Balance Overhaul (G2)
- **Enemy Special Abilities**:
  - **Regenerator (`healer`)**: Periodic AoE healing in a `2.5`-cell radius at `(15 + target.maxHp * 0.03) * dt` per second. Excludes healing itself. Visually highlighted with a pulsing green ring.
  - **Glitch (`rogue`)**: Moves erratically by fluctuating between `0.3x` and `2.2x` of base speed every `0.6s`. Direct counter: slowed state (from **SLOW** tower aura) stabilizes speed to a constant `slowFactor`.
  - **Boss (`boss`)**: Completely immune to slow effects (`slowFactor = 1`).
- **Tower Stats & Upgrade Economy**:
  - **Cannon**: Cheap, robust single-target damage. Upgrade cost ramps 40 -> 60 -> 90; L3 damage is 45.
  - **Slow**: Aura slow (0 damage). Range and slow factors scale 35 ($35, 60% slow) -> 45 ($55, 55% slow) -> 5.0 ($80, 70% slow).
  - **Sniper**: High armor piercing, massive single-target burst. L3 pierce is 999, damage 300, cost 180.
  - **Mortar**: Heavy AoE splash. Scales range/splash/damage up to L3 cost 160, 115 damage, 3.5 splash.
  - **Tesla**: Multi-target chain lightning. Scales chain range/count/damage up to L3 cost 125, 40 damage.
  - **Upgrade Costs**: Made significantly more expensive to force a deliberate decision between placing new towers vs. upgrading.
- **Wave Pacing (Sawtooth Pattern)**:
  - Rewrote wave generator to introduce armored Tanks at wave 3 and Healers at wave 4.
  - Designed distinct wave challenges (speed, armor, healing, swarms, synergy tests) rather than a linear difficulty increase.
- **Campaign HP Balancing**: All 12 level `hpMul` multipliers retuned deterministically using `balance-optimize` and saved back into level files. Calibrated hpMul array: `[1.40, 1.25, 0.75, 1.90, 2.65, 1.00, 1.20, 1.10, 1.30, 1.90, 1.05, 2.00]`.
- **Reference Defense Strategy**: Upgraded `basicPlacement` in `sim.ts` to build a competent multi-tower setup (Sniper/Mortar on special spots, balanced 20/20/20/20/20 mix of Slow/Tesla/Mortar/Sniper/Cannon on regular spots).

## Gotchas
- Background `Agent` (subagent) calls have HUNG (one stalled ~28 min, empty output). If a subagent's output file doesn't grow for minutes, `TaskStop` it and do the work inline.
- `.superpowers/` is gitignored (ledger/briefs/reports live there).
- **Laser freeze at wave end**: В игровом цикле `Game.tick(dt)` проверка `phase !== 'wave'` выходила из метода до уменьшения времени жизни графических эффектов выстрелов `_fx`. Из-за этого последние лазерные выстрелы башен в волне зависали в воздухе при переходе в фазу `build`. Решение: уменьшение TTL выстрелов вынесено на самый верх метода `tick` до проверки фазы.
- **Semicolon parsing gotcha**: В JS/TS выражение `(something)` на новой строке парсится как вызов функции от предыдущей строки, если там нет точки с запятой. Всегда ставьте `;` перед круглыми скобками на новой строке (например, перед вызовом замыканий кнопок после `appendChild`).
- **Справочник сигналов (Бестиарий) и Интро врагов**: Кнопка `📖` в HUD и `🔍 БЕСТИАРИЙ` в меню Кампании открывают окно со всеми врагами и их слабостями. При первом появлении на поле боя нового типа врага, игра ставится на паузу (`speed = 0`), камера зумируется на враге и выводится попап-карточка. Для защиты от бесконечного спама окон на тике используется `introducingEnemies` блокирующее множество.
- **Инварианты запуска волн**: Первая волна любого уровня запускается ТОЛЬКО вручную. Отсчет автоволн (5 секунд) включается начиная со 2-й волны. Досрочный запуск волн дает бонус `оставшиеся_секунды * 3` энергии с летящим текстом `+15 ⚡`.
- **Язык и Подсказки**: Русский язык является дефолтным (`i18n.lang = 'ru'`). Блок подсказок слева внизу прокручивается автоматически каждые 8 секунд или вручную стрелками. Таймер сбрасывается при ручном переключении.
- **HMR НЕ перезапускает `main.ts` (entry-модуль)**: Vite горячо подменяет компоненты/CSS (`GameUI.ts`, `styles.css`), но обработчики и состояние внутри `main.ts` (boot-замыкание) живут до ПОЛНОЙ перезагрузки страницы. Симптом: правка в `main.ts` «не применяется» в открытой вкладке. → Кросс-cutting input-обработчики (напр. заморозка зума в туториале) клади в hot-reloadable модуль (`GameUI`), а состояние детектируй по DOM. Зум-фриз туториала = capture-phase blocker в `GameUI`, который смотрит на видимость `.pcb-tutorial-bubble`.
- **Обилие площадок → «обрыв» сложности**: эталонная пушечная защита держит полностью покрытую трассу идеально, потом резко рушится — нет плавного градиента давления, поэтому `hpMul` не может настроить напряжение на таких картах. Решение: МЕНЬШЕ площадок (`patrolSpots({spacing})` на lvl 2/3/8) возвращает градиент.
- **Балансный сим немонотонен**: БОЛЬШЕ башен может ПРОИГРАТЬ — защита, ограниченная золотом, строит площадки по порядку до конца денег, поэтому ПОРЯДОК постройки (от спавна / по лучшему покрытию) важен не меньше количества. Не гонись за симом, добавляя площадки.
- **Числа сима не переносятся 1:1 в pcb**: карты/экономика эталонного репо отличаются; настраивай pcb по его собственному тесту (`tests/levels/authored.test.ts`: проходимо + давление в полосе), а не по абсолютным числам сима.



