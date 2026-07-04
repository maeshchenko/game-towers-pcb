# План: этап 0 (рендер-фундамент) + этап 1 (честные снаряды)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить rebuild-per-frame рендер на персистентные pooled-объекты, ввести типизированный event bus и spatial grid, перевести PULSE/MISSILE на честные снаряды в симуляции.

**Architecture:** Сим (`src/game`) остаётся framework-free: event bus и spatial grid живут там и покрываются юнит-тестами. Рендер подписывается на события и синхронизирует персистентные view-объекты (Map по сущности + пулы) вместо полной перерисовки. Снаряды — сущности сима, урон при долёте; LASER/TESLA остаются мгновенными.

**Tech Stack:** Pixi.js v8, TypeScript strict, Vitest. Новых зависимостей в этих этапах НЕТ (GSAP/pixi-filters — этап 2).

**Spec:** `docs/superpowers/specs/2026-07-02-render-refactor-juice-design.md`

## Global Constraints

- TypeScript strict; `npm run build` (tsc + vite build) обязан проходить после каждой задачи.
- `npm run test` зелёный после каждой задачи.
- Сим (`src/game`, `src/geom`, `src/pipeline`, `src/tiles`) — без импортов pixi.
- **Git-операции выполняет пользователь** — задачи НЕ содержат шагов commit. По завершении задачи сообщить пользователю, что можно коммитить (сообщение — на русском, без упоминаний AI).
- Не ломать headless-сим (`src/game/sim.ts`) и авто-балансировщик (`npm run balance:optimize`).
- Комментарии в коде — на английском (стиль репо).

---

### Task 1: Event bus в симе

**Files:**
- Create: `src/game/events.ts`
- Test: `tests/game/events.test.ts`

**Interfaces:**
- Produces: `GameEvent` (discriminated union), `EventBus` с `on(handler): () => void` и `emit(e: GameEvent): void`. Task 2 подключает шину к `Game`, задачи 7–10 подписывают рендер, звук.

- [ ] **Step 1: Написать падающий тест**

```ts
// tests/game/events.test.ts
import { describe, it, expect } from 'vitest'
import { EventBus, type GameEvent } from '../../src/game/events'

describe('EventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new EventBus()
    const got: GameEvent[] = []
    bus.on((e) => got.push(e))
    bus.emit({ type: 'leak', kind: 'normal', livesLost: 1 })
    expect(got).toEqual([{ type: 'leak', kind: 'normal', livesLost: 1 }])
  })

  it('unsubscribe stops delivery', () => {
    const bus = new EventBus()
    let n = 0
    const off = bus.on(() => n++)
    bus.emit({ type: 'waveStart', index: 0 })
    off()
    bus.emit({ type: 'waveStart', index: 1 })
    expect(n).toBe(1)
  })

  it('one throwing handler does not break others', () => {
    const bus = new EventBus()
    let n = 0
    bus.on(() => { throw new Error('boom') })
    bus.on(() => n++)
    bus.emit({ type: 'waveEnd', index: 0 })
    expect(n).toBe(1)
  })
})
```

- [ ] **Step 2: Прогнать — убедиться, что падает**

Run: `npx vitest run tests/game/events.test.ts`
Expected: FAIL — модуль `src/game/events` не существует.

- [ ] **Step 3: Реализация**

```ts
// src/game/events.ts
// Framework-free typed event bus. The sim publishes; render/audio/UI subscribe.
import type { Pt } from '../geom/types'
import type { TowerKind } from './towerTypes'
import type { EnemyKind } from './enemyTypes'

export type GameEvent =
  | { type: 'shotFired'; kind: TowerKind; from: Pt; to: Pt; towerLevel: number }
  | { type: 'enemyDamaged'; kind: EnemyKind; amount: number; pos: Pt }
  | { type: 'enemyDied'; kind: EnemyKind; pos: Pt; bounty: number }
  | { type: 'enemySpawned'; kind: EnemyKind; pos: Pt }
  | { type: 'leak'; kind: EnemyKind; livesLost: number }
  | { type: 'waveStart'; index: number }
  | { type: 'waveEnd'; index: number }
  | { type: 'towerBuilt'; kind: TowerKind; pos: Pt }
  | { type: 'towerUpgraded'; kind: TowerKind; pos: Pt; level: number }
  | { type: 'towerSold'; kind: TowerKind; pos: Pt }
  | { type: 'baseHit'; livesLost: number }
  | { type: 'projectileImpact'; kind: TowerKind; pos: Pt; splashRadius?: number }

export class EventBus {
  private handlers = new Set<(e: GameEvent) => void>()
  on(h: (e: GameEvent) => void): () => void {
    this.handlers.add(h)
    return () => this.handlers.delete(h)
  }
  emit(e: GameEvent): void {
    for (const h of this.handlers) {
      try { h(e) } catch (err) { console.error('event handler failed', err) }
    }
  }
}
```

- [ ] **Step 4: Прогнать тест — зелёный**

Run: `npx vitest run tests/game/events.test.ts`
Expected: PASS (3 теста).

---

### Task 2: Game публикует события, `onSfx` умирает

**Files:**
- Modify: `src/game/Game.ts` (поле `events`, эмиты; удалить `onSfx`)
- Modify: `src/game/combat.ts` (опциональный `emit` для `enemyDamaged`)
- Modify: `src/main.ts:300-307` (звук через шину вместо `onSfx`)
- Test: `tests/game/game-events.test.ts`

**Interfaces:**
- Consumes: `EventBus`, `GameEvent` из Task 1.
- Produces: `Game.events: EventBus` (readonly). Эмиты: `towerBuilt/Upgraded/Sold`, `waveStart`, `waveEnd`, `shotFired`, `enemyDied`, `enemySpawned`, `leak`, `baseHit`, `enemyDamaged`. Поле `game.onSfx` удалено.
- `applyShot(shot, enemies, pitch, emit?)` — 4-й опциональный параметр `(e: GameEvent) => void`.

- [ ] **Step 1: Написать падающий тест**

Для теста нужен минимальный уровень. В `tests/` уже есть хелперы создания уровней — найти существующий паттерн (`grep -rn "new Game(" tests/`) и переиспользовать его функцию построения уровня. Тест (адаптировать создание `Game` под найденный хелпер):

```ts
// tests/game/game-events.test.ts
import { describe, it, expect } from 'vitest'
import type { GameEvent } from '../../src/game/events'
// + импорт существующего хелпера уровня из соседних тестов

describe('Game events', () => {
  it('emits towerBuilt on build', () => {
    const game = makeTestGame() // хелпер из существующих тестов
    const got: GameEvent[] = []
    game.events.on((e) => got.push(e))
    game.build('cannon', 0)
    expect(got.some((e) => e.type === 'towerBuilt' && e.kind === 'cannon')).toBe(true)
  })

  it('emits waveStart on startWave', () => {
    const game = makeTestGame()
    const got: GameEvent[] = []
    game.events.on((e) => got.push(e))
    game.startWave()
    expect(got.some((e) => e.type === 'waveStart' && e.index === 0)).toBe(true)
  })

  it('emits enemyDied with bounty when enemy is killed in tick', () => {
    const game = makeTestGame()
    game.startWave()
    // прогнать спавн, убить первого врага напрямую
    game.tick(0.1)
    const e = game.enemies()[0]
    expect(e).toBeDefined()
    const got: GameEvent[] = []
    game.events.on((ev) => got.push(ev))
    e.takeDamage(999999, 999)
    game.tick(0.016)
    expect(got.some((ev) => ev.type === 'enemyDied')).toBe(true)
  })
})
```

- [ ] **Step 2: Прогнать — падает** (`game.events` undefined)

- [ ] **Step 3: Реализация**

В `Game.ts`:

```ts
import { EventBus } from './events'
// в классе:
readonly events = new EventBus()
// удалить: public onSfx?: (type: string) => void
```

Точки эмита (все `this.events.emit(...)`):
- `build()` после `this.towers.push(t)`: `{ type: 'towerBuilt', kind, pos: t.pos }`
- `upgrade()` после `t.upgrade()`: `{ type: 'towerUpgraded', kind: t.kind, pos: t.pos, level: t.level }`
- `sell()` в конце: `{ type: 'towerSold', kind: t.kind, pos: t.pos }`
- `startWave()` после `this.state.startWave()`: `{ type: 'waveStart', index: this.state.wave - 0 }` — индекс волны, которая началась (до инкремента: `this.state.wave` уже указывает на неё в момент `startWave`, значение снять ДО `this.state.startWave()`).
- `tick()`:
  - спавны: `const spawned = this.wm.update(step)` (метод уже возвращает массив) → для каждого `{ type: 'enemySpawned', kind: e.kind, pos: { x: e.pos.x, y: e.pos.y } }`
  - утечки: вместо `this.onSfx('leak')` → `{ type: 'leak', kind: e.kind, livesLost: e.leak }` и следом `{ type: 'baseHit', livesLost: e.leak }`
  - выстрелы: вместо `this.onSfx('shoot_' + t.kind)` → `{ type: 'shotFired', kind: t.kind, from: t.pos, to: { x: shot.target.pos.x, y: shot.target.pos.y }, towerLevel: t.level }`
  - смерти: вместо `this.onSfx('kill')` → `{ type: 'enemyDied', kind: e.kind, pos: { x: e.pos.x, y: e.pos.y }, bounty: e.bounty }`
  - конец волны: рядом с `if (this.wm.cleared()) this.state.endWave()` — снять индекс до вызова и эмитить `{ type: 'waveEnd', index }`.
- `applyShot` в `combat.ts` — добавить 4-й параметр и эмитить по каждому реальному урону:

```ts
export function applyShot(shot: ShotResult, enemies: Enemy[], pitch: number, emit?: (e: GameEvent) => void): void {
  // ... в каждом месте, где вызывается takeDamage с dmg > 0:
  // emit?.({ type: 'enemyDamaged', kind: e.kind, amount: dmg, pos: { x: e.pos.x, y: e.pos.y } })
}
```

Вызов в `Game.tick`: `applyShot(shot, active, this.pitch, (e) => this.events.emit(e))`.

В `main.ts` (`ensureGame`, строки ~300–307) заменить назначение `game.onSfx` на:

```ts
game.events.on((e) => {
  if (e.type === 'leak') audioEngine.playLeak()
  else if (e.type === 'enemyDied') audioEngine.playEnemyDeath()
  else if (e.type === 'shotFired') audioEngine.playShot(e.kind as any)
})
```

- [ ] **Step 4: Тесты + типы**

Run: `npx vitest run tests/game/ && npm run build`
Expected: PASS; build зелёный (все ссылки на `onSfx` удалены — проверить `grep -rn onSfx src tests scripts`).

---

### Task 3: SpatialGrid

**Files:**
- Create: `src/game/SpatialGrid.ts`
- Test: `tests/game/spatial-grid.test.ts`

**Interfaces:**
- Produces: `SpatialGrid<T extends { pos: Pt }>` с `rebuild(items: T[])` и `queryCircle(center: Pt, r: number): T[]`. Task 4 использует для таргетинга/сплэша/хилера, Task 5 — для перенаводки снарядов.

- [ ] **Step 1: Падающий тест**

```ts
// tests/game/spatial-grid.test.ts
import { describe, it, expect } from 'vitest'
import { SpatialGrid } from '../../src/game/SpatialGrid'

const item = (x: number, y: number) => ({ pos: { x, y } })

describe('SpatialGrid', () => {
  it('queryCircle returns exactly the items inside the radius', () => {
    const grid = new SpatialGrid<{ pos: { x: number; y: number } }>(30)
    const inside = [item(0, 0), item(25, 0), item(0, -29)]
    const outside = [item(31, 0), item(100, 100), item(-40, 5)]
    grid.rebuild([...inside, ...outside])
    const got = grid.queryCircle({ x: 0, y: 0 }, 30)
    expect(new Set(got)).toEqual(new Set(inside))
  })

  it('matches brute force on random data', () => {
    const grid = new SpatialGrid<{ pos: { x: number; y: number } }>(30)
    let s = 42
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const items = Array.from({ length: 300 }, () => item(rnd() * 1800, rnd() * 1350))
    grid.rebuild(items)
    for (let q = 0; q < 20; q++) {
      const c = { x: rnd() * 1800, y: rnd() * 1350 }, r = 30 + rnd() * 300
      const brute = items.filter((i) => Math.hypot(i.pos.x - c.x, i.pos.y - c.y) <= r)
      expect(new Set(grid.queryCircle(c, r))).toEqual(new Set(brute))
    }
  })

  it('rebuild clears previous contents', () => {
    const grid = new SpatialGrid<{ pos: { x: number; y: number } }>(30)
    grid.rebuild([item(0, 0)])
    grid.rebuild([])
    expect(grid.queryCircle({ x: 0, y: 0 }, 100)).toEqual([])
  })
})
```

- [ ] **Step 2: Прогнать — падает** (модуль отсутствует)

- [ ] **Step 3: Реализация**

```ts
// src/game/SpatialGrid.ts
// Uniform hash grid for circle queries over moving entities. Rebuilt each tick (cheap),
// queried by towers/splash/chain/healer instead of scanning the full enemy list.
import type { Pt } from '../geom/types'

export class SpatialGrid<T extends { pos: Pt }> {
  private buckets = new Map<number, T[]>()
  constructor(private cellSize: number) {}

  private key(cx: number, cy: number): number { return cy * 65536 + cx + 1073741824 }

  rebuild(items: T[]): void {
    this.buckets.clear()
    for (const it of items) {
      const cx = Math.floor(it.pos.x / this.cellSize), cy = Math.floor(it.pos.y / this.cellSize)
      const k = this.key(cx, cy)
      const b = this.buckets.get(k)
      if (b) b.push(it); else this.buckets.set(k, [it])
    }
  }

  queryCircle(center: Pt, r: number): T[] {
    const out: T[] = []
    const x0 = Math.floor((center.x - r) / this.cellSize), x1 = Math.floor((center.x + r) / this.cellSize)
    const y0 = Math.floor((center.y - r) / this.cellSize), y1 = Math.floor((center.y + r) / this.cellSize)
    const r2 = r * r
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const b = this.buckets.get(this.key(cx, cy))
      if (!b) continue
      for (const it of b) {
        const dx = it.pos.x - center.x, dy = it.pos.y - center.y
        if (dx * dx + dy * dy <= r2) out.push(it)
      }
    }
    return out
  }
}
```

- [ ] **Step 4: Тест зелёный**

Run: `npx vitest run tests/game/spatial-grid.test.ts` → PASS.

---

### Task 4: Grid в таргетинге, сплэше, цепи, хилере

**Files:**
- Modify: `src/game/Game.ts` (создание грида в `tick`, хилер через грид)
- Modify: `src/game/Tower.ts` (`update(dt, enemies, grid?)`)
- Modify: `src/game/combat.ts` (сплэш/цепь через грид при наличии)
- Test: `tests/game/grid-integration.test.ts`

**Interfaces:**
- Consumes: `SpatialGrid` из Task 3.
- Produces: `Tower.update(dt: number, enemies: Enemy[], grid?: SpatialGrid<Enemy>): ShotResult | null` (grid опционален — без него старый линейный скан, существующие тесты живы); `applyShot(shot, enemies, pitch, emit?, grid?)`.

- [ ] **Step 1: Падающий тест**

```ts
// tests/game/grid-integration.test.ts
import { describe, it, expect } from 'vitest'
import { SpatialGrid } from '../../src/game/SpatialGrid'
import { Tower } from '../../src/game/Tower'
// фейковый Enemy: достаточно pos/alive/traveled/hp (утиная типизация как в существующих тестах Tower — проверить grep'ом их паттерн)

describe('Tower targeting via grid', () => {
  it('grid path picks the same target as linear scan', () => {
    const mk = (x: number, traveled: number) =>
      ({ pos: { x, y: 0 }, alive: true, traveled, hp: 10, maxHp: 10 }) as any
    const enemies = [mk(30, 5), mk(60, 10), mk(500, 20)]
    const grid = new SpatialGrid<any>(30)
    grid.rebuild(enemies)
    const a = new Tower('cannon', { x: 0, y: 0 }, 30)
    const b = new Tower('cannon', { x: 0, y: 0 }, 30)
    const shotLinear = a.update(10, enemies)          // cannon range 6*30=180px → цель traveled=10 (x=60)
    const shotGrid = b.update(10, enemies, grid)
    expect(shotLinear?.target).toBe(enemies[1])
    expect(shotGrid?.target).toBe(enemies[1])
  })
})
```

- [ ] **Step 2: Прогнать — падает** (третий аргумент не принимается / tsc ругается)

- [ ] **Step 3: Реализация**

`Tower.update`: кандидаты = `grid ? grid.queryCircle(this.pos, rangePx) : enemies`, дальше существующий цикл выбора цели по `targetMode` без изменения логики (проверка `dist <= rangePx` остаётся — для линейного пути; для грида она уже выполнена, повторная проверка безвредна).

`combat.applyShot`: добавить 5-й параметр `grid?: SpatialGrid<Enemy>`; в сплэше и цепи кандидаты = `grid ? grid.queryCircle(target.pos, r) : enemies`.

`Game.tick`: после апдейта врагов:

```ts
this.grid.rebuild(active)   // поле: private grid = new SpatialGrid<Enemy>(this.pitch) — инициализировать в конструкторе после this.pitch
```

- хилер: `const near = this.grid.queryCircle(healer.pos, healRadius)` вместо внутреннего цикла по `active`;
- башни: `t.update(step, active, this.grid)`;
- выстрелы: `applyShot(shot, active, this.pitch, (e) => this.events.emit(e), this.grid)`.

- [ ] **Step 4: Все тесты + build**

Run: `npm run test && npm run build` → PASS. Отдельно прогнать `npm run balance:optimize` не нужно (поведение идентично) — но `tests` покрывающие сим обязаны быть зелёными.

---

### Task 5: Снаряды в симе (PULSE-пуля, MISSILE-ракета)

**Files:**
- Create: `src/game/Projectile.ts`
- Modify: `src/game/towerTypes.ts` (поле `projectileSpeed?: number` — клеток/с)
- Modify: `src/game/Enemy.ts` (трекинг скорости для упреждения: поле `vel`)
- Modify: `src/game/Game.ts` (спавн/апдейт снарядов, урон при долёте)
- Test: `tests/game/projectile.test.ts`

**Interfaces:**
- Consumes: `SpatialGrid`, `EventBus`, `applyShot` (Task 2–4).
- Produces: `Projectile` `{ readonly kind: TowerKind; pos: Pt; readonly shot: ShotResult; update(dt, speedPx): boolean }`; `Game.projectiles: Projectile[]` (readonly getter — рендер читает); `Enemy.vel: Pt` (px/с, обновляется в `Enemy.update`); событие `projectileImpact`.
- `TOWER_DEFS`: `cannon` получает `projectileSpeed: 18` на всех уровнях, `mortar` — `projectileSpeed: 7`. У sniper/tesla/slow поля НЕТ → мгновенный путь как раньше.

- [ ] **Step 1: Падающие тесты**

```ts
// tests/game/projectile.test.ts
import { describe, it, expect } from 'vitest'
import { Projectile } from '../../src/game/Projectile'
import { SpatialGrid } from '../../src/game/SpatialGrid'

const mkEnemy = (x: number, y: number) => ({
  pos: { x, y }, vel: { x: 0, y: 0 }, alive: true, hp: 50, maxHp: 50, kind: 'normal',
  taken: 0,
  takeDamage(n: number) { this.taken += n; this.hp = Math.max(0, this.hp - n) },
  applySlow() {},
}) as any

describe('Projectile', () => {
  it('homing pulse reaches a moving target and damages it on arrival', () => {
    const e = mkEnemy(100, 0)
    const p = new Projectile('cannon', { x: 0, y: 0 }, e, { from: { x: 0, y: 0 }, target: e, damage: 10 })
    let arrived = false
    for (let i = 0; i < 200 && !arrived; i++) {
      e.pos.x += 60 * 0.016 // цель уезжает 60px/с
      arrived = p.update(0.016, 540) // 18 кл/с * 30px
    }
    expect(arrived).toBe(true)
    // урон применяет Game при долёте — тут проверяем только попадание в точку цели
    expect(Math.hypot(p.pos.x - e.pos.x, p.pos.y - e.pos.y)).toBeLessThan(15)
  })

  it('flies to last known position when target dies mid-flight', () => {
    const e = mkEnemy(200, 0)
    const p = new Projectile('cannon', { x: 0, y: 0 }, e, { from: { x: 0, y: 0 }, target: e, damage: 10 })
    p.update(0.016, 540)
    e.hp = 0; e.alive = false
    let arrived = false
    for (let i = 0; i < 200 && !arrived; i++) arrived = p.update(0.016, 540)
    expect(arrived).toBe(true)
    expect(Math.abs(p.pos.x - 200)).toBeLessThan(15)
  })

  it('mortar shell flies to the aim point without homing', () => {
    const e = mkEnemy(150, 0)
    const p = new Projectile('mortar', { x: 0, y: 0 }, null, { from: { x: 0, y: 0 }, damage: 30, splashRadius: 2.6 }, { x: 150, y: 0 })
    e.pos.x = 400 // цель уехала — ракета всё равно летит в точку прицеливания
    let arrived = false
    for (let i = 0; i < 400 && !arrived; i++) arrived = p.update(0.016, 210)
    expect(arrived).toBe(true)
    expect(Math.abs(p.pos.x - 150)).toBeLessThan(10)
  })
})
```

Плюс интеграционный блок в том же файле (через `makeTestGame`-хелпер, как в Task 2): построить cannon, запустить волну, тикать 10 сек симуляции шагами 0.016 и проверить, что суммарное HP врагов уменьшилось И что `game.projectiles.length > 0` хотя бы в один момент; аналогично для мгновенного LASER — `game.projectiles` пуст.

- [ ] **Step 2: Прогнать — падает**

- [ ] **Step 3: Реализация**

```ts
// src/game/Projectile.ts
// A sim-side projectile: damage lands on arrival, not on fire. PULSE homes on its target,
// MISSILE flies ballistically to a fixed aim point (fast enemies can dodge — by design).
import type { Pt } from '../geom/types'
import type { Enemy } from './Enemy'
import type { TowerKind } from './towerTypes'
import type { ShotResult } from './Tower'

const HIT_DIST = 6 // px: close enough to count as a hit

export class Projectile {
  pos: Pt
  private aim: Pt
  constructor(
    readonly kind: TowerKind,
    from: Pt,
    public target: Enemy | null,   // null → ballistic (mortar)
    readonly shot: ShotResult,
    aimPoint?: Pt,
  ) {
    this.pos = { x: from.x, y: from.y }
    this.aim = aimPoint ? { x: aimPoint.x, y: aimPoint.y } : { x: target!.pos.x, y: target!.pos.y }
  }

  /** Advance; returns true when arrived (impact resolved by Game). */
  update(dt: number, speedPx: number): boolean {
    if (this.target) {
      if (this.target.alive) { this.aim.x = this.target.pos.x; this.aim.y = this.target.pos.y }
      else this.target = null // keep flying to last known position
    }
    const dx = this.aim.x - this.pos.x, dy = this.aim.y - this.pos.y
    const d = Math.hypot(dx, dy)
    const step = speedPx * dt
    if (d <= Math.max(HIT_DIST, step)) { this.pos.x = this.aim.x; this.pos.y = this.aim.y; return true }
    this.pos.x += (dx / d) * step
    this.pos.y += (dy / d) * step
    return false
  }
}
```

`Enemy.ts` — скорость для упреждения (в конце `update`, до/после advance):

```ts
// поле:
readonly vel: Pt = { x: 0, y: 0 }
// в update(dt): запомнить prev = {x,y} до advance, после:
if (dt > 0) { this.vel.x = (this.pos.x - prev.x) / dt; this.vel.y = (this.pos.y - prev.y) / dt }
```

`towerTypes.ts`: `projectileSpeed?: number` в `TowerLevel`; проставить `projectileSpeed: 18` во все 3 уровня `cannon`, `projectileSpeed: 7` — во все 3 уровня `mortar`.

`Game.ts`:

```ts
private _projectiles: Projectile[] = []
get projectiles(): Projectile[] { return this._projectiles }
```

В `tick`, в цикле «towers fire», ветка `else` (не аура):

```ts
const spd = t.stats.projectileSpeed
if (spd && shot.target) {
  const speedPx = spd * this.pitch
  if (t.kind === 'mortar') {
    // lead the target: aim where it will be when the shell lands
    const tgt = shot.target
    const eta = Math.hypot(tgt.pos.x - t.pos.x, tgt.pos.y - t.pos.y) / speedPx
    const aim = { x: tgt.pos.x + tgt.vel.x * eta, y: tgt.pos.y + tgt.vel.y * eta }
    this._projectiles.push(new Projectile(t.kind, t.pos, null, shot, aim))
  } else {
    this._projectiles.push(new Projectile(t.kind, t.pos, shot.target, shot))
  }
  this.events.emit({ type: 'shotFired', kind: t.kind, from: t.pos, to: { x: shot.target.pos.x, y: shot.target.pos.y }, towerLevel: t.level })
} else if (shot.target) {
  // instant weapons (sniper beam, tesla arc)
  this.events.emit({ type: 'shotFired', ... })  // как в Task 2
  applyShot(shot, active, this.pitch, (e) => this.events.emit(e), this.grid)
}
```

После цикла башен — апдейт снарядов:

```ts
for (const p of this._projectiles) {
  const spd = (p.shot.damage !== undefined ? TOWER_DEFS[p.kind][0].projectileSpeed! : 0) // скорость: взять из def уровня башни — проще сохранить speedPx в самом Projectile при создании
}
```

Упрощение (принять его): передавать `speedPx` в конструктор `Projectile` и хранить внутри, `update(dt)` без параметра. Тогда цикл:

```ts
const survivors: Projectile[] = []
for (const p of this._projectiles) {
  if (!p.update(step)) { survivors.push(p); continue }
  // impact
  if (p.kind === 'mortar') {
    const r = (p.shot.splashRadius ?? 0) * this.pitch
    const hit = this.grid.queryCircle(p.pos, r)
    for (const e of hit) if (e.alive) {
      e.takeDamage(p.shot.damage ?? 0, p.shot.pierce ?? 0)
      this.events.emit({ type: 'enemyDamaged', kind: e.kind, amount: p.shot.damage ?? 0, pos: { x: e.pos.x, y: e.pos.y } })
    }
  } else {
    // pulse bullet: hit its target, or retarget the nearest live enemy within 1.5 cells, else fizzle
    let victim = p.target && p.target.alive ? p.target : null
    if (!victim) {
      const near = this.grid.queryCircle(p.pos, 1.5 * this.pitch).filter((e) => e.alive)
      near.sort((a, b) => Math.hypot(a.pos.x - p.pos.x, a.pos.y - p.pos.y) - Math.hypot(b.pos.x - p.pos.x, b.pos.y - p.pos.y))
      victim = near[0] ?? null
    }
    if (victim) {
      victim.takeDamage(p.shot.damage ?? 0, p.shot.pierce ?? 0)
      this.events.emit({ type: 'enemyDamaged', kind: victim.kind, amount: p.shot.damage ?? 0, pos: { x: victim.pos.x, y: victim.pos.y } })
    }
  }
  this.events.emit({ type: 'projectileImpact', kind: p.kind, pos: { x: p.pos.x, y: p.pos.y }, splashRadius: p.shot.splashRadius })
}
this._projectiles = survivors
```

ВАЖНО: снаряды апдейтятся ДО блока «deaths → bounty», чтобы киллы от снарядов давали bounty в том же тике. При `resetPlay`/конце волны снаряды НЕ чистить принудительно — они долетят; но при `phase !== 'wave'` тик выходит рано — допустимо (снаряды замрут между волнами на доли секунды и долетят в следующей). Если это заметно глазом — вынести апдейт снарядов выше проверки фазы (решение на усмотрение исполнителя, поведение зафиксировать тестом).

`Fx`-лучи: пуш в `this._fx` оставить ТОЛЬКО для мгновенных (sniper/tesla) — снарядные больше не рисуют мгновенный луч.

- [ ] **Step 4: Тесты + build**

Run: `npm run test && npm run build` → PASS.

---

### Task 6: Ребаланс кампании под снаряды

**Files:**
- Modify (возможно): `src/game/towerTypes.ts` (статы cannon/mortar), `src/game/balance.ts` — только если вылет из полосы
- Test: существующий `npm run balance:optimize`

- [ ] **Step 1: Прогнать балансировщик**

Run: `npm run balance:optimize`
Expected: скрипт отрабатывает; зафиксировать метрики (pressure по уровням).

- [ ] **Step 2: Оценить**

Если все 12 уровней в полосе fairness [0.15, 0.65] — задача закрыта. Если нет — крутить в порядке: `projectileSpeed` (18→22 у cannon; 7→9 у mortar) → `fireRate`/`damage` cannon/mortar (+10–15%) → стоимость. После каждой правки повторный прогон.

- [ ] **Step 3: Финальный прогон всего**

Run: `npm run test && npm run balance:optimize && npm run build` → всё зелёное/в полосе.

---

### Task 7: Новые слои рендера + запечённые текстуры врагов

**Files:**
- Modify: `src/render/Renderer.ts` (слои `decals`, `projectiles`, `particles`, `floatingText`)
- Create: `src/render/views/textures.ts`
- Test: ручная проверка (рендер вне юнит-скоупа; jsdom без WebGL)

**Interfaces:**
- Produces: `Renderer.layers` расширен: порядок детей `world`: `board, copper, decor, decals, trace, spot, game, projectiles, particles, overlay, floatingText`. `bakeEnemyTexture(app: Application, kind: string): Texture` с кэшем `Map<string, Texture>` и `clearTextureCache()`.

- [ ] **Step 1: Слои**

В `Renderer.layers` добавить `decals: new Container()`, `projectiles: new Container()`, `particles: new Container()`, `floatingText: new Container()`; порядок в `world.addChild(...)` — как в Produces. В `render()` эти четыре слоя (как и `game`) НЕ очищать при перерисовке уровня: исключение по имени расширить с `name === 'game'` до `['game', 'decals', 'projectiles', 'particles', 'floatingText'].includes(name)`.

- [ ] **Step 2: Запекание текстур врагов**

```ts
// src/render/views/textures.ts
// Bake each enemy kind's glow+glyph+core into a texture once; sprites batch, Graphics don't.
import { Application, Graphics, Texture } from 'pixi.js'
import { enemyTheme } from '../theme'
import { PALETTE } from '../../style/palette'

export const ENEMY_RADIUS: Record<string, number> = { normal: 8, fast: 6, tank: 12, rogue: 5, brute: 14, healer: 9, boss: 20 }

const cache = new Map<string, Texture>()
export function clearTextureCache(): void { for (const t of cache.values()) t.destroy(true); cache.clear() }

export function bakeEnemyTexture(app: Application, kind: string): Texture {
  const hit = cache.get(kind)
  if (hit) return hit
  const r = ENEMY_RADIUS[kind] ?? 6
  const { color: c, glyph } = enemyTheme(kind)
  const g = new Graphics()
  const cx = r + 6, cy = r + 6 // padding for the glow halo
  g.circle(cx, cy, r + 5).fill({ color: c, alpha: 0.16 })
  g.circle(cx, cy, r + 2).fill({ color: c, alpha: 0.30 })
  // glyph switch — перенести 1-в-1 из drawEnemy (GameLayers.ts:66-77), заменив x,y на cx,cy
  // core:
  g.circle(cx, cy, Math.max(1.5, r * 0.32)).fill({ color: 0xffffff, alpha: 0.85 })
  const tex = app.renderer.generateTexture({ target: g, resolution: 2 })
  g.destroy()
  cache.set(kind, tex)
  return tex
}
```

(вспомогательный `poly(...)` скопировать из `GameLayers.ts:13-19` — после Task 10 GameLayers умирает, так что это перенос, не дублирование).

- [ ] **Step 3: Проверка**

Run: `npm run build` → зелёный. Игра пока рисуется по-старому (GameLayers жив до Task 10).

---

### Task 8: EnemyViews — персистентные спрайты врагов

**Files:**
- Create: `src/render/views/EnemyViews.ts`

**Interfaces:**
- Consumes: `bakeEnemyTexture`, `ENEMY_RADIUS` (Task 7).
- Produces: `EnemyViews` — `constructor(app: Application, layer: Container)`, `sync(enemies: Enemy[], timeSec: number): void`, `destroy(): void`. Вызывается из GameView (Task 10) каждый кадр.

- [ ] **Step 1: Реализация**

```ts
// src/render/views/EnemyViews.ts
// One pooled view per live enemy: baked sprite + tiny HP bar redrawn only when hp changes.
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import type { Enemy } from '../../game/Enemy'
import { PALETTE } from '../../style/palette'
import { bakeEnemyTexture, ENEMY_RADIUS } from './textures'

class EnemyView {
  root = new Container()
  sprite: Sprite
  hpBar = new Graphics()
  pulse = new Graphics() // healer aura ring; empty for others
  lastHp = -1
  constructor(app: Application, kind: string) {
    this.sprite = new Sprite(bakeEnemyTexture(app, kind))
    this.sprite.anchor.set(0.5)
    this.root.addChild(this.pulse, this.sprite, this.hpBar)
  }
}

export class EnemyViews {
  private views = new Map<Enemy, EnemyView>()
  private pool: EnemyView[] = [] // pooled per kind — see retarget note below
  private poolByKind = new Map<string, EnemyView[]>()
  constructor(private app: Application, private layer: Container) {}

  sync(enemies: Enemy[], timeSec: number): void {
    const live = new Set<Enemy>()
    for (const e of enemies) {
      if (!e.alive) continue
      live.add(e)
      let v = this.views.get(e)
      if (!v) {
        v = this.poolByKind.get(e.kind)?.pop() ?? new EnemyView(this.app, e.kind)
        v.lastHp = -1
        v.root.visible = true
        this.layer.addChild(v.root)
        this.views.set(e, v)
      }
      v.root.position.set(e.pos.x, e.pos.y)
      if (e.hp !== v.lastHp) {
        v.lastHp = e.hp
        const r = ENEMY_RADIUS[e.kind] ?? 6
        const w = r * 2, frac = e.hp / e.maxHp
        v.hpBar.clear()
        v.hpBar.rect(-r, -r - 6, w, 2).fill({ color: 0x000000, alpha: 0.6 })
        v.hpBar.rect(-r, -r - 6, w * frac, 2).fill({ color: frac > 0.4 ? PALETTE.neonGreen : PALETTE.neonRed })
      }
      if (e.kind === 'healer') {
        const t = (timeSec / 1.5) % 1
        v.pulse.clear()
        v.pulse.circle(0, 0, 75 * (0.3 + 0.7 * t)).stroke({ color: PALETTE.neonGreen, width: 1.5, alpha: 0.3 * (1 - t) })
      }
    }
    for (const [e, v] of this.views) {
      if (live.has(e)) continue
      this.views.delete(e)
      this.layer.removeChild(v.root)
      v.root.visible = false
      const p = this.poolByKind.get(e.kind) ?? []
      p.push(v); this.poolByKind.set(e.kind, p)
    }
  }

  destroy(): void {
    for (const v of this.views.values()) v.root.destroy({ children: true })
    for (const arr of this.poolByKind.values()) for (const v of arr) v.root.destroy({ children: true })
    this.views.clear(); this.poolByKind.clear()
  }
}
```

- [ ] **Step 2: Build**

Run: `npm run build` → зелёный (класс ещё не подключён — подключение в Task 10).

---

### Task 9: TowerViews, ProjectileViews, BeamFx

**Files:**
- Create: `src/render/views/TowerViews.ts`
- Create: `src/render/views/ProjectileViews.ts`
- Create: `src/render/views/BeamFx.ts`

**Interfaces:**
- Produces:
  - `TowerViews(layer: Container)` — `sync(game: Game, selected: Tower | null)`: Graphics на башню, полная перерисовка ТОЛЬКО при изменении `(level, special, selected)`-ключа; ауры slow и range-кольцо выбранной — в отдельной `overlayG: Graphics`, перерисовываемой при смене selected/набора башен.
  - `ProjectileViews(app, layer)` — `sync(projectiles: Projectile[])`: pooled Sprite на снаряд; текстуры: `cannon` — кружок 4px цвета `TOWER_THEME.cannon.color` с белым ядром; `mortar` — капсула 8×4 оранжевая; ракета получает визуальную дугу: `sprite.y = p.pos.y - arcHeight(progress)`, где `progress` считается по расстоянию от старта к цели, `arcHeight = 0.35 * pitch * 4 * t * (1 - t)`; для этого Projectile должен хранить `readonly from: Pt` и давать `get progress(): number` — добавить в Task 5 сразу (поле уже есть как копия from).
  - `BeamFx(layer, events: EventBus)` — подписка на `shotFired` (только sniper/tesla) и `projectileImpact`; ведёт собственный список `{ from, to, kind, ttl }`, рисует в один Graphics per frame (лучей одновременно мало — приемлемо); `update(dt)`; `destroy()` отписывается. Молния теслы — перенести код из `drawFx` (GameLayers.ts:90-99), splash-кольцо ракеты — по `projectileImpact` с `splashRadius`.
- Перенос `drawTower` из `GameLayers.ts:23-48` в `TowerViews` 1-в-1 (координаты локальные не нужны — Graphics один на башню, рисовать в мировых, `position` не использовать).

- [ ] **Step 1: Реализовать три класса** (код по интерфейсам выше; `drawTower`/`drawFx` переносятся из GameLayers без изменения визуала)

- [ ] **Step 2: Build**

Run: `npm run build` → зелёный.

---

### Task 10: GameView-фасад, смерть GameLayers

**Files:**
- Create: `src/render/GameView.ts`
- Modify: `src/main.ts` (`:144` создание, `:253` reset, `:716` тик)
- Delete: `src/render/GameLayers.ts`

**Interfaces:**
- Consumes: все view-классы Task 7–9.
- Produces:

```ts
export class GameView {
  constructor(app: Application, layers: Renderer['layers'], game: Game)
  update(dtSec: number, selected: Tower | null): void  // вызывать каждый кадр тикера
  destroy(): void                                       // отписки + очистка слоёв
}
```

- [ ] **Step 1: Реализация GameView**

```ts
// src/render/GameView.ts
import { Application } from 'pixi.js'
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import type { Renderer } from './Renderer'
import { EnemyViews } from './views/EnemyViews'
import { TowerViews } from './views/TowerViews'
import { ProjectileViews } from './views/ProjectileViews'
import { BeamFx } from './views/BeamFx'

export class GameView {
  private enemies: EnemyViews
  private towers: TowerViews
  private projectiles: ProjectileViews
  private beams: BeamFx
  private time = 0
  constructor(app: Application, layers: Renderer['layers'], private game: Game) {
    this.enemies = new EnemyViews(app, layers.game)
    this.towers = new TowerViews(layers.game)
    this.projectiles = new ProjectileViews(app, layers.projectiles)
    this.beams = new BeamFx(layers.projectiles, game.events)
  }
  update(dtSec: number, selected: Tower | null): void {
    this.time += dtSec
    this.towers.sync(this.game, selected)
    this.enemies.sync(this.game.enemies(), this.time)
    this.projectiles.sync(this.game.projectiles)
    this.beams.update(dtSec)
  }
  destroy(): void {
    this.enemies.destroy(); this.towers.destroy(); this.projectiles.destroy(); this.beams.destroy()
  }
}
```

- [ ] **Step 2: main.ts**

- `:144` — удалить `const gameLayers = new GameLayers(...)`; добавить `let gameView: GameView | null = null`.
- `ensureGame()` — после создания `game`: `gameView = new GameView(app, renderer.layers, game)`.
- `resetPlay()` (`:253`) — `gameView?.destroy(); gameView = null` вместо `gameLayers.clear()`.
- тикер (`:716`) — `gameView?.update(ticker.deltaMS / 1000, selectedTower)` вместо `gameLayers.draw(game, selectedTower)`.
- Удалить `src/render/GameLayers.ts`; `game.fx` теперь читает только BeamFx? НЕТ — BeamFx питается событиями; поле `Game._fx`/`get fx` и тип `Fx` удалить из `Game.ts` вместе с пушами (sniper/tesla пуши заменены событиями в Task 5). Проверить `grep -rn "\.fx\b\|Fx" src tests scripts`.

- [ ] **Step 3: Полная проверка**

Run: `npm run test && npm run build` → PASS.

- [ ] **Step 4: Ручная верификация (обязательна)**

Run: `npm run dev` → открыть уровень 1, построить PULSE/MISSILE/TESLA/LASER/SLOW, прогнать 3+ волны на 1× и 4×. Чек-лист:
- визуальный паритет: башни/враги/HP-бары/ауры/выделение выглядят как раньше;
- пули PULSE летят и попадают; ракеты MISSILE летят дугой, взрыв на месте прилёта; LASER/TESLA — мгновенные лучи; звуки выстрелов/киллов/утечек на месте;
- переключение уровней/выход в меню/ретрай не оставляют «призраков» (утечка view) и не крашат;
- DevTools Performance на волне 8–10: нет пилообразного GC от графики (главный критерий этапа 0).

---

### Task 11: Перф-контроль на большой доске

**Files:** нет новых — контрольная задача.

- [ ] **Step 1:** Через редактор/URL открыть уровень 60×45 (level 12, `?t=authored-12` — проверить формат URL в `campaign.ts`), догнать до волны 10 (можно временно поднять стартовое золото в консоли не получится — сим закрыт; играть на 4× либо временно `difficulty.ts:5` не трогать, просто выжить с плотной застройкой).
- [ ] **Step 2:** DevTools Performance 20 сек боя: FPS ≥ 55, нет минорных GC чаще ~1/сек, `Graphics.clear` не в топе self-time.
- [ ] **Step 3:** Зафиксировать результат замера в PR-описании/сообщении пользователю. Если FPS < 55 — профилировать: кандидаты №1 — перерисовка HP-баров (сделать реже: только при изменении на ≥1px ширины), №2 — healer pulse (перерисовка каждый кадр допустима, их мало).

---

## Self-review (выполнен)

- Spec coverage этапов 0–1: event bus ✔ (T1–T2), пулы/запекание ✔ (T7–T10), spatial grid ✔ (T3–T4), снаряды+перенаводка+дуга+упреждение ✔ (T5, T9), ребаланс ✔ (T6), критерий паритета и перф-критерий ✔ (T10–T11). Слои `decals/particles/floatingText` создаются пустыми — потребители в плане этапа 2 (спека это допускает).
- Плейсхолдеров нет; `makeTestGame` — единственная отсылка «найти хелпер в tests/» (существующий код, grep-инструкция дана).
- Типы сквозные: `Tower.update(dt, enemies, grid?)`, `applyShot(shot, enemies, pitch, emit?, grid?)`, `Projectile(kind, from, target, shot, aimPoint?)` + внутр. `speedPx` (упрощение зафиксировано в T5), `GameView.update(dtSec, selected)`.

## Вне этого плана

Этапы 2 (juice: GSAP, частицы, shake, decals-контент, цифры урона, фильтры, живая плата) и 3 (звук) — отдельный план после приземления этапов 0–1.
