# Art Direction — Deep Analysis & Change Plan

Status: Analysis / plan (no code yet)
Date: 2026-06-29
Sources: Ref-A (board mockup), Current (our screenshot), Ref-B (gameplay concept with enemies+towers).

## 1. Intent (what the references say)
- **The enemy path is the hero.** In Ref-A and Ref-B the path is a thick, multi-lane, glowing
  neon ribbon that dominates the frame. Everything else is supporting.
- **Decor is secondary scenery** — moderate-size dark chips at tasteful density, NOT a carpet of
  hundreds of tiny parts.
- **Enemies ride ON the path** as bright neon tokens (Ref-B), not abstract shapes floating beside it.
- **Towers are IC-chips with a distinct neon icon** per type (Ref-B), glowing, with pin rows.
- **Palette is saturated neon** (cyan / magenta / gold / green / red / orange) on near-black green.
- **HUD is a clean top bar** (Ref-B): LEVEL+difficulty, WAVE, LIVES, CREDITS, transport (⏸ ▶ ⏩), menu.
  Left rail = LEGEND + ENEMY TYPES + TOWER TYPES.

## 2. Gap analysis (Ref → Current)

| Element | Reference (A/B) | Current | Gap / fix |
|---|---|---|---|
| **Path width** | Thick band ≈ 2.5–3× a chip; multiple parallel inner lanes; soft outer glow | Thin single tube ≈ 1 cell (~pitch); no lanes | Make band ~2× pitch; draw 3–5 parallel inner conductor lines; stronger glow |
| **Path = focus** | Dominant hero | Recedes; decor dominates | Thicken path + thin/enlarge decor |
| **Corners** | Rounded 45° | Rounded (ok) | Keep |
| **Chevrons** | Subtle, near START/FINISH | Dense along whole path | Keep but lighter; flow dots like Ref-B |
| **Enemies** | Neon tokens on the lanes, glow + faint trail; 6 named types w/ glyphs | Shapes beside path, muted; internal kinds | Re-skin as on-path neon tokens; map kinds→themed types+glyphs+colors |
| **Towers** | IC chip + bright neon icon per type + pin rows; strong glow | Dark chip + tiny accent; small | Bigger chip, per-type neon icon, pin rows, glow; theme to 5 (+2 later) |
| **Build pads (empty)** | Dashed cyan square + crosshair | Small gold corner brackets | Dashed neon square + center crosshair, larger |
| **Special spot** | Cyan octagon + dot, glow | Cyan octagon (ok, small) | Keep, enlarge + glow |
| **START/FINISH** | Rounded pad, ▶ / ■ glyph, strong glow, chevrons | Square bracket + glyph, modest | Rounded glowing pad + glyph + lead-in chevrons |
| **HUD** | Top bar: LEVEL/HARD, WAVE x/N, LIVES❤, CREDITS⚡, ⏸▶⏩, ≡ | Bottom game bar + stale top-right panel | Move to top bar, add difficulty, transport icons, menu |
| **Legend** | Left rail: LEGEND + ENEMY TYPES + TOWER TYPES w/ glyphs | LEGEND only (editor) | Left rail with the three sections + glyph swatches (play mode) |
| **Decor density** | ~30–50 moderate dark chips | Hundreds of tiny parts | Cut count ~50–60%, enlarge footprints, darken (recede) |
| **Palette** | Saturated neon glows | Muted greens, low glow | Brighten path/tokens/icons; add per-type neon hues |

## 3. Target visual spec (concrete)

### Palette additions (`src/style/palette.ts`)
Neon set (on substrate ~`#0a1712`): cyan `0x36e0e0`, magenta `0xc23bff`, gold `0xf0c43a`,
green `0x4dff7a`, red `0xff4d4d`, orange `0xff9b3a`, blue `0x3a7bff`. Path: outer-glow
`0x1f8f4d`α, band `0x2bd06a`, lane-lines `0x7cffb0`, lane-gap = substrate. Keep build-gold,
special-cyan, finish-red, start-green.

### Trace (the hero) — `traceBuilder` + `RENDER`
- `bandWidth ≈ pitch * 1.8` (corridor), `outerGlow = band + pitch*0.6` soft low-alpha,
  `laneCount = 4`, `laneWidth ≈ 1.5px`, lanes evenly spaced across the band (perpendicular
  offsets of the filleted polyline), `laneColor = traceCore`, gaps = substrate.
- Flowing dots along centerline (Ref-B) optional, subtle, animate later.

### Enemy tokens — `GameLayers` (drawn ON path, glow halo + core glyph)
| Internal kind | Themed name | Glyph | Color |
|---|---|---|---|
| fast | SIGNAL | filled circle + ring | cyan |
| normal | PACKET | filled square | red |
| healer | BURST | twin-dot capsule | gold |
| brute | VIRUS | diamond | magenta |
| tank | CORRUPTED | hexagon | orange |
| rogue | GLITCH | triangle | green |
| boss | (BOSS) | large virus diamond + ring | magenta/gold |
Token = soft glow halo + bright filled glyph + HP arc/bar. Sized ≈ 0.7× pitch (readable on band).

### Tower icon-chips — `GameLayers`
| Internal kind | Themed name | Icon | Accent |
|---|---|---|---|
| cannon | PULSE | concentric rings | cyan |
| sniper | LASER | diamond (fires cyan beam) | blue |
| slow | SLOW FIELD | target/ring (aura) | green |
| mortar | MISSILE | up-triangle (splash) | orange |
| tesla | TESLA | lightning bolt (magenta arc) | magenta |
Chip = dark rounded IC body (~1.4× pitch) + silver pin rows on 2–4 sides + bright neon icon +
colored glow + level pips. (EMP, SUPPORT = future gameplay, see §4.)

### Build pad (empty spot) — `Renderer`/`GameLayers`
Dashed neon square (~1.4× pitch) + center crosshair, low-alpha glow. Build-spot=gold, special=cyan.

### START / FINISH — `Renderer.drawTrace`
Rounded glowing pad (~1.6× pitch): START green + ▶, FINISH red + ■; 3 lead chevrons.

### HUD top bar + left rail — `ui/`
Top bar: `LEVEL nn` + difficulty word; `WAVE x/N`; `LIVES n ❤`; `CREDITS n ⚡`; ⏸ ▶ ⏩; ≡ menu.
Left rail (play): LEGEND, ENEMY TYPES (6 glyph rows), TOWER TYPES (5 glyph rows). Dark panels, neon border.

### Decor rebalance & detail quality — `pipeline/decor` + `decorBuilder` + `render`
Goal: decor reads like an authentic, **dark, recessed** PCB that sits BEHIND the path — not a
carpet of bright stickers (current problem).
- **Dark recessed palette:** component bodies near-black/dark-teal (`0x12241c`–`0x182a20`), pads
  dim brass/teal (low-alpha), NOT light beige/tan. Drop the loud white "100" labels (or render at
  ~10% alpha, tiny). Lower overall decor contrast so it never competes with the neon path.
- **Background copper-routing web (NEW):** a faint layer of thin teal traces (`~1px`,
  `0x163a2a`, low alpha) criss-crossing the substrate between components + scattered tiny
  vias/pads — the elegant fine routing seen in the concept. Drawn under decor, under path.
  Procedural: short orthogonal/45° stubs linking random pads + a sparse via field.
- **Cleaner component render:** soft drop-shadow + subtle bevel + thin dim outline (the
  "rendered" look), not flat fills. ICs get neat gold/teal pin rows.
- **Fewer + bigger:** reduce total component count ~50–60% (fewer passive rows, fewer vias),
  enlarge footprints ~1.3–1.5×. Keep IC + decoupling-cap clusters (the realism signature).
- Net effect: dark elegant board texture; the glowing multi-lane path is unmistakably the hero.

## 4. Mechanic ↔ theme mapping & scope
- Keep ALL mechanics; this is a **re-skin + rename-at-display** layer. Internal `EnemyKind`/
  `TowerKind` stay; add a display-name + glyph + color table in the render/UI layer (no logic change).
- Concept has **7 tower types**; we have **5**. **EMP** and **SUPPORT** are NEW mechanics →
  **out of scope for the art pass**; deferred to a gameplay milestone. Art pass re-skins the 5 we have.
- Concept has **6 enemy types**; we have **7** kinds → map 6 names + keep BOSS as a special.

## 5. Phased plan (each phase: build-green + visual check + commit)
- **P1 — Path-hero + palette.** Thick multi-lane band + glow; neon palette; brighter START/FINISH.
  Files: `style/palette.ts`, `render/traceBuilder.ts`, `render/Renderer.ts`. Risk: lane-offset math
  at corners (mitigate: offset filleted polyline by per-point normal). Acceptance: path dominates,
  multi-lane, matches Ref-A.
- **P2 — Decor rebalance & detail.** Dark recessed palette (drop loud labels/bright pads), add a
  faint background copper-routing web (thin teal traces + via field), cleaner component render
  (shadow/bevel/outline), fewer+bigger parts. Files: `pipeline/decor.ts`, `render/decorBuilder.ts`,
  `render/Renderer.ts` (+ `style/palette.ts` dark-decor colors). Acceptance: decor reads as an
  authentic dark PCB behind the path; no bright sticker clutter; matches concept's fine routing.
- **P3 — Enemy tokens.** On-path neon glyph tokens + types table. File: `render/GameLayers.ts`
  (+ a small `theme.ts` map). Acceptance: 6 distinct glowing tokens ride the lanes.
- **P4 — Tower icon-chips.** Per-type neon-icon chips + pin rows + glow. Files: `GameLayers.ts`,
  `theme.ts`. Acceptance: 5 distinct chips, readable icons.
- **P5 — Build pads + special/start/finish polish.** Dashed neon pads. Files: `Renderer.ts`.
- **P6 — Top HUD + left rail.** Restructure UI. Files: `ui/GameUI.ts`, `ui/Panels.ts`, `ui/styles.css`,
  `main.ts`. Acceptance: top bar + transport + legend rail like Ref-B.
- **P7 — FX theming + flow dots.** Laser cyan beam, tesla magenta arc, path flow dots. File:
  `GameLayers.ts`. Acceptance: matches Ref-B firing.

Order rationale: path+palette first (biggest perceived change, de-risks the look), then decor
(restore balance), then the on-path actors (enemies, towers), then chrome (pads, HUD), then FX.

## 5b. Trace scale & centering (the centerpiece) — HARD requirement
The path must be **big and centered** — the visual hero in the middle of the screen, not a thin
line offset by decor.
- **Camera auto-frames the PATH bounding box** (not the whole board): compute the bbox of all
  `paths` waypoints, fit zoom so the path fills ~70–80% of the viewport, centered. Decor extends
  beyond the framed path (fills the margins). This guarantees "the trace is in the center" on every
  level regardless of where the generator placed it.
- Combined with the thick multi-lane band (P1), the path reads as the dominant centerpiece.
- Shape: keep the winding archetypes (serpentine/spiral/organic/branching/multiSpawn/cross), but
  bias generation toward shapes that fill the framed area centrally (large bounding box, good fill).
- This becomes part of **P1** (path-hero): band thickness + palette + **camera framing on the path**.

## 5c. Difficulty progression across tracks — requirement
"Each track differs in difficulty: first easy, then medium, then hard."
- Tracks form a **ramp**: a campaign counter advances difficulty per track.
  Tiers: **EASY** = difficulty 1–2, **MEDIUM** = 4–5, **HARD** = 7–9.
- **Auto-Generate** produces the *next* track in the ramp (difficulty climbs each press), starting
  EASY; a small control can also pick a tier directly. The generated track's `meta.difficulty`
  drives waves + enemy HP (already wired) and the HUD tier word.
- `generateBalancedLevel` already keeps each track winnable; the ramp changes the target difficulty,
  so EASY tracks are gentle and HARD tracks are intense (basic defense passes HARD with high pressure,
  not trivially).
- HUD shows the tier word (EASY/MEDIUM/HARD) from `meta.difficulty`. This folds into **P6 (HUD)**
  plus a small generator/flow change (campaign difficulty counter) done in **P1** alongside framing.

## 6. Decisions to confirm before coding
1. **Tower count:** re-skin our 5 now (Pulse/Laser/SlowField/Missile/Tesla) and add EMP+Support as a
   later gameplay milestone — OK? (Recommended.)
2. **Enemy naming:** adopt the themed names (Signal/Packet/Burst/Virus/Corrupted/Glitch + Boss) as
   DISPLAY names over our existing kinds (no mechanics change) — OK?
3. **HUD move:** replace the bottom game-bar with the **top** bar + left rail per Ref-B — OK?
   (Editor toolbar stays as-is in Editor mode.)
4. **Difficulty word** (e.g. EASY/NORMAL/HARD) shown in HUD — derive from level `meta.difficulty`?
5. Scope of this art milestone = P1–P7 above; flow-dot animation can be P7/later.
