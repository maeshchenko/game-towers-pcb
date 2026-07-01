# PCB TD — Milestone G1: Playable Level (Enemies, Flows, Towers, Combat)

Status: **Draft for review**
Date: 2026-06-29

## Goal
Turn the generated PCB maps into a **playable tower-defense level**: enemies spawn in
waves and flow along the level's paths; the player builds, upgrades, and sells towers on
the computed spots; towers target and fire; economy (currency) and lives drive win/lose.
Reuses the map editor + generator from the first milestone and ports the proven game
logic from `../tower-defence-game` (3D → 2D).

Out of scope (Milestone G2): the auto-optimizer that *guarantees* a winnable, balanced
spot layout via Monte-Carlo simulation; tile-based track authoring; audio; campaign/save.

## Reuse from `../tower-defence-game` (port 3D→2D, Vec3→Vec2, world-units→cells)
- `enemies/EnemyTypes.ts` `ENEMY_DEFS` (normal/fast/tank/rogue/brute/healer/boss) — verbatim values.
- `enemies/WaveManager.ts` `mapWaves(mapIndex)` + spawn scheduling.
- `world/PathFollower.ts` movement-along-polyline (drop `z`).
- `enemies/Enemy.ts` hp/armor/slow/death/leak (drop hero-attack/heal-runtime for G1; keep fields).
- `towers/TowerTypes.ts` `TOWER_DEFS` (cannon/slow/sniper/mortar/tesla, 3 levels) — verbatim.
- `towers/Tower.ts` targeting (`first/last/strong/weak`) + fire cadence + damage model.
  **Drop the 3D barrel-yaw/turn-rate**: 2D top-down aims instantly (sprite rotation cosmetic).
- `towers/TowerManager.ts` build/upgrade/sell (sell = 60% of spent).
- `core/GameState.ts` gold/lives/wave/phase. `sim/config.ts` `SIM_HP_SCALE`, economy curves.
- Damage model: `effectiveDamage = max(1, raw - max(0, armor - pierce))`.

## Units & coordinates
- Ranges/speeds expressed in **cells**; multiply by `board.pitch` for px. A global
  `SPEED_SCALE` (tuned visually) converts `def.speed` (cells/sec) to px/sec so enemies move
  at a good pace. Enemies follow the **filleted px polyline** of a `Trace` (matches the
  drawn glowing path), via the existing `filletPath`.

## Architecture — new `src/game/` (framework-free logic) + render/UI

### Logic (pure, unit-tested; no Pixi)
- `enemyTypes.ts` — `EnemyKind`, `ENEMY_DEFS`.
- `towerTypes.ts` — `TowerKind`, `TOWER_DEFS`.
- `difficulty.ts` — `hpScale(difficulty)`, `startLives`, `startGold(difficulty)`, `waveClearGold(wave)`.
- `PathFollower2D.ts` — `new PathFollower2D(pointsPx: Pt[], speedPx)`, `advance(dt)`, `pos`, `done`, `traveled`.
- `Enemy.ts` — `Enemy(def, pointsPx, hpScale)`: `hp/maxHp/bounty/armor/leak/kind`, `pos`,
  `alive`, `reachedBase`, `traveled`, `update(dt)`, `takeDamage(n,pierce)`, `applySlow(factor,dur)`.
- `WaveManager.ts` — `mapWaves(difficulty)`, schedules spawns; on spawn, **assigns each
  enemy a path chosen uniformly at random** from `levelPaths(level)` (→ ~50/50 fork split;
  multiSpawn = all spawn routes used). Seeded RNG for determinism in tests.
- `Tower.ts` — `Tower(kind, cellPx)`: `level`, `stats`, `upgrade()`, `targetMode`+`cycle()`,
  `update(dt, enemies): ShotResult | null` (in-range filter + target mode + cooldown; aura
  returns a slow-field result). No yaw.
- `combat.ts` — applies a `ShotResult`: direct damage, `splashRadius` (all enemies within),
  `chainCount/chainRange` (tesla, 60% to chained), `slow`/`aura`, `pierce`; awards bounty on kill.
- `economy.ts` / part of `GameState.ts` — `gold`, `spend(n)`, `add(n)`; tower build/upgrade
  cost from defs; `sellValue = floor(spent*0.6)`.
- `GameState.ts` — `lives`, `gold`, `wave` (1-based), `phase: 'build'|'wave'|'win'|'lose'`,
  `waveCount`; `startWave()`, `endWave()`, `damageBase(leak)`, events for UI.
- `Game.ts` — orchestrator: owns `GameState`, `WaveManager`, `towers[]`, enemies. `tick(dt)`:
  spawn → move enemies → leaked enemies reduce lives & are removed → towers fire → apply
  combat → remove dead (award gold) → wave-clear → win/lose. `speed` multiplier. Build/upgrade/
  sell API guarded by phase + spot occupancy.

### Render (`src/render/`)
- `EnemyLayer` — per-frame: each enemy a glowing unit (color by kind) + small HP bar; on the trace.
- `TowerLayer` — towers on spots (PCB-styled icon per kind), range ring when selected, fire FX
  (projectile dot / hitscan line / tesla arc / mortar arc + splash flash); aura ring for slow.
- Wire into the Pixi ticker; runs only in play mode. Editor view unchanged when not playing.

### UI (`src/ui/`)
- **Build menu**: tower kind buttons (icon, cost); click a free spot then a kind to build.
- **Tower panel**: on selecting a placed tower — name, level, stats (dmg/rate/range), target
  mode toggle, **Upgrade** (cost / max), **Sell** (refund), close.
- **HUD**: `WAVE x/N`, `LIVES`, `CURRENCY`, **Play/Pause**, **Speed 1×/2×/4×**, **Start Wave**.
- Reskinned to the PCB aesthetic (matches existing panels). Bound to `GameState` events.

## Flow / phases
1. Load/generate a level → `build` phase: place towers on spots with starting gold.
2. **Start Wave** → `wave` phase: enemies spawn & flow; towers fire; kills give gold; leaks
   cost lives. Wave clears when all spawned + none active → back to `build`, award wave gold.
3. All waves cleared → `win`. Lives ≤ 0 → `lose`. Restart resets `GameState` for the level.

## Spots
Towers build only on `spots`/`specialSpots` cells (one tower per spot). For G1 both are
buildable (special-spot-only towers deferred). Occupancy tracked in `Game`.

## Testing (Vitest, logic only)
- PathFollower2D reaches the end of a polyline; `traveled` monotonic.
- Enemy: `takeDamage` + armor/pierce; death; slow reduces effective speed; `reachedBase`.
- WaveManager: spawns exact counts at intervals (deterministic); path assignment ~uniform
  over many spawns (seeded, within tolerance).
- Tower: in-range targeting per mode; fire cadence (cooldown); aura returns field; damage
  model `effectiveDamage`.
- combat: splash hits all in radius; chain hits N at 60%; bounty awarded on kill once.
- economy/GameState: spend/refund (sell 60%), build/upgrade gating, lives on leak,
  wave progression, win/lose transitions.
- Game.tick integration: a scripted mini-level (short path, 1 cannon, a few normals) →
  enemies die or leak deterministically; gold/lives update.

## Open questions
None blocking. Combat visual style (projectile vs hitscan per kind) tuned during render.
