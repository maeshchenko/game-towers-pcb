# MEMORY — канонические заметки проекта

Переписан с нуля 2026-07-02. Прежнее содержимое признано ненадёжным и не использовалось.
Здесь: решения, конвенции, гочи. Roadmap — в `PLANS.md`. Обновлять при смене решений.

## Что это

PCB TD — tower defense на печатной плате (Pixi.js v8 + TypeScript strict + Vite + Vitest).
Враги («пакеты») едут по медным дорожкам от входа к выходу; башни — чипы на монтажных
площадках. 12 авторских уровней кампании, туториал, бестиарий, редактор уровней (`/editor`),
мобильный режим, i18n RU/EN.

## Ключевые правила

- **Коммиты**: русские, короткие, по делу. Никаких упоминаний AI/Claude/нейросетей — ни в
  сообщениях, ни в трейлерах. Без `Co-Authored-By`. Push/merge делает только пользователь.
- **Тесты**: сьют зелёный всегда; TDD для новой логики. `npm run build` (tsc + vite) обязан проходить.
- **Сим — framework-free**: `src/game`, `src/geom`, `src/pipeline`, `src/tiles` не импортируют
  pixi и прогоняются headless (`src/game/sim.ts`). Рендер/UI — тонкие.
- **Инвариант трассы**: у каждого сгенерированного уровня ровно ОДИН финиш; все маршруты сходятся к нему.
- Комментарии в коде — на английском.

## Архитектура (кратко)

- `src/game` — сим: `Game.tick(dt)`, башни/враги/волны/экономика. `Game.events` — типизированный
  event bus (`src/game/events.ts`), на него подписаны рендер/звук/UI.
- `src/render` — Pixi-слои. Персистентные pooled view-объекты (см. спеку этапа 0), никакого
  rebuild-per-frame.
- `src/ui` — DOM HUD/меню (`GameUI`, `CampaignMenu`), WebAudio-синтез (`AudioEngine`), i18n.
- `src/pipeline`/`src/tiles`/`src/geom` — генерация уровней, трассировка, геометрия.
- `src/levels/campaign/level01–12.ts` — авторские уровни через DSL (`src/levels/dsl.ts`).
- Баланс: `npm run balance:optimize` — headless-прогон эталонной обороны, полоса fairness
  [0.15, 0.65] потерянных жизней.

## Текущее направление (2026-07)

Курс на production-ready: рендер-фундамент → честные снаряды → juice-пас → звук → мета-прогрессия.
- Спека: `docs/superpowers/specs/2026-07-02-render-refactor-juice-design.md`
- План этапов 0–1: `docs/superpowers/plans/2026-07-02-stage0-1-render-projectiles.md`
- Прогресс исполнения: `.superpowers/sdd/progress.md` (git-ignored леджер)

Утверждённые решения: снаряды честные в симе (PULSE/MISSILE, LASER/TESLA мгновенные);
GSAP + pixi-filters 6.x разрешены (размер бандла не критерий); звук остаётся синтезом.

## Гочи

- `SHOW_DECOR = true` (`src/render/Renderer.ts`) — декор (медь + винтажные детали) включён и
  кэшируется как текстура (`layers.copper`/`layers.decor`.`cacheAsTexture(true)`) сразу после
  отрисовки, перф-чек на 60×45 не показал просадки (~100fps стабильно, build и wave-фаза).
  При каждом `render()` порядок обязателен: uncache (`cacheAsTexture(false)`) → clear children →
  redraw → recache — иначе разрушение детей закэшированной render-group в pixi v8 небезопасно.
- LED в декоре (`vintageDecor.ts` `led5mm`, `opts.on`) не мигает — анимации нет в принципе
  (не только из-за кэша), мигание остаётся в бэклоге.
- Мобильный портрет = поворот контейнера на 90° с манки-патчами `getBoundingClientRect` /
  `appendChild` в `src/main.ts` — хрупко, менять осторожно.
- `getEnemyColor` продублирован в `GameUI.ts` / `CampaignMenu.ts` / `main.ts` и расходится
  с `src/render/theme.ts` — сводить к theme.ts при случае.
- `main.ts` ~1000 строк (boot + input + loop + туториал + прогрессия) — при правках держать
  скоуп узким; разбиение — отдельная задача.
- Прогресс игрока в localStorage: `pcb_td_campaign_progress_v1` (+ ключи громкости/языка).
- `app.stage.filters` теперь владеет `Vfx` (`src/render/juice/Vfx.ts`, CRT-гейт на `juice.reducedFx`)
  — если понадобится ещё один stage-фильтр, комбинировать через массив, а не перезаписывать.
  `renderer.vfxOverlay` — второй child `app.stage` (после `world`), screen-space, для UI-подобных
  vfx (виньетка), которые не должны двигаться с камерой/шейком.
