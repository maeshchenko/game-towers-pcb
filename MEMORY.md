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
- Баланс: `npm run balance:optimize` (hpMul-рекомендации, полоса fairness [0.15, 0.65]) и
  `npm run balance:waves` (поволновая телеметрия: утечки/золото/длительность/киллы + флаг ⚠CLIFF,
  когда ≥70% потерь в одной волне). Ядро — `src/game/telemetry.ts`, переносимо в будущие TD.
  Принципы: экономика щедрая (интерес TD = строить много башен, а не сидеть в бедности);
  давление держит поволновый HP-рамп в `WaveManager` (оборона снежным комом растёт каждую
  волну — враги поздних волн обязаны расти тоже, иначе вся сложность схлопывается в босса);
  босс убиваем топовой обороной (hp 1800, armor 4, leak 6), не гарантированный штраф.

## Текущее направление (2026-07)

Курс на production-ready: рендер-фундамент → честные снаряды → juice-пас → звук → мета-прогрессия.
- Полный production-аудит (81 гэп кода + каноны TD + план этапов A–H): `docs/audits/2026-07-03-production-audit.md`
- Спека: `docs/superpowers/specs/2026-07-02-render-refactor-juice-design.md`
- План этапов 0–1: `docs/superpowers/plans/2026-07-02-stage0-1-render-projectiles.md`
- Прогресс исполнения: `.superpowers/sdd/progress.md` (git-ignored леджер)

Утверждённые решения: снаряды честные в симе (PULSE/MISSILE, LASER/TESLA мгновенные);
GSAP + pixi-filters 6.x разрешены (размер бандла не критерий); звук остаётся синтезом.

## Сделано по аудиту (2026-07-03, этап C — глубина TD)

- **Ветки апгрейдов (тир-4)**: `TOWER_BRANCHES` в towerTypes.ts — на макс. линейном уровне выбор
  из 2 ролей (разгон|бронебой, криостат|катушка, рельсотрон|расщепитель, кассета|пробойник,
  дуговая матрица|конденсатор). `Tower.chooseBranch/canBranch`, `Game.upgradeBranch`,
  UI-кнопки в панели (золотой акцент), i18n `branch.*`. Бот в sim берёт ветку 0. Sniper L3
  pierce 999→8 (ось брони жива для будущих врагов).
- **Волны переработаны**: `WaveEntry.delay` — волны авторятся ФАЗАМИ (отряд→пауза→микс→хвост),
  одна ракета больше не съедает волну; `WaveEntry.mix` — смешанные потоки (weighted seeded);
  `WaveEntry.pathIndex` — направленный multiSpawn; `waveComposition()` — честные превью;
  `meta.waves` + `b.waves()` в DSL — пер-уровневые скрипты (инфраструктура готова, авторские
  скрипты уровней ещё НЕ написаны).
- **Способности врагов в данных**: `EnemyDef.abilities` (erratic/heal/slowImmune/shield/
  splitInto/bossPhases) — хардкод по kind убран из Enemy/Game. Событие `enemyHealed`.
- **3 новых врага**: shielded ФОРМА-08 «КАПСУЛА» (щит ест первые 6 хитов — контрится
  скорострельностью), carrier ФОРМА-09 «КОНТЕЙНЕР» (при смерти → 4 осколка на дорожке,
  `WaveManager.inject`), fragment ФОРМА-10 «ОСКОЛОК». Вплетены в mapWaves с diff 5+/7+.
- **Босс фазовый**: ≤2/3 HP — ярость (×1.35 скорость), ≤1/3 — глитч-рывки (2.4× / 0.85×,
  окно 6с, детерминировано). Событие `bossPhase`.
- **Активка «Разряд»**: `Game.useDischarge(pos)` — AoE 90 + slow 0.15/2с, кулдаун 45с (тикает
  и в build-фазе). Кнопка ⚡ в HUD → прицел → клик по плате.
- **Сложность игрока**: casual/normal/veteran (hpMul 0.75/1/1.3) в настройках, персист,
  применяется со следующего уровня (`playerPrefs.ts`, `Game(level, seed, {hpMul})`).
- **3★ прощает 2 утечки** (registerVictory), early-call бонус перенесён в сим
  (`Game.earlyCallBonus`, `callNextWave` банкует сам).
- **Мид-левел сейв**: `Game.snapshot()/restore()` на границах волн + `runSave.ts`
  (pcb_td_run_v1), автовосстановление при входе в уровень кампании, clearRun на win/lose.
- **hpMul перекалиброван** balance:optimize после всех изменений: [2.25, 3.00, 0.95, 2.50,
  3.50, 1.30, 2.80, 2.05, 2.65, 2.80, 0.90, 2.75]. Кривая: потери 1→9/20 к финалу, все WIN.
- Фикс кадрирования: `frameLevel` меряет реальную высоту HUD+превью из DOM (не константу 56).
- Осталось в C: авторские волновые скрипты для конкретных уровней (инфраструктура есть),
  Hotfix-блокер (вторая активка).

## Сделано по аудиту (2026-07-03, этапы A+B)

- **Сим на сабстепах**: `Game.tick` режет кадр на подшаги ≤1/30 c (`Game.MAX_STEP`) — честный
  fast-forward; `Tower.update` не теряет остаток кулдауна (`cooldown += period`) и не «банкует»
  выстрелы в простое. Тесты: `tests/game/fixed-step.test.ts`.
- Slow на спец-споте: буст идёт ТОЛЬКО в range, множитель замедления не трогаем (Tower.ts).
- `WaveManager.remove` — swap-remove O(1); slow-аура через `grid.queryCircle`.
- **DPR**: `PixiApp` рендерит в `resolution: min(dpr, 2)` + `autoDensity`.
- TracePulse живёт в отдельном персистентном слое `tracePulse` (не в очищаемом `trace`).
- **safeStorage** (`src/util/safeStorage.ts`): ВСЕ обращения к localStorage только через него —
  прямой доступ к `window.localStorage` кидает SecurityError при заблокированных cookies.
- Язык: первый запуск — по `navigator.language` (не-ru → EN); `<html lang>` синхронизируется.
- visibilitychange: пауза сима + `ctx.suspend()`; boot().catch → фатал-заглушка (нет WebGL).
- Кэш `seenIntroCache` вместо `loadProgress()` каждый кадр в тикере.
- **Сейвы версионированы внутри JSON** (`SAVE_VERSION`, `migrateSave()`); экспорт/импорт кодом
  в настройках (страховка от потери localStorage на itch).
- **Сборка**: `base: './'` (itch-совместимость), kit/kit2/editor исключены из прод-бандла,
  vendor-чанк (pixi/gsap/filters). Роутинг: `?mode=editor|new` + `exitToRoot()` вместо `/`.
- index.html: title/lang/favicon/OG/theme-color + загрузочный сплэш `#pcb-loading` (снимает boot()).
- **Monkey-patch document.body.appendChild УДАЛЁН** — весь UI монтируется через
  `mountUi()`/`uiRoot()` (`src/ui/uiRoot.ts`).
- CI: `.github/workflows/ci.yml` (tsc+vitest+build+артефакт); `npm run package` — zip для itch.
- Не сделано из B: Sentry (нужен DSN от пользователя), ручной кроссбраузер-прогон Safari/iOS/Firefox.

## Гочи

- `SHOW_DECOR = true` (`src/render/Renderer.ts`) — декор (медь + винтажные детали) включён и
  кэшируется как текстура (`layers.copper`/`layers.decor`.`cacheAsTexture(true)`) сразу после
  отрисовки, перф-чек на 60×45 не показал просадки (~100fps стабильно, build и wave-фаза).
  При каждом `render()` порядок обязателен: uncache (`cacheAsTexture(false)`) → clear children →
  redraw → recache — иначе разрушение детей закэшированной render-group в pixi v8 небезопасно.
- LED в декоре (`vintageDecor.ts` `led5mm`, `opts.on`) не мигает — анимации нет в принципе
  (не только из-за кэша), мигание остаётся в бэклоге.
- Мобильный портрет = поворот контейнера на 90° с манки-патчами `getBoundingClientRect` / `appendChild` в `src/main.ts` — хрупко, менять осторожно.
  - Viewport: в index.html добавлен viewport meta tag для корректного масштабирования на мобильных и отключения зума.
  - Тултипы постройки: z-index увеличен до 250, смещение задается через translate(-50%, -100%) при показе сверху и translate(-50%, 0) снизу с отступом 110px от центра кнопки, чтобы описание не перекрывалось кнопками.
  - Ползунки: в медиа-запросе input[type="range"]::-webkit-slider-thumb увеличен до 22px для удобства управления пальцем.
  - Анимация бонуса: showFloatingBonusText монтирует el прямо в startBtn, избавляя от ручного перевода экранных координат.
- `getEnemyColor` продублирован в `GameUI.ts` / `CampaignMenu.ts` / `main.ts` и расходится
  с `src/render/theme.ts` — сводить к theme.ts при случае.
- `main.ts` ~1000 строк (boot + input + loop + туториал + прогрессия) — при правках держать
  скоуп узким; разбиение — отдельная задача.
- Прогресс игрока в localStorage: `pcb_td_campaign_progress_v1` (+ ключи громкости/языка).
- `app.stage.filters` теперь владеет `Vfx` (`src/render/juice/Vfx.ts`, CRT-гейт на `juice.reducedFx`)
  — если понадобится ещё один stage-фильтр, комбинировать через массив, а не перезаписывать.
  `renderer.vfxOverlay` — второй child `app.stage` (после `world`), screen-space, для UI-подобных
  vfx (виньетка), которые не должны двигаться с камерой/шейком.
