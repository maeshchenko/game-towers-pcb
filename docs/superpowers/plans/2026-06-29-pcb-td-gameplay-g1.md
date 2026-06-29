# PCB TD Gameplay G1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the generated PCB maps a playable tower-defense level — enemies spawn in waves and flow along the level's paths, the player builds/upgrades/sells towers on the computed spots, towers target and fire, and currency + lives drive win/lose.

**Architecture:** Framework-free game logic in `src/game/` (pure, unit-tested), driven by a `Game` orchestrator on the Pixi ticker; thin Pixi render layers for enemies/towers/FX; HTML/CSS UI (build menu, tower panel, HUD) bound to `GameState`. Ports proven logic from `../tower-defence-game` (3D→2D, Vec3→Vec2, world-units→cells).

**Tech Stack:** TypeScript (strict), Vite, Pixi.js v8, Vitest. Reuses existing `geom` (`Pt`, `dist`, `cellToPx`, `filletPath`), `model/level` (`Level`, `Trace`, `levelPaths`, `TowerSpot`), `pipeline/rng` (`makeRng`).

## Global Constraints

- TypeScript strict, ESM. Runtime dep limited to `pixi.js`.
- Commits in **Russian**, short, clear. **Never** mention AI/Claude/Opus/neural nets; no `Co-Authored-By` or AI trailers.
- `tsc` has `noEmit` — `npm run build` = typecheck + vite bundle; never emit `.js` into `src`/`tests`.
- Game logic in `src/game/` is **pure** (no Pixi/DOM imports) and unit-tested. Render/UI is thin.
- Coordinates: ranges/speeds in **cells**; convert to px with `board.pitch`. `SPEED_SCALE` (in `difficulty.ts`) converts `def.speed` cells/sec → px/sec.
- Enemy/tower stat values are ported **verbatim** from the reference `ENEMY_DEFS` / `TOWER_DEFS` (listed in tasks).
- Damage model: `effectiveDamage(raw, armor, pierce) = max(1, raw - max(0, armor - pierce))`.
- Sell refund = `floor(spent * 0.6)`. One tower per spot.
- Enemies follow the **filleted px polyline** (`filletPath`) of their assigned path.

---

### Task 1: Enemy + tower stat tables

**Files:**
- Create: `src/game/enemyTypes.ts`, `src/game/towerTypes.ts`
- Test: `tests/game/types.test.ts`

**Interfaces:**
- Produces:
  - `type EnemyKind = 'normal'|'fast'|'tank'|'rogue'|'brute'|'healer'|'boss'`
  - `interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number; armor: number; leak: number }`
  - `const ENEMY_DEFS: Record<EnemyKind, EnemyDef>`
  - `type TowerKind = 'cannon'|'slow'|'sniper'|'mortar'|'tesla'`
  - `interface TowerLevel { range: number; fireRate: number; damage: number; cost: number; slow?: number; aura?: boolean; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number }`
  - `const TOWER_DEFS: Record<TowerKind, TowerLevel[]>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/types.test.ts
import { describe, it, expect } from 'vitest'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'
import { TOWER_DEFS } from '../../src/game/towerTypes'

describe('stat tables', () => {
  it('has all 7 enemy kinds with positive hp/speed', () => {
    const kinds = ['normal','fast','tank','rogue','brute','healer','boss'] as const
    for (const k of kinds) { expect(ENEMY_DEFS[k].hp).toBeGreaterThan(0); expect(ENEMY_DEFS[k].speed).toBeGreaterThan(0) }
    expect(ENEMY_DEFS.tank.armor).toBe(6)
    expect(ENEMY_DEFS.boss.leak).toBe(8)
  })
  it('has 5 tower kinds each with 3 levels and ascending cost-effect', () => {
    const kinds = ['cannon','slow','sniper','mortar','tesla'] as const
    for (const k of kinds) expect(TOWER_DEFS[k]).toHaveLength(3)
    expect(TOWER_DEFS.slow[0].aura).toBe(true)
    expect(TOWER_DEFS.sniper[0].pierce).toBe(4)
    expect(TOWER_DEFS.mortar[0].splashRadius).toBeGreaterThan(0)
    expect(TOWER_DEFS.tesla[0].chainCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/enemyTypes.ts
export type EnemyKind = 'normal' | 'fast' | 'tank' | 'rogue' | 'brute' | 'healer' | 'boss'
export interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number; armor: number; leak: number }
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 45, speed: 2.0, bounty: 4, armor: 0, leak: 1 },
  fast: { kind: 'fast', hp: 24, speed: 4.5, bounty: 5, armor: 0, leak: 1 },
  tank: { kind: 'tank', hp: 200, speed: 1.0, bounty: 16, armor: 6, leak: 3 },
  rogue: { kind: 'rogue', hp: 15, speed: 6.0, bounty: 3, armor: 0, leak: 1 },
  brute: { kind: 'brute', hp: 400, speed: 1.3, bounty: 22, armor: 0, leak: 3 },
  healer: { kind: 'healer', hp: 90, speed: 1.8, bounty: 20, armor: 0, leak: 2 },
  boss: { kind: 'boss', hp: 2600, speed: 0.9, bounty: 140, armor: 6, leak: 8 },
}
```

```ts
// src/game/towerTypes.ts
export type TowerKind = 'cannon' | 'slow' | 'sniper' | 'mortar' | 'tesla'
export interface TowerLevel {
  range: number; fireRate: number; damage: number; cost: number
  slow?: number; aura?: boolean; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
}
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6.0, fireRate: 1.5, damage: 10, cost: 40 },
    { range: 6.5, fireRate: 1.7, damage: 17, cost: 45 },
    { range: 7.0, fireRate: 1.9, damage: 28, cost: 60 },
  ],
  slow: [
    { range: 3.5, fireRate: 1.0, damage: 0, slow: 0.55, aura: true, cost: 35 },
    { range: 4.5, fireRate: 1.0, damage: 0, slow: 0.45, aura: true, cost: 35 },
    { range: 5.0, fireRate: 1.0, damage: 0, slow: 0.35, aura: true, cost: 45 },
  ],
  sniper: [
    { range: 11.0, fireRate: 0.45, damage: 50, cost: 90, pierce: 4 },
    { range: 12.5, fireRate: 0.50, damage: 80, cost: 85, pierce: 8 },
    { range: 14.0, fireRate: 0.55, damage: 130, cost: 130, pierce: 999 },
  ],
  mortar: [
    { range: 7.0, fireRate: 0.6, damage: 14, splashRadius: 2.4, cost: 75 },
    { range: 7.5, fireRate: 0.7, damage: 20, splashRadius: 2.8, cost: 70 },
    { range: 8.0, fireRate: 0.8, damage: 30, splashRadius: 3.2, cost: 95 },
  ],
  tesla: [
    { range: 5.5, fireRate: 2.2, damage: 6, chainCount: 2, chainRange: 3.0, cost: 60 },
    { range: 6.0, fireRate: 2.5, damage: 9, chainCount: 3, chainRange: 3.2, cost: 55 },
    { range: 6.5, fireRate: 2.8, damage: 12, chainCount: 4, chainRange: 3.5, cost: 80 },
  ],
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/enemyTypes.ts src/game/towerTypes.ts tests/game/types.test.ts
git commit -m "Игра: таблицы характеристик врагов и башен"
```

---

### Task 2: Difficulty + economy curves + damage model

**Files:**
- Create: `src/game/difficulty.ts`
- Test: `tests/game/difficulty.test.ts`

**Interfaces:**
- Produces:
  - `SPEED_SCALE: number` (cells/sec → px/sec multiplier, applied on top of pitch)
  - `hpScale(difficulty: number): number`
  - `startLives: number`
  - `startGold(difficulty: number): number`
  - `waveClearGold(wave1Based: number): number`
  - `effectiveDamage(raw: number, armor: number, pierce?: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/difficulty.test.ts
import { describe, it, expect } from 'vitest'
import { hpScale, startLives, startGold, waveClearGold, effectiveDamage, SPEED_SCALE } from '../../src/game/difficulty'

describe('difficulty + economy', () => {
  it('hp scale ramps with difficulty', () => {
    expect(hpScale(0)).toBeCloseTo(1, 5)
    expect(hpScale(10)).toBeGreaterThan(hpScale(0))
  })
  it('economy curves', () => {
    expect(startLives).toBe(20)
    expect(startGold(0)).toBe(120)
    expect(startGold(5)).toBe(195)
    expect(waveClearGold(1)).toBe(14)
  })
  it('effective damage subtracts armor minus pierce, min 1', () => {
    expect(effectiveDamage(10, 0, 0)).toBe(10)
    expect(effectiveDamage(10, 6, 0)).toBe(4)
    expect(effectiveDamage(10, 6, 6)).toBe(10)
    expect(effectiveDamage(3, 6, 0)).toBe(1)
  })
  it('speed scale is positive', () => { expect(SPEED_SCALE).toBeGreaterThan(0) })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/difficulty.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/difficulty.ts
// cells/sec * pitch gives px/sec; SPEED_SCALE tunes the felt pace (raise to speed enemies up).
export const SPEED_SCALE = 1.6
export const startLives = 20
export function hpScale(difficulty: number): number { return 1 + difficulty * 0.06 }
export function startGold(difficulty: number): number { return 120 + difficulty * 15 }
export function waveClearGold(wave1Based: number): number { return 12 + wave1Based * 2 }
export function effectiveDamage(raw: number, armor: number, pierce = 0): number {
  return Math.max(1, raw - Math.max(0, armor - pierce))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/difficulty.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/difficulty.ts tests/game/difficulty.test.ts
git commit -m "Игра: кривые сложности, экономика, модель урона"
```

---

### Task 3: PathFollower2D

**Files:**
- Create: `src/game/PathFollower2D.ts`
- Test: `tests/game/pathFollower.test.ts`

**Interfaces:**
- Consumes: `Pt` from `src/geom/types`.
- Produces: `class PathFollower2D { constructor(points: Pt[], speedPx: number); pos: Pt; done: boolean; traveled: number; advance(dt: number): void }`

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/pathFollower.test.ts
import { describe, it, expect } from 'vitest'
import { PathFollower2D } from '../../src/game/PathFollower2D'

describe('PathFollower2D', () => {
  const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
  it('advances along the segment and reports traveled', () => {
    const f = new PathFollower2D(path, 50)
    f.advance(1)
    expect(f.pos.x).toBeCloseTo(50, 5)
    expect(f.traveled).toBeCloseTo(50, 5)
    expect(f.done).toBe(false)
  })
  it('finishes at the end', () => {
    const f = new PathFollower2D(path, 50)
    f.advance(10)
    expect(f.pos.x).toBeCloseTo(100, 5)
    expect(f.done).toBe(true)
  })
  it('a single-point path is immediately done', () => {
    expect(new PathFollower2D([{ x: 5, y: 5 }], 50).done).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/pathFollower.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/PathFollower2D.ts
import type { Pt } from '../geom/types'

export class PathFollower2D {
  pos: Pt
  done = false
  traveled = 0
  private target = 1
  constructor(private points: Pt[], private speedPx: number) {
    this.pos = { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0 }
    if (points.length < 2) this.done = true
  }
  advance(dt: number): void {
    if (this.done) return
    let budget = this.speedPx * dt
    while (budget > 0 && !this.done) {
      const tgt = this.points[this.target]
      const dx = tgt.x - this.pos.x, dy = tgt.y - this.pos.y
      const d = Math.hypot(dx, dy)
      if (d <= budget) {
        this.pos.x = tgt.x; this.pos.y = tgt.y
        budget -= d; this.traveled += d
        this.target += 1
        if (this.target >= this.points.length) { this.done = true; this.target = this.points.length - 1 }
      } else {
        const inv = budget / d
        this.pos.x += dx * inv; this.pos.y += dy * inv
        this.traveled += budget; budget = 0
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/pathFollower.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/PathFollower2D.ts tests/game/pathFollower.test.ts
git commit -m "Игра: движение по полилайну (PathFollower2D)"
```

---

### Task 4: Enemy

**Files:**
- Create: `src/game/Enemy.ts`
- Test: `tests/game/enemy.test.ts`

**Interfaces:**
- Consumes: `EnemyDef`; `PathFollower2D`; `effectiveDamage`; `Pt`.
- Produces: `class Enemy` with `constructor(def: EnemyDef, points: Pt[], hpScale: number, speedPx: number)`,
  fields `hp`, `maxHp`, `bounty`, `armor`, `leak`, `kind`; getters `pos: Pt`, `alive: boolean`,
  `reachedBase: boolean`, `traveled: number`; methods `update(dt: number)`, `takeDamage(n: number, pierce?: number)`, `applySlow(factor: number, dur: number)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/enemy.test.ts
import { describe, it, expect } from 'vitest'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

const path = [{ x: 0, y: 0 }, { x: 100, y: 0 }]

describe('Enemy', () => {
  it('scales hp and dies when hp hits 0', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path, 2, 50)
    expect(e.maxHp).toBe(90)
    e.takeDamage(90)
    expect(e.alive).toBe(false)
  })
  it('armor reduces damage, pierce ignores it', () => {
    const e = new Enemy(ENEMY_DEFS.tank, path, 1, 50) // armor 6
    e.takeDamage(10)        // 10-6 = 4
    expect(e.hp).toBe(196)
    e.takeDamage(10, 6)     // pierce cancels armor → 10
    expect(e.hp).toBe(186)
  })
  it('slow reduces effective speed', () => {
    const fast = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    const slowed = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    slowed.applySlow(0.5, 10)
    fast.update(1); slowed.update(1)
    expect(slowed.traveled).toBeLessThan(fast.traveled)
  })
  it('reachedBase when it finishes alive', () => {
    const e = new Enemy(ENEMY_DEFS.normal, path, 1, 50)
    e.update(10)
    expect(e.reachedBase).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/enemy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/Enemy.ts
import type { Pt } from '../geom/types'
import type { EnemyDef, EnemyKind } from './enemyTypes'
import { PathFollower2D } from './PathFollower2D'
import { effectiveDamage } from './difficulty'

export class Enemy {
  hp: number
  readonly maxHp: number
  readonly bounty: number
  readonly armor: number
  readonly leak: number
  readonly kind: EnemyKind
  private follower: PathFollower2D
  private slowFactor = 1
  private slowTimer = 0
  constructor(def: EnemyDef, points: Pt[], hpScale: number, speedPx: number) {
    this.hp = Math.round(def.hp * hpScale)
    this.maxHp = this.hp
    this.bounty = def.bounty
    this.armor = def.armor
    this.leak = def.leak
    this.kind = def.kind
    this.follower = new PathFollower2D(points, speedPx)
  }
  get pos(): Pt { return this.follower.pos }
  get alive(): boolean { return this.hp > 0 && !this.follower.done }
  get reachedBase(): boolean { return this.follower.done && this.hp > 0 }
  get traveled(): number { return this.follower.traveled }
  update(dt: number): void {
    if (this.hp <= 0) return
    if (this.slowTimer > 0) { this.slowTimer -= dt; if (this.slowTimer <= 0) this.slowFactor = 1 }
    this.follower.advance(dt * this.slowFactor)
  }
  takeDamage(n: number, pierce = 0): void {
    this.hp = Math.max(0, this.hp - effectiveDamage(n, this.armor, pierce))
  }
  applySlow(factor: number, dur: number): void {
    this.slowFactor = Math.min(this.slowFactor, factor)
    this.slowTimer = Math.max(this.slowTimer, dur)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/enemy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/Enemy.ts tests/game/enemy.test.ts
git commit -m "Игра: враг (HP, броня, замедление, утечка)"
```

---

### Task 5: WaveManager

**Files:**
- Create: `src/game/WaveManager.ts`
- Test: `tests/game/waveManager.test.ts`

**Interfaces:**
- Consumes: `EnemyKind`, `ENEMY_DEFS`, `Enemy`; `Pt`; `makeRng` from `src/pipeline/rng`.
- Produces:
  - `interface WaveEntry { kind: EnemyKind; count: number; interval: number }`
  - `function mapWaves(difficulty: number): WaveEntry[][]`
  - `class WaveManager { constructor(paths: Pt[][], waves: WaveEntry[][], hpScale: number, speedScale: number, seed: number); startWave(i: number): void; update(dt: number): Enemy[]; readonly active: Enemy[]; remove(e: Enemy): void; spawning: boolean; cleared(): boolean; waveCount: number; peek(i: number): WaveEntry[] }`
  - `paths` are pre-filleted px polylines; each spawned enemy is assigned a uniformly-random path; `speedScale` = `pitch * SPEED_SCALE` (so enemy speedPx = `def.speed * speedScale`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/waveManager.test.ts
import { describe, it, expect } from 'vitest'
import { WaveManager, mapWaves } from '../../src/game/WaveManager'

const p1 = [{ x: 0, y: 0 }, { x: 100, y: 0 }]
const p2 = [{ x: 0, y: 50 }, { x: 100, y: 50 }]

describe('mapWaves', () => {
  it('produces 10 waves, wave 10 has a boss', () => {
    const w = mapWaves(3)
    expect(w).toHaveLength(10)
    expect(w[9].some((g) => g.kind === 'boss')).toBe(true)
  })
})

describe('WaveManager', () => {
  it('spawns exactly the wave count over time', () => {
    const wm = new WaveManager([p1], [[{ kind: 'normal', count: 3, interval: 0.5 }]], 1, 50, 1)
    wm.startWave(0)
    let total = 0
    for (let t = 0; t < 10; t++) total += wm.update(0.5).length
    expect(total).toBe(3)
    expect(wm.cleared()).toBe(false) // still active (alive on path)
  })
  it('assigns paths roughly uniformly across two paths (seeded)', () => {
    const wm = new WaveManager([p1, p2], [[{ kind: 'normal', count: 200, interval: 0.01 }]], 1, 50, 42)
    wm.startWave(0)
    for (let t = 0; t < 300; t++) wm.update(0.01)
    const ys = wm.active.map((e) => e.pos.y)
    const onP2 = ys.filter((y) => y >= 25).length
    expect(onP2).toBeGreaterThan(60)   // ~100 expected; loose bounds
    expect(onP2).toBeLessThan(140)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/waveManager.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/WaveManager.ts
import type { Pt } from '../geom/types'
import type { EnemyKind } from './enemyTypes'
import { ENEMY_DEFS } from './enemyTypes'
import { Enemy } from './Enemy'
import { makeRng } from '../pipeline/rng'

export interface WaveEntry { kind: EnemyKind; count: number; interval: number }
interface Pending { kind: EnemyKind; interval: number; remaining: number; timer: number }

export function mapWaves(difficulty: number): WaveEntry[][] {
  const b = Math.floor(difficulty * 1.5)
  const m2 = Math.floor(difficulty / 2), m3 = Math.floor(difficulty / 3)
  const w: WaveEntry[][] = []
  for (let i = 0; i < 10; i++) {
    const g: WaveEntry[] = [{ kind: 'normal', count: 4 + b + i * 2, interval: 0.8 }]
    if (i >= 1) g.push({ kind: 'fast', count: 2 + m2 + i, interval: 0.5 })
    if (i >= 2) g.push({ kind: 'rogue', count: 2 + i + m3, interval: 0.4 })
    if (i >= 4) g.push({ kind: 'brute', count: m2 + Math.floor(i / 3), interval: 1.2 })
    if (i >= 5) g.push({ kind: 'tank', count: m2 + Math.floor((i - 3) / 2), interval: 1.5 })
    if (i >= 6 && i < 9) g.push({ kind: 'healer', count: 1 + Math.floor((i - 6) / 2), interval: 2.0 })
    if (i === 9) g.push({ kind: 'boss', count: difficulty >= 6 ? 3 : difficulty >= 3 ? 2 : 1, interval: 4.0 })
    w.push(g)
  }
  return w
}

export class WaveManager {
  private _active: Enemy[] = []
  private queue: Pending[] = []
  private rng: () => number
  constructor(
    private paths: Pt[][],
    private waves: WaveEntry[][],
    private hpScale: number,
    private speedScale: number,
    seed: number,
  ) { this.rng = makeRng(seed) }

  get active(): Enemy[] { return this._active }
  get spawning(): boolean { return this.queue.length > 0 }
  get waveCount(): number { return this.waves.length }
  peek(i: number): WaveEntry[] { return this.waves[i] ?? [] }

  startWave(i: number): void {
    const w = this.waves[i] ?? []
    this.queue = w.map((g) => ({ kind: g.kind, interval: g.interval, remaining: g.count, timer: 0 }))
  }
  update(dt: number): Enemy[] {
    const spawned: Enemy[] = []
    for (const g of this.queue) {
      g.timer -= dt
      while (g.remaining > 0 && g.timer <= 0) {
        const def = ENEMY_DEFS[g.kind]
        const path = this.paths[Math.floor(this.rng() * this.paths.length)] ?? this.paths[0]
        const e = new Enemy(def, path, this.hpScale, def.speed * this.speedScale)
        this._active.push(e); spawned.push(e)
        g.remaining -= 1; g.timer += g.interval
      }
    }
    this.queue = this.queue.filter((g) => g.remaining > 0)
    return spawned
  }
  remove(e: Enemy): void { this._active = this._active.filter((x) => x !== e) }
  cleared(): boolean { return !this.spawning && this._active.length === 0 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/waveManager.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/WaveManager.ts tests/game/waveManager.test.ts
git commit -m "Игра: менеджер волн и спавн по путям (50/50)"
```

---

### Task 6: Tower (targeting + fire) + ShotResult

**Files:**
- Create: `src/game/Tower.ts`
- Test: `tests/game/tower.test.ts`

**Interfaces:**
- Consumes: `TowerKind`, `TowerLevel`, `TOWER_DEFS`; `Enemy`; `Pt`; `dist` from `src/geom/grid`.
- Produces:
  - `type TargetMode = 'first'|'last'|'strong'|'weak'`
  - `interface ShotResult { from: Pt; target?: Enemy; damage?: number; slow?: number; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number; aura?: { slow: number; range: number } }`
  - `class Tower { constructor(kind: TowerKind, pos: Pt, pitch: number); readonly kind; pos: Pt; level: number; stats: TowerLevel; maxLevel: number; targetMode: TargetMode; cycleTargetMode(): void; upgrade(): boolean; update(dt: number, enemies: Enemy[]): ShotResult | null }`
  - Ranges are converted to px internally via `pitch` (range cells × pitch). No barrel yaw (2D fires when cooled + a target is in range).

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/tower.test.ts
import { describe, it, expect } from 'vitest'
import { Tower } from '../../src/game/Tower'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

const PITCH = 24
const near = () => new Enemy(ENEMY_DEFS.normal, [{ x: 30, y: 0 }, { x: 31, y: 0 }], 1, 0)
const far = () => new Enemy(ENEMY_DEFS.normal, [{ x: 9000, y: 0 }, { x: 9001, y: 0 }], 1, 0)

describe('Tower', () => {
  it('fires at an in-range enemy once cooled down', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH) // range 6 cells = 144px
    const e = near()
    const shot = t.update(1, [e]) // 1s ≥ 1/1.5 cooldown
    expect(shot?.target).toBe(e)
    expect(shot?.damage).toBe(10)
  })
  it('does not fire when no enemy in range', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    expect(t.update(1, [far()])).toBeNull()
  })
  it('respects cooldown', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    const e = near()
    expect(t.update(1, [e])).not.toBeNull()
    expect(t.update(0.01, [e])).toBeNull()
  })
  it('slow tower returns an aura field', () => {
    const t = new Tower('slow', { x: 24, y: 0 }, PITCH)
    const shot = t.update(0.1, [near()])
    expect(shot?.aura?.slow).toBeCloseTo(0.55, 5)
  })
  it('upgrade raises level and damage', () => {
    const t = new Tower('cannon', { x: 24, y: 0 }, PITCH)
    expect(t.upgrade()).toBe(true)
    expect(t.stats.damage).toBe(17)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/tower.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/Tower.ts
import type { Pt } from '../geom/types'
import { dist } from '../geom/grid'
import type { Enemy } from './Enemy'
import type { TowerKind, TowerLevel } from './towerTypes'
import { TOWER_DEFS } from './towerTypes'

export type TargetMode = 'first' | 'last' | 'strong' | 'weak'
export interface ShotResult {
  from: Pt; target?: Enemy; damage?: number; slow?: number
  splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
  aura?: { slow: number; range: number }
}

export class Tower {
  private lvl = 0
  private cooldown: number
  targetMode: TargetMode = 'first'
  constructor(readonly kind: TowerKind, readonly pos: Pt, private pitch: number) {
    this.cooldown = 1 / TOWER_DEFS[kind][0].fireRate
  }
  get level(): number { return this.lvl }
  get stats(): TowerLevel { return TOWER_DEFS[this.kind][this.lvl] }
  get maxLevel(): number { return TOWER_DEFS[this.kind].length - 1 }
  cycleTargetMode(): void {
    const order: TargetMode[] = ['first', 'last', 'strong', 'weak']
    this.targetMode = order[(order.indexOf(this.targetMode) + 1) % order.length]
  }
  upgrade(): boolean { if (this.lvl >= this.maxLevel) return false; this.lvl += 1; return true }

  update(dt: number, enemies: Enemy[]): ShotResult | null {
    const s = this.stats
    const rangePx = s.range * this.pitch
    if (s.aura) return { aura: { slow: s.slow ?? 0, range: rangePx }, from: this.pos }
    this.cooldown -= dt
    let target: Enemy | undefined
    for (const e of enemies) {
      if (!e.alive || dist(e.pos, this.pos) > rangePx) continue
      if (!target) { target = e; continue }
      const better =
        this.targetMode === 'first' ? e.traveled > target.traveled :
        this.targetMode === 'last' ? e.traveled < target.traveled :
        this.targetMode === 'strong' ? e.hp > target.hp : e.hp < target.hp
      if (better) target = e
    }
    if (!target || this.cooldown > 0) return null
    this.cooldown = 1 / s.fireRate
    return {
      from: this.pos, target, damage: s.damage, slow: s.slow,
      splashRadius: s.splashRadius, chainCount: s.chainCount, chainRange: s.chainRange, pierce: s.pierce,
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/tower.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/Tower.ts tests/game/tower.test.ts
git commit -m "Игра: башня (таргетинг, стрельба, аура, апгрейд)"
```

---

### Task 7: Combat resolution

**Files:**
- Create: `src/game/combat.ts`
- Test: `tests/game/combat.test.ts`

**Interfaces:**
- Consumes: `ShotResult`; `Enemy`; `dist`; `Pt`.
- Produces: `applyShot(shot: ShotResult, enemies: Enemy[], pitch: number): void` — applies direct
  damage + slow to `shot.target`; `splashRadius` (cells×pitch) damages all enemies within of the
  target; `chainCount`/`chainRange` arcs to up to N nearest other in-range enemies at 60% damage;
  `pierce` passed to `takeDamage`. Aura shots (no target) are handled by the caller, not here.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/combat.test.ts
import { describe, it, expect } from 'vitest'
import { applyShot } from '../../src/game/combat'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

const at = (x: number) => new Enemy(ENEMY_DEFS.normal, [{ x, y: 0 }, { x: x + 1, y: 0 }], 1, 0) // hp 45

describe('applyShot', () => {
  it('direct damage to target', () => {
    const e = at(0)
    applyShot({ from: { x: 0, y: 0 }, target: e, damage: 10 }, [e], 24)
    expect(e.hp).toBe(35)
  })
  it('splash hits all within radius', () => {
    const a = at(0), b = at(24), c = at(1000) // b is 1 cell away, c far
    applyShot({ from: { x: 0, y: 0 }, target: a, damage: 10, splashRadius: 2 }, [a, b, c], 24)
    expect(a.hp).toBe(35); expect(b.hp).toBe(35); expect(c.hp).toBe(45)
  })
  it('chain hits extra enemies at 60% damage', () => {
    const a = at(0), b = at(20)
    applyShot({ from: { x: 0, y: 0 }, target: a, damage: 10, chainCount: 1, chainRange: 3 }, [a, b], 24)
    expect(a.hp).toBe(35)             // full
    expect(b.hp).toBe(45 - 6)         // 60% of 10 = 6
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/combat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/combat.ts
import { dist } from '../geom/grid'
import type { Enemy } from './Enemy'
import type { ShotResult } from './Tower'

export function applyShot(shot: ShotResult, enemies: Enemy[], pitch: number): void {
  const { target } = shot
  if (!target) return
  const dmg = shot.damage ?? 0
  if (dmg > 0) target.takeDamage(dmg, shot.pierce ?? 0)
  if (shot.slow && shot.slow < 1) target.applySlow(shot.slow, 1.5)

  if (shot.splashRadius && dmg > 0) {
    const r = shot.splashRadius * pitch
    for (const e of enemies) {
      if (e === target || !e.alive) continue
      if (dist(e.pos, target.pos) <= r) e.takeDamage(dmg, shot.pierce ?? 0)
    }
  }
  if (shot.chainCount && shot.chainRange && dmg > 0) {
    const r = shot.chainRange * pitch
    const chainDmg = dmg * 0.6
    const candidates = enemies
      .filter((e) => e !== target && e.alive && dist(e.pos, target.pos) <= r)
      .sort((a, b) => dist(a.pos, target.pos) - dist(b.pos, target.pos))
      .slice(0, shot.chainCount)
    for (const e of candidates) e.takeDamage(chainDmg, shot.pierce ?? 0)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/combat.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/combat.ts tests/game/combat.test.ts
git commit -m "Игра: разрешение боя (урон, сплеш, чейн, слоу)"
```

---

### Task 8: GameState (lives, gold, waves, phase)

**Files:**
- Create: `src/game/GameState.ts`
- Test: `tests/game/gameState.test.ts`

**Interfaces:**
- Consumes: `startLives`, `startGold`, `waveClearGold`.
- Produces: `class GameState { constructor(difficulty: number, waveCount: number); lives: number; gold: number; wave: number; phase: 'build'|'wave'|'win'|'lose'; readonly waveCount: number; spend(n: number): boolean; add(n: number): void; damageBase(leak: number): void; startWave(): void; endWave(): void }`
  - `wave` is 0-based internally, exposed 1-based via `waveNumber` getter. `startWave` only from `build`; `endWave` awards `waveClearGold(waveNumber)`, advances wave, sets `win` if past last wave else `build`. `damageBase` sets `lose` at ≤0 lives.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/gameState.test.ts
import { describe, it, expect } from 'vitest'
import { GameState } from '../../src/game/GameState'

describe('GameState', () => {
  it('starts in build with gold/lives', () => {
    const g = new GameState(0, 10)
    expect(g.phase).toBe('build'); expect(g.lives).toBe(20); expect(g.gold).toBe(120)
  })
  it('spend gates on funds', () => {
    const g = new GameState(0, 10)
    expect(g.spend(40)).toBe(true); expect(g.gold).toBe(80)
    expect(g.spend(1000)).toBe(false); expect(g.gold).toBe(80)
  })
  it('wave lifecycle awards gold and advances', () => {
    const g = new GameState(0, 10)
    g.startWave(); expect(g.phase).toBe('wave')
    g.endWave(); expect(g.phase).toBe('build'); expect(g.gold).toBe(120 + 14)
  })
  it('leak reduces lives; 0 → lose', () => {
    const g = new GameState(0, 10)
    g.damageBase(20); expect(g.phase).toBe('lose'); expect(g.lives).toBe(0)
  })
  it('clearing the last wave → win', () => {
    const g = new GameState(0, 1)
    g.startWave(); g.endWave(); expect(g.phase).toBe('win')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/gameState.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/GameState.ts
import { startLives, startGold, waveClearGold } from './difficulty'

export type Phase = 'build' | 'wave' | 'win' | 'lose'

export class GameState {
  lives = startLives
  gold: number
  wave = 0 // 0-based index of the NEXT wave to run
  phase: Phase = 'build'
  constructor(difficulty: number, readonly waveCount: number) { this.gold = startGold(difficulty) }
  get waveNumber(): number { return this.wave + 1 } // 1-based for display/economy
  spend(n: number): boolean { if (this.gold < n) return false; this.gold -= n; return true }
  add(n: number): void { this.gold += n }
  damageBase(leak: number): void {
    this.lives = Math.max(0, this.lives - leak)
    if (this.lives <= 0) this.phase = 'lose'
  }
  startWave(): void { if (this.phase === 'build') this.phase = 'wave' }
  endWave(): void {
    if (this.phase !== 'wave') return
    this.add(waveClearGold(this.waveNumber))
    this.wave += 1
    this.phase = this.wave >= this.waveCount ? 'win' : 'build'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/gameState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/GameState.ts tests/game/gameState.test.ts
git commit -m "Игра: состояние (жизни, золото, волны, фазы)"
```

---

### Task 9: Game orchestrator

**Files:**
- Create: `src/game/Game.ts`
- Test: `tests/game/game.test.ts`

**Interfaces:**
- Consumes: `Level`, `levelPaths`, `Trace`; `Pt`; `cellToPx`; `filletPath`; `Enemy`; `Tower`, `TowerKind`; `applyShot`; `WaveManager`, `mapWaves`; `GameState`; `hpScale`, `SPEED_SCALE`; `TOWER_DEFS`; `dist`.
- Produces: `class Game { constructor(level: Level, seed?: number); readonly state: GameState; readonly towers: Tower[]; enemies(): Enemy[]; speed: number; spotCells(): Cell[]; canBuild(spotIndex: number): boolean; build(kind: TowerKind, spotIndex: number): boolean; upgrade(t: Tower): boolean; sellValue(t: Tower): number; sell(t: Tower): void; startWave(): void; tick(dt: number): void }`
  - On construction: precompute each path's filleted px polyline; gather buildable spots (`spots` ∪ `specialSpots`) as cells + px centers; `WaveManager(paths, mapWaves(difficulty), hpScale(difficulty), pitch*SPEED_SCALE, seed)`. `tick` does nothing unless `phase === 'wave'`. Build costs `TOWER_DEFS[kind][0].cost`; upgrade costs next level's cost; sell refunds 60% of spent.

- [ ] **Step 1: Write the failing test**

```ts
// tests/game/game.test.ts
import { describe, it, expect } from 'vitest'
import { Game } from '../../src/game/Game'
import type { Level } from '../../src/model/level'

function miniLevel(): Level {
  // short straight path along row 5 from col 1..10 on a small board
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

describe('Game', () => {
  it('build is gated by gold and spot occupancy', () => {
    const g = new Game(miniLevel(), 1)
    expect(g.canBuild(0)).toBe(true)
    expect(g.build('cannon', 0)).toBe(true)
    expect(g.towers).toHaveLength(1)
    expect(g.canBuild(0)).toBe(false)        // occupied
    expect(g.build('cannon', 0)).toBe(false)
  })
  it('a wave runs: enemies spawn, get shot or leak, and lives/gold change', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0)
    g.startWave()
    const goldAfterBuild = g.state.gold // 80 (built a 40-cost cannon from 120)
    let guard = 0
    while (g.state.phase === 'wave' && guard++ < 20000) g.tick(1 / 60)
    // wave resolved, and the wave actually did something: enemies were killed (gold rose
    // above the post-build 80, via bounty + wave-clear) OR leaked (lives fell below 20).
    expect(['build', 'win', 'lose']).toContain(g.state.phase)
    expect(g.state.gold > goldAfterBuild || g.state.lives < 20).toBe(true)
  })
  it('sell refunds 60%', () => {
    const g = new Game(miniLevel(), 1)
    g.build('cannon', 0) // cost 40
    const t = g.towers[0]
    expect(g.sellValue(t)).toBe(24)
    g.sell(t)
    expect(g.towers).toHaveLength(0)
    expect(g.state.gold).toBe(120 - 40 + 24)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/game.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/game/Game.ts
import type { Level, Trace } from '../model/level'
import { levelPaths } from '../model/level'
import type { Cell, Pt } from '../geom/types'
import { cellToPx } from '../geom/grid'
import { filletPath } from '../geom/fillet'
import type { Enemy } from './Enemy'
import { Tower } from './Tower'
import type { TowerKind } from './towerTypes'
import { TOWER_DEFS } from './towerTypes'
import { applyShot } from './combat'
import { WaveManager, mapWaves } from './WaveManager'
import { GameState } from './GameState'
import { hpScale, SPEED_SCALE } from './difficulty'

interface Spot { cell: Cell; pos: Pt; tower: Tower | null }

export class Game {
  readonly state: GameState
  readonly towers: Tower[] = []
  speed = 1
  private wm: WaveManager
  private spots: Spot[]
  readonly pitch: number
  private spent = new Map<Tower, number>()

  constructor(private level: Level, seed = 1) {
    this.pitch = level.board.pitch
    const paths = levelPaths(level).map((t: Trace) => filletPath(t.waypoints, t.cornerRadius, this.pitch))
    const diff = level.meta.difficulty
    const waves = mapWaves(diff)
    this.state = new GameState(diff, waves.length)
    this.wm = new WaveManager(paths, waves, hpScale(diff), this.pitch * SPEED_SCALE, seed)
    this.spots = [...level.spots, ...level.specialSpots].map((s) => ({ cell: s.cell, pos: cellToPx(s.cell, this.pitch), tower: null }))
  }

  enemies(): Enemy[] { return this.wm.active }
  spotCells(): Cell[] { return this.spots.map((s) => s.cell) }
  canBuild(i: number): boolean { return this.state.phase !== 'lose' && !!this.spots[i] && !this.spots[i].tower }

  build(kind: TowerKind, i: number): boolean {
    if (!this.canBuild(i)) return false
    const cost = TOWER_DEFS[kind][0].cost
    if (!this.state.spend(cost)) return false
    const t = new Tower(kind, this.spots[i].pos, this.pitch)
    this.spots[i].tower = t
    this.towers.push(t)
    this.spent.set(t, cost)
    return true
  }
  upgrade(t: Tower): boolean {
    if (t.level >= t.maxLevel) return false
    const cost = TOWER_DEFS[t.kind][t.level + 1].cost
    if (!this.state.spend(cost)) return false
    t.upgrade(); this.spent.set(t, (this.spent.get(t) ?? 0) + cost)
    return true
  }
  sellValue(t: Tower): number { return Math.floor((this.spent.get(t) ?? 0) * 0.6) }
  sell(t: Tower): void {
    this.state.add(this.sellValue(t))
    this.spent.delete(t)
    const idx = this.towers.indexOf(t); if (idx >= 0) this.towers.splice(idx, 1)
    const spot = this.spots.find((s) => s.tower === t); if (spot) spot.tower = null
  }

  startWave(): void {
    if (this.state.phase !== 'build') return
    this.wm.startWave(this.state.wave)
    this.state.startWave()
  }

  tick(dt: number): void {
    if (this.state.phase !== 'wave') return
    const step = dt * this.speed
    this.wm.update(step)
    const active = this.wm.active
    for (const e of active) e.update(step)

    // leaks
    for (const e of [...active]) {
      if (e.reachedBase) { this.state.damageBase(e.leak); this.wm.remove(e) }
    }
    if (this.state.phase === 'lose') return

    // towers fire
    for (const t of this.towers) {
      const shot = t.update(step, active)
      if (!shot) continue
      if (shot.aura) {
        for (const e of active) if (Math.hypot(e.pos.x - t.pos.x, e.pos.y - t.pos.y) <= shot.aura.range) e.applySlow(shot.aura.slow, 0.25)
      } else {
        applyShot(shot, active, this.pitch)
      }
    }

    // deaths → bounty
    for (const e of [...this.wm.active]) {
      if (e.hp <= 0) { this.state.add(e.bounty); this.wm.remove(e) }
    }

    if (this.wm.cleared()) this.state.endWave()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/game.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/Game.ts tests/game/game.test.ts
git commit -m "Игра: оркестратор (тик, бой, экономика, волны)"
```

---

### Task 10: Render layers — enemies, towers, FX

**Files:**
- Create: `src/render/GameLayers.ts`
- Modify: `src/render/Renderer.ts` (add a `game` container group above `trace`, below `overlay`)
- Test: `tests/render/enemyColor.test.ts`

**Interfaces:**
- Consumes: `Application`, `Container`, `Graphics` (pixi); `Game`; `Enemy`; `Tower`; `PALETTE`.
- Produces:
  - `enemyColor(kind: string): number` (pure, tested) — color per enemy kind.
  - `class GameLayers { constructor(parent: Container); draw(game: Game, selected: Tower | null): void; clear(): void }` — per-frame redraw of enemies (glowing dot sized by kind + HP bar), towers (kind icon, range ring if selected, aura ring for slow), and simple fire FX (a short line from tower to target this frame). Destroys children each redraw (matches existing cleanup).

- [ ] **Step 1: Write the failing test**

```ts
// tests/render/enemyColor.test.ts
import { describe, it, expect } from 'vitest'
import { enemyColor } from '../../src/render/GameLayers'

describe('enemyColor', () => {
  it('returns a distinct number per kind', () => {
    const kinds = ['normal','fast','tank','rogue','brute','healer','boss']
    const colors = kinds.map(enemyColor)
    expect(new Set(colors).size).toBe(kinds.length)
    for (const c of colors) expect(typeof c).toBe('number')
  })
  it('falls back for unknown kind', () => { expect(typeof enemyColor('xyz')).toBe('number') })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/render/enemyColor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/render/GameLayers.ts
import { Container, Graphics } from 'pixi.js'
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { PALETTE } from '../style/palette'

const ENEMY_COLORS: Record<string, number> = {
  normal: 0xe0e0e0, fast: 0x6cf2a0, tank: 0xe8c84a, rogue: 0x3fb6d8,
  brute: 0xe8503a, healer: 0xff8ad0, boss: 0xffd24a,
}
export function enemyColor(kind: string): number { return ENEMY_COLORS[kind] ?? 0xffffff }

const ENEMY_RADIUS: Record<string, number> = { normal: 6, fast: 5, tank: 9, rogue: 4, brute: 11, healer: 7, boss: 16 }

export class GameLayers {
  private root = new Container()
  constructor(parent: Container) { parent.addChild(this.root) }
  clear(): void { for (const c of this.root.removeChildren()) c.destroy() }

  draw(game: Game, selected: Tower | null): void {
    this.clear()
    const g = new Graphics()
    // towers
    for (const t of game.towers) {
      g.rect(t.pos.x - 8, t.pos.y - 8, 16, 16).fill({ color: PALETTE.buildGold, alpha: 0.9 })
      g.circle(t.pos.x, t.pos.y, 4).fill({ color: PALETTE.substrate })
      if (t.stats.aura) g.circle(t.pos.x, t.pos.y, t.stats.range * game.pitch).stroke({ color: PALETTE.specialCyan, width: 1, alpha: 0.3 })
    }
    if (selected) g.circle(selected.pos.x, selected.pos.y, selected.stats.range * game.pitch).stroke({ color: PALETTE.traceCore, width: 1.5, alpha: 0.5 })
    // enemies + hp bars
    for (const e of game.enemies()) {
      if (!e.alive) continue
      const r = ENEMY_RADIUS[e.kind] ?? 6
      g.circle(e.pos.x, e.pos.y, r + 2).fill({ color: enemyColor(e.kind), alpha: 0.25 })
      g.circle(e.pos.x, e.pos.y, r).fill({ color: enemyColor(e.kind), alpha: 1 })
      const w = r * 2, hpFrac = e.hp / e.maxHp
      g.rect(e.pos.x - r, e.pos.y - r - 5, w, 2).fill({ color: 0x000000, alpha: 0.6 })
      g.rect(e.pos.x - r, e.pos.y - r - 5, w * hpFrac, 2).fill({ color: 0x6cf2a0, alpha: 1 })
    }
    this.root.addChild(g)
  }
}
```

Note: `Game.pitch` is `readonly` (public) per Task 9, so `t.stats.range * game.pitch` and `selected.stats.range * game.pitch` resolve cleanly — no casts.

- [ ] **Step 4: Wire into Renderer**

In `src/render/Renderer.ts`, add a `game` Container to `this.layers` created between `trace` and `overlay` in the `world` addChild order, exposed so the play loop can attach `GameLayers` to it. (Add `game: new Container()` to the layers object and include it in the `world.addChild(...)` call in the correct order.)

- [ ] **Step 5: Run test to verify it passes + build**

Run: `npx vitest run tests/render/enemyColor.test.ts` → PASS.
Run: `npm run build` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/render/GameLayers.ts src/render/Renderer.ts tests/render/enemyColor.test.ts
git commit -m "Рендер: слой игры (враги, башни, HP, аура)"
```

---

### Task 11: HUD + tower/build UI

**Files:**
- Create: `src/ui/GameUI.ts`
- Modify: `src/ui/styles.css` (HUD + menu + tower-panel styles)
- Test: `tests/ui/gameui.test.ts`

**Interfaces:**
- Consumes: `Game`; `Tower`; `TOWER_DEFS`, `TowerKind`.
- Produces:
  - `formatHud(state: { wave: number; waveCount: number; lives: number; gold: number; phase: string }): { wave: string; lives: string; gold: string }` (pure, tested).
  - `class GameUI { constructor(opts: { onBuild(kind: TowerKind): void; onStartWave(): void; onTogglePlay(): void; onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void }); mountHud(): HTMLElement; update(game: Game): void; showTower(t: Tower | null, sellValue: number): void; selectedBuildKind(): TowerKind | null }`
  - HUD shows WAVE x/N, LIVES, CURRENCY, Start-Wave/Play-Pause/Speed buttons; build menu lists the 5 tower kinds with cost (clicking one arms it for placement); tower panel shows stats + Upgrade/Sell/target-mode when a tower is selected.

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { formatHud } from '../../src/ui/GameUI'

describe('formatHud', () => {
  it('formats wave/lives/gold', () => {
    const h = formatHud({ wave: 3, waveCount: 10, lives: 18, gold: 250, phase: 'build' })
    expect(h.wave).toBe('WAVE 3/10')
    expect(h.lives).toBe('LIVES 18')
    expect(h.gold).toBe('CURRENCY 250')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/gameui.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** (`formatHud` + a DOM-building `GameUI`)

```ts
// src/ui/GameUI.ts
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { TOWER_DEFS, type TowerKind } from '../game/towerTypes'

export function formatHud(s: { wave: number; waveCount: number; lives: number; gold: number; phase: string }) {
  return { wave: `WAVE ${s.wave}/${s.waveCount}`, lives: `LIVES ${s.lives}`, gold: `CURRENCY ${s.gold}` }
}

const KINDS: TowerKind[] = ['cannon', 'slow', 'sniper', 'mortar', 'tesla']

export class GameUI {
  private armed: TowerKind | null = null
  private elWave!: HTMLElement; private elLives!: HTMLElement; private elGold!: HTMLElement
  private panel!: HTMLElement
  constructor(private opts: {
    onBuild(kind: TowerKind): void; onStartWave(): void; onTogglePlay(): void
    onSpeed(mult: number): void; onUpgrade(): void; onSell(): void; onTargetMode(): void
  }) {}

  selectedBuildKind(): TowerKind | null { return this.armed }

  mountHud(): HTMLElement {
    const bar = document.createElement('div'); bar.className = 'pcb-gamebar'
    this.elWave = document.createElement('span'); this.elLives = document.createElement('span'); this.elGold = document.createElement('span')
    bar.append(this.elWave, this.elLives, this.elGold)
    const mkBtn = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; bar.appendChild(b); return b }
    mkBtn('Start Wave', this.opts.onStartWave)
    mkBtn('Play/Pause', this.opts.onTogglePlay)
    mkBtn('1×', () => this.opts.onSpeed(1)); mkBtn('2×', () => this.opts.onSpeed(2)); mkBtn('4×', () => this.opts.onSpeed(4))
    for (const k of KINDS) {
      const cost = TOWER_DEFS[k][0].cost
      mkBtn(`${k} $${cost}`, () => { this.armed = k; this.opts.onBuild(k) })
    }
    document.body.appendChild(bar)
    this.panel = document.createElement('div'); this.panel.className = 'pcb-towerpanel'; this.panel.style.display = 'none'
    document.body.appendChild(this.panel)
    return bar
  }

  update(game: Game): void {
    const s = game.state
    const h = formatHud({ wave: s.waveNumber, waveCount: s.waveCount, lives: s.lives, gold: s.gold, phase: s.phase })
    this.elWave.textContent = h.wave; this.elLives.textContent = h.lives; this.elGold.textContent = h.gold
  }

  showTower(t: Tower | null, sellValue: number): void {
    if (!t) { this.panel.style.display = 'none'; this.armed = null; return }
    const s = t.stats
    this.panel.style.display = 'block'
    this.panel.innerHTML = `<h3>${t.kind.toUpperCase()} L${t.level + 1}</h3>
      <div>DMG ${s.damage} · RATE ${s.fireRate} · RANGE ${s.range}</div>
      <div>MODE ${t.targetMode}</div>`
    const mk = (label: string, fn: () => void) => { const b = document.createElement('button'); b.textContent = label; b.onclick = fn; this.panel.appendChild(b) }
    if (t.level < t.maxLevel) mk(`Upgrade $${TOWER_DEFS[t.kind][t.level + 1].cost}`, this.opts.onUpgrade)
    mk(`Sell $${sellValue}`, this.opts.onSell)
    mk('Target: ' + t.targetMode, this.opts.onTargetMode)
  }
}
```

```css
/* append to src/ui/styles.css */
.pcb-gamebar { position: fixed; bottom: 8px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; align-items: center; z-index: 10; background: rgba(13,31,23,0.9); border: 1px solid #1f8f4d; padding: 6px 10px; color: #6cf2a0; font: 12px monospace; }
.pcb-gamebar button { background: #0d1f17; color: #6cf2a0; border: 1px solid #1f8f4d; padding: 5px 8px; font: 11px monospace; cursor: pointer; }
.pcb-gamebar button:hover { background: #14140f; }
.pcb-towerpanel { position: fixed; top: 120px; right: 16px; width: 190px; background: rgba(13,31,23,0.92); border: 1px solid #1f8f4d; color: #6f8f7e; padding: 10px 12px; font: 12px monospace; z-index: 11; }
.pcb-towerpanel h3 { color: #6cf2a0; margin: 0 0 6px; letter-spacing: 1px; }
.pcb-towerpanel button { display: block; width: 100%; margin-top: 6px; background: #0d1f17; color: #6cf2a0; border: 1px solid #1f8f4d; padding: 5px; font: 11px monospace; cursor: pointer; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/gameui.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/GameUI.ts src/ui/styles.css tests/ui/gameui.test.ts
git commit -m "UI: HUD, меню башен, панель прокачки/продажи"
```

---

### Task 12: Play-mode integration (ticker + pointer build) in main.ts

**Files:**
- Modify: `src/main.ts`
- Test: manual (Pixi + DOM); logic already covered by Tasks 1–9.

**Interfaces:**
- Consumes: `Game`; `GameLayers`; `GameUI`; `Renderer` (with `layers.game`); `Camera`; existing editor wiring.

- [ ] **Step 1: Wire play mode into `boot()`**

After the editor/toolbar setup in `src/main.ts`, add:

```ts
import { Game } from './game/Game'
import { GameLayers } from './render/GameLayers'
import { GameUI } from './ui/GameUI'
import type { TowerKind } from './game/towerTypes'
import type { Tower } from './game/Tower'

// ...inside boot(), after the editor + mountToolbar setup, with `renderer`, `camera`, `editor`, `app` in scope:
let game: Game | null = null
let selectedTower: Tower | null = null
const gameLayers = new GameLayers(renderer.layers.game)

const ui = new GameUI({
  onBuild: () => {},                       // arming handled inside GameUI; placement on canvas click
  onStartWave: () => { ensureGame(); game!.startWave() },
  onTogglePlay: () => { game && (game.speed = game.speed === 0 ? 1 : 0) },
  onSpeed: (m) => { if (game) game.speed = m },
  onUpgrade: () => { if (game && selectedTower) { game.upgrade(selectedTower); ui.showTower(selectedTower, game.sellValue(selectedTower)) } },
  onSell: () => { if (game && selectedTower) { game.sell(selectedTower); selectedTower = null; ui.showTower(null, 0) } },
  onTargetMode: () => { if (selectedTower) { selectedTower.cycleTargetMode(); ui.showTower(selectedTower, game!.sellValue(selectedTower)) } },
})
ui.mountHud()

function ensureGame() {
  if (!game && editor.state.level) { game = new Game(editor.state.level, ++seedCounter); selectedTower = null }
}

// build/select on canvas click during play
app.canvas.addEventListener('pointerdown', (e) => {
  if (!game) return
  const r = app.canvas.getBoundingClientRect()
  const wx = (e.clientX - r.left - camera.x) / camera.zoom
  const wy = (e.clientY - r.top - camera.y) / camera.zoom
  // nearest spot within ~1 cell
  const cells = game.spotCells(); const pitch = editor.state.board.pitch
  let bestI = -1, bestD = pitch
  cells.forEach((c, i) => { const cx = c[0]*pitch + pitch/2, cy = c[1]*pitch + pitch/2; const d = Math.hypot(cx-wx, cy-wy); if (d < bestD) { bestD = d; bestI = i } })
  if (bestI < 0) return
  const kind = ui.selectedBuildKind()
  if (kind && game.canBuild(bestI)) { game.build(kind, bestI) }
  else { const t = game.towers.find((tw) => Math.hypot(tw.pos.x-wx, tw.pos.y-wy) <= pitch); selectedTower = t ?? null; ui.showTower(selectedTower, selectedTower ? game.sellValue(selectedTower) : 0) }
})

// game loop on the Pixi ticker
app.ticker.add((ticker) => {
  if (!game) return
  game.tick(ticker.deltaMS / 1000)
  gameLayers.draw(game, selectedTower)
  ui.update(game)
})
```

Note: regenerate (`onGenerate`) and load should reset `game = null` and `gameLayers.clear()` so a fresh level isn't played with a stale `Game`. Add `game = null; selectedTower = null; gameLayers.clear(); ui.showTower(null,0)` to the existing `onGenerate`/`onNew`/`onLoad`/`onResize` handlers.

- [ ] **Step 2: Build + manual verification**

Run: `npm run build` → succeeds.
Run: `npm run dev` → Auto-Generate a level → click a tower kind in the bottom bar → click a build spot (gold bracket) → tower appears → **Start Wave** → enemies flow along the path, towers fire (lines/dots), enemies take damage/die (gold rises) or leak (lives fall); wave clears → build phase + wave gold; select a tower → panel shows stats with Upgrade/Sell/target-mode; Speed 2×/4× changes pace; clearing all waves → win, lives 0 → lose. Compare enemies/towers visually sit on the trace and spots.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "Игра: режим игры — тикер, постройка по клику, цикл"
```

---

## Self-Review Notes (spec coverage)
- Enemy types/flows → Tasks 1,3,4,5. Tower types/combat → 1,6,7. Difficulty/economy → 2,8.
- Multi-path 50/50 spawn assignment → Task 5 (`WaveManager` random path). Filleted px path → Task 9.
- Build/upgrade/sell + gating + economy → Tasks 8,9,11. Win/lose/phases → Task 8, driven in 9.
- Render enemies/towers/FX/HP/aura → Task 10. HUD + build menu + tower panel → Task 11.
- Ticker loop + pointer build/select play mode → Task 12.
- Tests: PathFollower, Enemy(armor/slow/death/leak), WaveManager(counts + ~50/50), Tower(targeting/cadence/aura), combat(splash/chain), GameState(economy/phases), Game integration → Tasks 3–9; render/ui pure helpers → 10,11.

Out of scope (G2): Monte-Carlo balance optimizer / guaranteed-winnable spot tuning; tile track; audio; campaign/save; enemy hero-attack & healer-heal runtime (fields ported, behavior later).
