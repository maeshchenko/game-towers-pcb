# План: этап 2 — juice-пас

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Визуальный «сок»: твины, частицы, хит-фидбек, hit-stop, screen shake, цифры урона, декали, фильтры, живая плата, событийная пунктуация.

**Architecture:** Всё строится на фундаменте этапов 0–1: подписки на `game.events`, отдельные слои `Renderer.layers`, pooled-объекты. Сим меняется минимально (только обогащение полей событий). Каждый juice-модуль живёт в `src/render/juice/`, имеет `update(dt)`+`destroy()` и подключается через `GameView`. Глобальный переключатель «сниженные эффекты» гасит shake/hit-stop/транзиент-фильтры/CRT.

**Tech Stack:** GSAP 3.15 (+PixiPlugin), pixi-filters 6.1.5, нативный Pixi v8 ParticleContainer. Обе зависимости — прод-dependencies.

**Spec:** `docs/superpowers/specs/2026-07-02-render-refactor-juice-design.md` (раздел «Этап 2»)

## Global Constraints

- TypeScript strict; `npm run test` зелёный и `npm run build` проходит после каждой задачи.
- Сим (`src/game`) — без импортов pixi/gsap; менять сим можно только там, где задача явно это говорит (поля событий).
- Комментарии в коде — на английском. Коммит после каждой задачи: русское сообщение, коротко, без упоминаний AI, без Co-Authored-By, `git add` по явным путям.
- Перф-бюджет: частиц ≤ 500 живых, декалей ≤ 40; фильтры только на уровне слоёв; ни одного `generateTexture`/`new Graphics` в per-frame коде (пулы и кэши).
- Каждая визуальная задача заканчивается ручной проверкой в браузере (контроллер делает скриншот-QA после задачи — исполнителю достаточно `npm run build`).
- «Сниженные эффекты»: модуль `motion.ts` (Task 1) — все дальнейшие эффекты обязаны уважать его флаг там, где задача это указывает.

---

### Task 1: Зависимости + твин-инфраструктура + reduce-motion

**Files:**
- Modify: `package.json` (`npm i gsap pixi-filters`)
- Create: `src/render/juice/tweens.ts`, `src/render/juice/motion.ts`
- Modify: `src/main.ts` (тикер-синк GSAP — один раз при буте), `src/ui/GameUI.ts` (тумблер в настройках), `src/ui/i18n.ts` (ключи `settings.reduced_fx` RU/EN)
- Test: `tests/render/motion.test.ts` (логика persist/чтения флага; jsdom достаточно)

**Interfaces (Produces):**
```ts
// tweens.ts
export function initGsap(app: Application): void  // registerPIXI + ticker sync:
//   gsap.registerPlugin(PixiPlugin); PixiPlugin.registerPIXI(PIXI-namespace)
//   gsap.ticker.remove(gsap.updateRoot)
//   app.ticker.add(() => gsap.updateRoot(performance.now() / 1000))
export const EASE = { pop: 'back.out(2)', ui: 'power2.out', settle: 'elastic.out(1, 0.5)' } as const
export const DUR = { ui: 0.15, pop: 0.3, settle: 0.4 } as const

// motion.ts — no pixi imports (jsdom-testable)
export const juice: { reducedFx: boolean }          // живой объект-синглтон
export function initMotion(): void                  // localStorage 'pcb_td_reduced_fx_v1' → иначе matchMedia('(prefers-reduced-motion: reduce)')
export function setReducedFx(v: boolean): void      // пишет в juice + localStorage
```
- Тумблер «Сниженные эффекты» в существующей settings-модалке `GameUI.ts:247-…` — по образцу селекта auto_wave (`settings-row select-row`).
- `initGsap` + `initMotion` вызываются один раз в `main.ts` после создания app.

**Steps:** установка пакетов → тест на motion (RED) → реализация → тумблер+i18n → `npm run test`+`npm run build` → коммит.

---

### Task 2: ParticleSystem + прокидка pitch (долг ревью)

**Files:**
- Create: `src/render/juice/Particles.ts`
- Modify: `src/render/views/textures.ts` (+`bakeParticleTexture(app, shape: 'dot'|'spark'|'shard', color)` с кэшем по `shape:color`)
- Modify: `src/render/GameView.ts`, `src/render/views/BeamFx.ts`, `src/render/views/ProjectileViews.ts` (pitch параметром из `game.pitch` вместо литерала 30)
- Test: `tests/render/particles-logic.test.ts` — чистая логика пула/жизни частиц (вынести в отдельный класс/функции без pixi: advance(dt) — позиция/скорость/затухание/срок; cap-деградация)

**Interfaces (Produces):**
```ts
export interface BurstSpec {
  x: number; y: number; count: number
  speed: [number, number]           // px/s min..max
  angle?: [number, number]          // radians, default [0, 2π]
  life: [number, number]            // seconds
  color: number; size: [number, number]
  gravity?: number                  // px/s² вниз
  drag?: number                     // 0..1 per second
  shape?: 'dot' | 'spark' | 'shard' // default 'dot'
}
export class ParticleSystem {
  constructor(app: Application, layer: Container)   // внутри создаёт ParticleContainer(s) per texture
  burst(spec: BurstSpec): void
  update(dt: number): void
  destroy(): void
  get liveCount(): number                            // для cap-логики и тестов
}
```
- Кап 500: `burst` урезает `count` пропорционально заполненности (`count * max(0.2, 1 - liveCount/500)`), при liveCount ≥ 500 — не спавнит.
- Pixi v8 `ParticleContainer` требует один TextureSource на контейнер → по контейнеру на текстуру (dot/spark/shard × цвет — цвет через tint одной белой текстуры! запекать БЕЛУЮ текстуру формы, красить tint'ом — тогда контейнеров всего 3).
- Additive: `blendMode: 'add'` на частицах.
- `GameView` создаёт систему на `layers.particles`, зовёт `update(dt)`; экспортирует наружу (Task 4/6/8 используют).

---

### Task 3: Screen shake (trauma) + hit-stop

**Files:**
- Create: `src/render/juice/ScreenShake.ts`, `src/render/juice/HitStop.ts`
- Modify: `src/main.ts` (тикер: `dtSim = hitStop.filter(rawDt)`; после `camera.apply(renderer.world)` — `shake.applyTo(renderer.world)`)
- Modify: `src/render/GameView.ts` (подписки: shake/hitStop слушают события)
- Test: `tests/render/shake-math.test.ts`, `tests/render/hitstop.test.ts` (оба модуля — без pixi, чистая математика/тайминг)

**Interfaces (Produces):**
```ts
export class ScreenShake {
  add(trauma: number): void                    // clamp [0,1]
  update(dt: number): void                     // trauma -= dt * 1.0
  get offset(): { x: number; y: number; angle: number }  // shake = trauma², perlin-ish noise
  applyTo(world: Container): void              // ДОБАВЛЯЕТ к позиции/углу после camera.apply
}
export class HitStop {
  trigger(seconds: number): void               // не суммируется, берётся max
  filter(dt: number): number                   // 0 пока стоп активен, иначе dt; тикает на raw dt
}
```
- Шум: два независимых синус-микса с иррациональными частотами (`sin(t*13.7)+0.5*sin(t*27.1)` и т.п.) — достаточно вместо перлина, БЕЗ per-frame random (строб запрещён).
- Магнитуды: maxOffset 10px, maxAngle 0.02 rad, оба × shake.
- События → trauma: `baseHit` +0.35, `enemyDied` boss +0.6, `projectileImpact` mortar +0.08.
- Hit-stop: `enemyDied` → 0.05s обычный, 0.13s boss. Пока стоп: сим не тикает, рендер/твины/частицы живут (в main.ts hit-stop фильтрует ТОЛЬКО dt для `game.tick`, `gameView.update` получает raw dt).
- `juice.reducedFx` → `add()`/`trigger()` no-op.

---

### Task 4: Хит-фидбек врагов (вспышка + отброс) — поля событий в симе

**Files:**
- Modify: `src/game/events.ts` (`enemyDamaged` получает `enemy: Enemy` и `from?: Pt`; `enemyDied` получает `enemy: Enemy`)
- Modify: `src/game/combat.ts`, `src/game/Game.ts` (заполнить новые поля; `from` = позиция башни/снаряда)
- Modify: `src/render/views/EnemyViews.ts` (флеш+отброс), `src/render/GameView.ts` (подписка → пометка view)
- Test: обновить `tests/game/game-events.test.ts`/`projectile.test.ts` под новые поля + новый кейс: `enemyDamaged.from` указывает на источник

**Механика (binding):**
- Вспышка: `sprite.tint = 0xffffff` не работает для белого — вместо tint использовать наложение: в EnemyView добавить `flash: Sprite` (та же текстура, `tint 0xffffff`, `blendMode 'add'`, alpha 0) поверх спрайта; хит → `flash.alpha = 0.9`, спад до 0 за 0.05s (в sync по dt, без gsap — массовый путь).
- Отброс: view хранит `kick: {x,y}` — при хите единичный вектор от `from` к врагу × 4px; в sync позиция = `enemy.pos + kick`, kick затухает к нулю за 0.1s. Чисто визуально, сим не трогается.
- Отображение view↔enemy уже есть (`Map<Enemy, EnemyView>`), событие теперь несёт `enemy` — прямой lookup.
- `Enemy` в событиях — ссылка на сим-объект; рендер использует только как ключ Map (не мутировать).

---

### Task 5: Смерти — осколки, подпалины-декали

**Files:**
- Create: `src/render/juice/Decals.ts`
- Modify: `src/render/GameView.ts` (подписка `enemyDied` → burst осколков + декаль; boss → больше)
- Test: `tests/render/decals-logic.test.ts` (pool cap/TTL — чистая логика)

**Interfaces (Produces):**
```ts
export class Decals {
  constructor(layer: Container)                 // layers.decals
  addScorch(x: number, y: number, radius: number): void  // pooled Graphics: тёмное пятно + обугленный ободок
  update(dt: number): void                      // fade: alpha 0.5 → 0 за 10s
  destroy(): void
}
```
- Кап 40, при переполнении — реюз старейшей (мгновенно).
- Смерть врага: `burst` 3–6 осколков (`shape 'shard'`, цвет `enemyTheme(kind).color`, speed [60,180], life [0.3,0.7], gravity 300, drag 0.6) + 4–8 искр + `addScorch(pos, r врага)`; boss — ×3 частиц, радиус ×2, plus trauma уже из Task 3.
- Декаль радиусом ~0.4×pitch.

---

### Task 6: Цифры урона + бонус-текст

**Files:**
- Create: `src/render/juice/FloatingText.ts`
- Modify: `src/render/GameView.ts` (подписки `enemyDamaged` → агрегатор, `enemyDied` → `+bounty` золотым)
- Test: `tests/render/floating-aggregator.test.ts` (агрегация 250мс-батчами по enemy — чистая логика, вынесена в `DamageAggregator` без pixi)

**Interfaces (Produces):**
```ts
export class DamageAggregator {          // pure, testable
  add(key: object, amount: number, x: number, y: number): void
  flush(now: number): Array<{ amount: number; x: number; y: number }>  // батчи старше 0.25s
}
export class FloatingText {
  constructor(layer: Container)          // layers.floatingText; BitmapFont.install один раз (monospace, цифры+'+−')
  spawn(text: string, x: number, y: number, color: number, scale?: number): void  // pooled BitmapText
  update(dt: number): void               // подъём 40px/с·(жизнь 0.8s), fade со 2-й половины, pop-in 1.4→1.0 за 0.12s
  destroy(): void
}
```
- Пул ≥ 32 текстов; при исчерпании реюз старейшего.
- Урон — белым (масштаб по величине: ≥100 крупнее), bounty — `PALETTE.padGold`.

---

### Task 7: Фидбек башен (постройка/апгрейд/продажа/отдача) — локальные координаты TowerViews

**Files:**
- Modify: `src/render/views/TowerViews.ts` — РЕФАКТОР: Graphics каждой башни рисуется в локальных координатах (0,0-центр), `g.position.set(t.pos.x, t.pos.y)`; overlayG остаётся мировым. После этого работают scale-твины (pivot в центре чипа).
- Modify: `src/render/GameView.ts` (подписки towerBuilt/Upgraded/Sold/shotFired → твины + частицы)
- Test: нет юнита (визуальное) — `npm run build` + контроллер-QA.

**Механика (binding):**
- Постройка: `gsap.fromTo(g.scale, {x:1.3,y:0.7}, {x:1,y:1, duration: DUR.pop, ease: EASE.settle})` + кольцо пыли: burst 10 dot-частиц по кругу (speed [40,90], life [0.25,0.5], цвет `PALETTE.padGold`).
- Апгрейд: белый flash-круг поверх (transient Graphics в overlay слое, alpha 0.6→0 за 0.2s) + `gsap.from(g.scale, {x:1.25,y:1.25, duration:0.25, ease: EASE.pop})`.
- Продажа: 6 золотых искр + мгновенное удаление (ghost не делаем — YAGNI).
- Отдача при выстреле: lookup башни по `e.from === t.pos` (ссылочное равенство, эмит шлёт t.pos) → `gsap.fromTo(g.scale, {x:0.92,y:1.06}, {x:1,y:1,duration:0.12, ease:EASE.ui})`; НЕ чаще чем раз в 0.1s на башню (tesla 2.6/с — душить.)
- Твины скейла НЕ конфликтуют с redraw (redraw меняет геометрию Graphics, не scale) — но при sell/destroy убить активные твины `gsap.killTweensOf(g.scale)`.

---

### Task 8: Визуал попадания PULSE (долг) + улучшенная tesla-дуга + trail ракеты

**Files:**
- Modify: `src/render/views/BeamFx.ts` (pulse impact: подписка `projectileImpact` kind cannon → мини-вспышка 3px + 3 искры через ParticleSystem — BeamFx получает ссылку на ParticleSystem из GameView)
- Modify: `src/render/views/BeamFx.ts` tesla: midpoint-displacement (5→9 сегментов, смещение ⊥ до 6px, 1–2 ветки под ±30° на 40% длины, второй проход широкой линией alpha 0.25 под узкой) — параметры зафиксировать константами.
- Modify: `src/render/views/ProjectileViews.ts` (trail ракеты: каждые 0.04s полёта — dot-частица дыма (серый 0x9aa0a6, life [0.4,0.8], speed [5,20], без гравитации) + свечение: additive спрайт-ореол под ракетой)
- Test: нет юнита — build + QA.

---

### Task 9: Фильтры и vfxOverlay (bloom, RGBSplit, CRT, виньетка)

**Files:**
- Create: `src/render/juice/Vfx.ts`
- Modify: `src/render/Renderer.ts` (добавить слой `vfxOverlay` ПОВЕРХ всего в stage-координатах: контейнер добавляется в `app.stage` ПОСЛЕ `world`, не внутрь world)
- Modify: `src/render/GameView.ts` (создание Vfx, подписки baseHit/enemyDied-boss)
- Test: нет юнита — build + QA.

**Interfaces (Produces):**
```ts
export class Vfx {
  constructor(app: Application, world: Container, overlay: Container)
  update(dt: number): void
  flashVignette(): void        // красная edge-виньетка: Graphics по краям экрана, alpha 0.5→0 за 0.15s
  rgbSplitPulse(): void        // RGBSplitFilter на world: offset 3px → 0 за 0.12s, затем filters=null
  destroy(): void
}
```
- Постоянные: `AdvancedBloomFilter` на `layers.projectiles` + `layers.particles` (один инстанс, threshold 0.5, bloomScale 0.8, quality 4); ОЧЕНЬ мягкий `CRTFilter` на весь stage (lineWidth 1, lineContrast 0.08, vignetting 0.25) — гейт `juice.reducedFx` (при вкл. reducedFx: CRT снят, bloom остаётся, транзиенты no-op).
- Транзиенты: `baseHit` → `flashVignette()` + `rgbSplitPulse()`; смерть boss → `rgbSplitPulse()`.
- Виньетка перерисовывается при ресайзе (подписка на app.renderer 'resize').
- Импорт: `import { AdvancedBloomFilter, RGBSplitFilter, CRTFilter } from 'pixi-filters'`.

---

### Task 10: Живая плата — SHOW_DECOR, пульсы по трассам, LED

**Files:**
- Modify: `src/render/Renderer.ts` (`SHOW_DECOR = true`; после `drawCopper`/`drawDecor` — `layers.decor.cacheAsTexture(true)` и `layers.copper.cacheAsTexture(true)`)
- Create: `src/render/juice/TracePulse.ts`
- Modify: `src/render/GameView.ts` или `src/main.ts` (TracePulse живёт вне GameView — работает и в build-фазе; создавать в main при рендере уровня, update в тикере, пересоздавать при смене уровня)
- Test: нет юнита — build + QA + перф-чек контроллером.

**Interfaces (Produces):**
```ts
export class TracePulse {
  constructor(layer: Container, paths: Pt[][])   // те же filletPath-полилинии, что у сима (levelPaths + filletPath) — main их уже умеет строить
  update(dt: number): void                        // 1–2 пульса на путь: additive точка бежит по полилинии, скорость ~6 клеток/с, respawn с рандомной задержкой 1–4s (seeded или Math.random — это чистый визуал)
  destroy(): void
}
```
- Слой: `layers.trace` (поверх трассы) или `layers.decals` — выбрать trace.
- LED в декоре: `vintageDecor`/`decorBuilder` рисуют LED — если статичный кэш мешает миганию, LED-мигание НЕ делать (кэш важнее) — отметить в отчёте, отложить.
- Перф: после включения декора — FPS-замер контроллером на 60×45; если просадка >10% — `cacheAsTexture` обоих слоёв обязателен (он и так в задаче), при сохранении просадки — вернуть SHOW_DECOR=false и доложить.

---

### Task 11: Событийная пунктуация — баннер волны, slam звёзд, поражение

**Files:**
- Modify: `src/ui/GameUI.ts`: `showWaveBanner(index: number, composition: string)` — DOM-баннер сверху по центру, CSS-анимация (slide+fade, 1.6s, затем remove); вызов из подписки `waveStart` в main.ts (композиция из `game.peekWave(index)` + `enemyTheme().name`). `showVictoryScreen` (`GameUI.ts:540`): звёзды влетают по очереди — CSS-анимация с задержками 0.15s/звезда (scale 2→1 + fade-in, `animation-delay`), звук звезды НЕ здесь (этап 3).
- Modify: `src/ui/styles.css` (keyframes), `src/ui/i18n.ts` (ключ `hud.wave_banner` «ВОЛНА {n}» RU/EN)
- Modify: `src/main.ts` (подписка waveStart; при defeat — `shake.add(0.5)`)
- Test: нет юнита — build + QA.

---

### Task 12: Перф-финал + визуальный QA-пасс (контроллер)

- Контроллер: полный прогон уровня 1 и уровня 12 (60×45) с башнями на 1×/4×; замер FPS+heap как в Task 11 этапа 0–1; скриншоты всех эффектов пользователю; проверка reducedFx-тумблера (shake/hit-stop/CRT/RGBSplit гаснут); `npm run test` + `npm run build`; обновление PLANS.md/MEMORY.md.
- Если частицы/боссы роняют FPS < 55: первым делом снизить кап частиц до 300 и quality bloom до 2.

## Self-review (выполнен)

- Покрытие спеки этапа 2: твины ✔(T1,T7), хит-фидбек ✔(T4), hit-stop ✔(T3), смерти+декали ✔(T5), частицы ✔(T2,T5,T8), shake+reduce-motion ✔(T1,T3), цифры урона ✔(T6), фильтры ✔(T9), живая плата ✔(T10), пунктуация ✔(T11), перф ✔(T12). Долги финального ревью 0–1: pitch ✔(T2), z-order overlayG — НЕ отдельно: T7 рефакторит TowerViews, исполнителю T7 указать вернуть overlayG под спрайты врагов невозможно (слой один) — оставить как есть, зафиксировано приемлемым в ревью; pulse-impact ✔(T8); ParticleContainer ✔(T2); shotFired.to у mortar — документируется в T8 при работе с BeamFx.
- Типы сквозные: ParticleSystem/BurstSpec (T2→T5,T7,T8), juice.reducedFx (T1→T3,T9), DamageAggregator (T6), поля событий (T4→T5,T6).
- Порядок: T1→T2→T3→T4→T5→T6→T7→T8→T9→T10→T11→T12; T5/T6 зависят от T2/T4; T7 — от T2; T8 — от T2; T9–T11 независимы после T3.
