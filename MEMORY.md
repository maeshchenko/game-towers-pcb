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

## Сделано (2026-07-04 — этап 2 «Публикация», внутренняя часть без токенов)

- **hidden sourcemaps** (vite build.sourcemap:'hidden') — .map эмитятся для Sentry, но без
  //# sourceMappingURL → браузер не тянет, исходник приватен. CI дропает .map перед публикацией.
- **LICENSE** (proprietary, Mizhgan Games, all rights reserved) + **CREDITS.md** — 3rd-party:
  Pixi.js/pixi-filters MIT, **GSAP GreenSock Standard 'No Charge' License** (не MIT! аттрибуция
  обязательна, нельзя перепродавать сам GSAP — для игры ок). Шрифты только системные, ассетов 0.
- **public/privacy.html** — только localStorage-сейвы, ноль куки/трекинга, аналитика (если
  включат) — анонимная cookieless. Линк на почту.
- **og:image** — public/og-image.png (брендовая карточка, отрендерил HTML→скрин через Chrome
  MCP 1200×630@2x); og:image + twitter summary_large_image в index.html.
- **export-code тост после L3** — hint id 'backup' (одноразовый), фаер в win-блоке при
  levelIndex===2, зовёт в Настройки→Код сохранения (страховка от очистки localStorage на itch CDN).
- **Coverage-гейт** (@vitest/coverage-v8): scope src/game (framework-free ядро), текущее
  94.7%/91.7%, порог 88/85/90/88. `npm run test:coverage`.
- **ESLint** (flat config, typescript-eslint) — bug-net не стайл: eqeqeq/no-var/prefer-const
  (ignoreReadBeforeAssign для `let ui!`)/no-fallthrough/no-empty(allowEmptyCatch)/no-explicit-any
  (warn). 0 ошибок, 39 warn (any на границах pixi/тестов). Игнор kit/kit2/editor/scripts.
  `npm run lint`, `npm run check` (tsc+eslint+vitest).
- **Playwright smoke-e2e** (e2e/smoke.spec.ts) — бут прод-бандла (vite preview :4173) на
  desktop+mobile chromium: сплэш ушёл, canvas виден, START кликабелен, 0 console errors +
  START уводит с тайтла. 4 теста зелёные. `npm run e2e`.
- **CI** (.github/workflows/ci.yml): check (tsc/lint/coverage/build) + e2e джобы на push/PR;
  deploy-pages (token-free, actions/deploy-pages, дропает .map) с дефолтной ветки; deploy-itch
  стаб (вооружается secrets.BUTLER_API_KEY + vars.ITCH_TARGET, иначе no-op).
- **ОСТАЛОСЬ (нужны токены/ключи от юзера)**: Sentry (DSN) для крашей + upload .map; PostHog
  (ключ, cookieless через events.ts) для аналитики; itch butler (BUTLER_API_KEY). FPS-сэмплер:
  PerfMonitor.fps getter готов, останется прокинуть в аналитику когда будет endpoint.

## Сделано (2026-07-04 — этап 3 «Устойчивость на устройствах», частично)

- **PerfMonitor** (src/render/PerfMonitor.ts, framework-free, TDD): EMA FPS, при устойчивом
  <45 FPS ≥4с один раз зовёт onDegrade → setReducedFx(true) + тост + синк чекбокса
  (ui.syncReducedFx). Сэмплится в тикере ТОЛЬКО в фазе 'wave' и пока reducedFx off. Спайки
  (dt>0.5с, альт-таб/GC) игнорятся и сбрасывают стрик.
- **Восстановление WebGL-контекста** (main.ts): было showFatalError (тупик). Теперь на
  webglcontextlost — preventDefault + пауза сима + тост «ВОССТАНОВЛЕНИЕ»; на restored (в rAF,
  чтобы pixi достроил GL) — clear*TextureCache (три кэша generateTexture) + renderer.render
  (ре-бейк copper/decor) + gameView.destroy()+new GameView (пулы держали спрайты с мёртвыми
  текстурами → alphaMode null; полный ребилд лечит). Проверено в Chrome через
  WEBGL_lose_context: 0 ошибок, плата перерисована, враги идут. clear*TextureCache РАНЬШЕ были
  без вызовов — теперь используются.
- **PixiApp.ts**: powerPreference 'high-performance', ticker.maxFPS=60 (120/144Гц не жгут батарею),
  на мобиле (pointer:coarse & !fine) antialias off + resolution cap 1.5 вместо 2.
- **Hot-path (per-frame alloc убраны)**: main camPose строка+3×toFixed → числовые эпсилоны
  (0.05px/0.0005zoom); TowerViews `new Set` + sig-строка (map+join) → reused Set + числовая
  сигнатура (count+Σlevel); EnemyViews `new Set` → reused Set; BeamFx `.filter` ×2/кадр →
  in-place swap-remove.
- **prefers-reduced-motion**: motion.ts теперь live-подписан на mediaquery (меняется без релоада,
  если нет ручного override); CSS-блок расширен — комикс-панели/CRT-sweep/blink + общий
  safety-net (*,::before,::after animation/transition 0.01ms).
- **a11y**: focusTrap.ts (installFocusTrap) — role=dialog + aria-modal + Tab-цикл + возврат
  фокуса. Применён к confirmModal (свой inline-вариант), pause-меню и settings-модалке (GameUI
  pauseTrapOff/settingsTrapOff).
- **Lossless-оптимизация (ноль потери качества)** — убраны per-frame аллокации/DOM-трэш БЕЗ
  изменения визуала: ui.update() полностью dirty-checked (lives/gold/wave пишутся только при
  смене; formatHud не аллоцируется на стабильном кадре; .level-num элемент закэширован, не
  querySelector каждый кадр; updateDiffBadge только при смене сложности; invalidateHudCache()
  на смене языка/уровня); shake.applyTo — scratch-объект shakeCenter + инлайн portrait-свопа
  (без {w,h}/{x,y} аллокаций); TowerViews addChild(overlayG) reorder только при смене набора башен.
- **СОЗНАТЕЛЬНО НЕ делали** (жертвуют качеством/видом при требовании «ноль потери»): понижение
  bakeRes по deviceMemory (потеря чёткости silkscreen), healer-pulse через scale (меняет толщину
  линии), бамп мелких шрифтов ≥10px (ломает неон-терминал эстетику), портретный рефактор на
  screen.orientation (рабочий монкипатч, рискованно). Остаток этапа 3 закрыт этим решением.

## Сделано (2026-07-03, вечер — этап «Стабилизация» по прод-аудиту)

Полный аудит-отчёт (6 агентов): артефакт-страница + docs/audits. Порядок этапов от юзера:
1 (стабилизация) → 4 (мета) → 3 (устройства) → 2 (публикация). Сделан этап 1:
- **Эксплойт endless**: advanceWaveEarly не двигал счётчик за пределами скрипта →
  повторный спавн той же волны + бонус за каждый клик. Guard учитывает endless (GameState).
- **Targeting честный**: first/last сравнивают `Enemy.distToBase` (= PathFollower2D.remaining,
  totalLen считается в конструкторе) вместо traveled — на мульти-входовых картах traveled лгал;
  strong — по maxHp (раненый босс держит фокус). hpMul НЕ перекалибровывался — все 12 WIN.
- **Снапшот рана**: dischargeCd + runStats сериализуются (конец сейв-скаму кулдауна);
  `Game.restore` двухфазный — полная валидация (validSnapshot) до ЛЮБОЙ мутации;
  уровень башни через TOWER_DEFS[kind].length, не магическую 2.
- **Кламп tick**: total ≤ 1 c (MAX_FRAME) — свёрнутая вкладка больше не проигрывает волны «за кадром».
  ВАЖНО: тесты тикают по 1 с — кламп 0.5 их ломал, поэтому именно 1.
- **meta.waves валидация значений**: count≥1, interval>0, jitter∈[0,1), delay≥0 — падение на сборке Game.
- **useDischarge ребилдит грид** перед query (иначе первые мс волны бьют по старому гриду).
- **z-шкала в CSS-переменных** (:root --z-*): backdrop 190 (был 90 — HUD кликался сквозь
  затемнение радиала), modal 300; ВСЕ inline zIndex из TS удалены.
- **confirmModal.ts**: showConfirm/showAlert вместо нативных alert/confirm (в iframe itch
  молча блокируются). Кнопка «Сбросить прогресс» была мертва: все футер-кнопки носили класс
  pcb-campaign-reset, querySelector цеплял daily → теперь общий класс pcb-campaign-footer-btn,
  reset уникален.
- **enemyColorHex() в theme.ts** — канон цвета для DOM; 3 дублированные getEnemyColor удалены
  (боss был фиолетовым в бестиарии, розовым в игре).
- Пауза→настройки→закрыть = возврат в ПАУЗУ (settingsReturnToPause в GameUI), не в бой.
- StoryScreen: preventDefault только на обрабатываемые клавиши (был keyboard trap — Tab/F5 глотались).
- Endless: autoWaveBeforeEndless — принудительная автоволна восстанавливается при выходе в меню.
- Утечки: vignette-текстура кэшируется module-level (текла по 256×256 на уровень);
  EnemyViews.dying Set — death-tween убивается в destroy() (гонка с выходом в меню);
  Panels.stopTipRotation при скрытии; tutorialActive в GameUI кэширует querySelector (150мс).
- Перф UI: wavePreview ребилд только при смене волны/языка/уровня (previewKey, сбрасывается
  в setLevelNumber); setAbilityState — dirty-key.
- Гигиена: .DS_Store из гита, .gitignore + pcb-td.zip/coverage; i18n ключи campaign.record/
  norecord/confirm.* (тернарники RU/EN убраны из CampaignMenu).
- Смоук в Chrome (dev-сервер): титул→комикс→L1→туториал→пауза→настройки→карта→reset-confirm —
  всё работает, консоль чистая (pre-existing pixi warn в TowerViews.sync:144 — не трогал).

## Сделано (2026-07-04 — этап 4 «Мета-слой» по прод-аудиту)

Порядок этапов: 1✓ → **4✓** → 3 → 2. Всё через TDD, 426→ тесты зелёные, build чистый.
- **Дерево звёзд** (metaUpgrades.ts): 5 веток × 3 тира (резерв/броня/ресайкл/конденсатор/прошивка),
  полное дерево 33★. Кампания+endless получают meta, **daily НЕТ** (общая честная доска).
  Экраны в metaScreens.ts (showWorkshop с respec, тир-пипсы).
- **Ачивки**: 32 defs в 5 категориях (achievements.ts) — per-run EventBus-трекер + lifetime
  profileStats (pcb_td_stats_v1). Арт код-рисованный SVG (achievementArt.ts, хекс-бейдж + 32 глифа).
  Тосты staggered (showAchievementToasts). Оценка отложена setTimeout(900) — ПОСЛЕ registerVictory
  (иначе all_stars не видит только что забанканную звезду).
  **LIVE-ачивки** (флаг `live` на def): те, что читают только live-счётчики (tracker/game/текущая
  волна), НЕ won и НЕ post-run profile — оцениваются в тикере на throttle 0.5с в фазе 'wave',
  тост всплывает в момент триггера (boss_down, discharge_ace, branch_master, recycler, architect,
  capacitor_hero, overclocker, endless_15/25). evaluateAchievements(ctx, liveOnly). В конце рана
  полная оценка добирает won/lifetime; live уже в save → have.has их пропускает (без дубль-тоста).
  **40 ачивок** (было 32): +8 micro-moment live-ачивок для вау-эффекта в бою. Трекер получил
  frame(dt) (клок рана + per-tick счётчик убийств + slow-стрики по WeakMap<enemy>): last_stand
  (форма убита на клетке<pitch от ядра), interception (босс убит до середины маршрута:
  traveled/(traveled+distToBase)<0.5), chain_reaction (maxKillsInTick≥5 — AOE-вайп за 1 тик),
  quick_flip (продажа ≤3с после постройки: buildAt Map по pos-key), deep_freeze (форма под slow
  10с подряд), capitalist (gold≥1000 в бою), first_blood (башня с ≥100 килл), instant_call
  (вызов волны ≤1с от доступности — таймштамп в main.ts на клике, не на summon). Все RU-имена
  переименованы (ИНИЦИАЛИЗАЦИЯ, УГРОЗА УСТРАНЕНА, ОВЕРКЛОКИНГ, ТЕХНОЭЛИТА…). i18n-completeness
  теперь итерирует ВСЕ ACHIEVEMENTS (name+desc в обеих локалях); missingGlyphs()===[] в тесте.
- **2-я активка OVERLOAD** (радиус 3.2, rateMul 1.7, dur 6, cd 60): buffMul/buffT в Tower,
  useOverload отказывает по пустому клику. armedAbility 'discharge'|'overload', armAbility(),
  хоткеи Q/W, циан-круг прицела. Дебют-карты L3 discharge / L6 overload (showAbilityIntroduction).
- **Статусы**: burn (DoT, игнорит щит/броню, refresh-not-stack, тик клампится Math.min(dt,burnT))
  и armor shred на тир-4 ветках (mortar 'cluster', sniper 'railgun'). applyStatuses в combat.ts
  вызывается на КАЖДОМ задетом враге (direct/splash/chain).
- **Daily-моды** (dailyMods.ts): 2 разных модификатора в день из сида-штампа (swarm ×1.3 count,
  iron ×1.15 hp, blackout −40⚡, windfall +60⚡, embargo бан башни кроме cannon). ВАЖНО: LCG
  прогревается 12 итераций — иначе соседние штампы («…01»/«…02») схлопывались в один и тот же
  первый мод (регресс-тест это ловит). Game opts: countMul/goldDelta/banned; goldDelta с полом 40⚡.
  Радиал показывает ЗАПРЕТ на banned. Alert с условиями при входе; имена модов на кнопке daily.
- **Daily история/серия** (dailyHistory.ts, pcb_td_daily_history_v1): recordDailyWin + dailyStreak
  (сегодня-или-вчера, чтобы несыгранный сегодня не рвал серию). 🔥N на кнопке daily.
- **Share-результат**: dailies+endless получают Wordle-строку в буфер (ui.setShareText + кнопка
  на экранах победы/поражения). **Endless сид фиксирован по дню** (был random) — «волна 23» сравнима.
- **Контекстные хинты** (hints.ts, pcb_td_hints_v1): одноразовые тосты branch/earlycall/upgrade
  (циан, слева снизу). Отдельно от туториала (тот — скрипт для L1). Не показываются под activeTutorial.
- **Комикс-пролог починен** (comicArt.ts): тарелка P1 нацелена на источник (ось −34°, волновые
  фронты центрированы на красной точке), клавиатура/кружка P2 выровнены, красная паутина P3
  дотянута до края + красные виасы на стыке с зелёным, чип P4 сдвинут вверх (не лез в подпись).

## Текущее направление (2026-07)

Курс на production-ready: рендер-фундамент → честные снаряды → juice-пас → звук → мета-прогрессия.
- Полный production-аудит (81 гэп кода + каноны TD + план этапов A–H): `docs/audits/2026-07-03-production-audit.md`
- Спека: `docs/superpowers/specs/2026-07-02-render-refactor-juice-design.md`
- План этапов 0–1: `docs/superpowers/plans/2026-07-02-stage0-1-render-projectiles.md`
- Прогресс исполнения: `.superpowers/sdd/progress.md` (git-ignored леджер)

Утверждённые решения: снаряды честные в симе (PULSE/MISSILE, LASER/TESLA мгновенные);
GSAP + pixi-filters 6.x разрешены (размер бандла не критерий); звук остаётся синтезом.

## Сделано по аудиту (2026-07-03, этап H — мобильная оптимизация)

- **Тач-флоу радиала**: на touch первый тап по пункту = тултип + круг радиуса от площадки
  (`onPreviewRange`, рисуется в persistent-слое game), второй тап = построить; мышь —
  одноклик + превью на hover. `rangePreviewG` в main.ts.
- **Тач-таргеты**: @media ≤800px — все кнопки min 40×40, радиал-пункты 76px, шрифты ≥10-11px,
  панель башни/настройки min-height 40.
- **Safe-area**: env(safe-area-inset-*) в паддингах HUD.
- **Кадрирование по правилу пользователя**: вертикальное центрирование по ПОЛНОМУ вьюпорту
  (HUD/плашки — плавающие оверлеи, НЕ вычитаются), симметричные поля 16px; bbox = трасса+споты.
- Портрет-поворот работает (проверено 390×844): HUD-колонка справа, трасса крупная.
- Ранее в A: DPR cap 2, visibilitychange-пауза; в D/E: bloom res 0.5 + гейт reducedFx.

## Сделано по аудиту (2026-07-03, этап G — контент, частично)

- **Декор-пасс** (по правилам пользователя, см. «Правила декора уровней»): L11 полностью
  пересобран (16 блоков по квадрантам: кварц у MCU, усилитель, LED-ленты, таймеры);
  L08 +timer555+powerSupply; L12 +amplifierStage+кварц; L03 — кривые сегменты ~41.6°
  заменены честными 45°. L10 (крест) НЕ трогать — дорожки покрывают всю доску, карманов нет.
  ВАЖНО: плотный декор ворует площадки башен (patrolSpots после декора) → уровень может
  стать unwinnable; всегда прогонять tests/levels/.
- **DSL build()-валидация**: октилинейность сегментов + границы доски — падение на сборке.
- **Endless-режим ПОЛНОСТЬЮ**: запуск из меню (кнопка «∞ БЕСКОНЕЧНО» после звёзд L12) —
  карта 60×45 diff 9, **автоволна форсируется**; за скриптом волны СИНТЕЗИРУЮТСЯ жёстче
  (`WaveManager.resolveWave`): count ×(1+over·0.18), интервалы ×0.96^over, элитный микс-отряд
  (tank/brute/shielded/carrier) с over≥2, доп. босс каждую 5-ю; HP ramp поверх. HUD N/∞;
  рекорд в pcb_td_endless_best_v1.
- **Daily challenge**: кнопка «📅 ДЕЙЛИ-ПЛАТА» — единый сид дня (YYYYMMDD%100000,
  `dailyStamp()` в CampaignMenu), карта 32×24 diff 5; результат (жизни) в
  pcb_td_daily_YYYYMMDD, показывается на кнопке. Режимы сбрасываются в exitToMenu.
- Кадрирование финально: центр по полному экрану + кламп «не нырять под HUD», при нехватке
  места — refit в полосу под шапкой (обе жалобы пользователя закрыты, L1 и L11 проверены).
- **Разряд (активка) онбординг**: анлок с уровня 3 (до этого кнопки НЕТ; endless/daily/
  генерённые — сразу), карточка «ЦЕПЬ АВАРИЙНОГО РАЗРЯДА ВОССТАНОВЛЕНА» при первом получении
  (persist ability_discharge в seenIntroductions), круг радиуса следует за курсором при
  прицеливании, пульс кнопки до первого использования.
- **Навигация**: кнопка HUD «КАРТА» → «☰ МЕНЮ» (открывает pause-меню: Продолжить/Настройки/
  Перезапуск/Карта кампании); настройки из паузы закрывают pause-слой (z250 давил z200 —
  были некликабельны). Туториал перецепляется в кадр остановки камеры (glide/кламп/resize).
- **Авторские волны на ВСЕХ 12 уровнях** (`b.waves()` в каждом levelNN.ts): дебют каждого
  врага на своём уровне анлока (fast L2, healer L3, brute L4, tank L5, shielded L6, rogue L7,
  carrier L8, boss L8-мини), число волн растёт 8→14, тематика в бою (L9 — ритмы частот,
  L8/L11 — направленные входы pathIndex, L12 — 14-волновая осада с 3 боссами). Мини-боссы:
  L8 в.12, L11 в.13; boss unlock в бестиарии 11→7. hpMul перекалиброван:
  [3.40, 3.80, 1.30, 2.60, 4.00, 1.25, 2.15, 2.65, 3.00, 2.70, 1.20, 2.00]. Кривая потерь
  3→10/20, все WIN. meta.waves тип дополнен delay/mix/jitter; Game валидирует и mix-ключи.
- Backdrop-click закрывает все 5 модалок (настройки/пауза/интро врага/интро разряда/бестиарий).
- **Интро ПЕР-РАН** (юзер: «при каждом прохождении»): карточки врагов/разряда показываются на
  уровне ДЕБЮТА вида (DEBUT_LEVEL map в main) при каждом заходе; persistence
  seenIntroductions больше не гейтит (поле в сейве осталось для совместимости).
  Разряд — карточка на L3 каждый заход.
- Кадрирование учитывает и плашку «СЛЕДУЮЩАЯ ВОЛНА»: она появляется после первого ui.update
  build-фазы → одноразовый re-frame (`framedWithPreview`, объявлен ДО ensureGame — TDZ!).
- Экран победы: у дебрифа был margin-top −20px — наезжал на вставленную статистику; убран.
- **Титульный экран + пролог** (`src/ui/TitleScreen.ts` + `src/ui/comicArt.ts`): ретро-монитор
  «MIZHGAN 8000» (MIZHGAN GAMES ПРЕДСТАВЛЯЕТ / PCB TD / НАЧАТЬ), ЭЛТ-схлоп по клику
  (CSS crtOff/crtOn), комикс-пролог из 4 детальных SVG-сцен с SMIL-анимациями (тарелка
  Вега-9, терминал PAYLOAD RUNNING, заражение платы, первая башня) — панели появляются
  по очереди, клик раскрывает все. Свежий сейв: титул→комикс→сразу L1; ветеран:
  титул→карта кампании. Показывается на корневом пути каждый запуск. i18n comic.1-4, title.*.
  Нейрогенерации изображений в среде НЕТ — арт только кодовый (SVG/canvas-PNG).
- НЕ сделано: челлендж-модификаторы, гиммики уровней (ForkRule), Sentry (нужен DSN),
  ручной Safari/iOS-прогон.

## Сделано по аудиту (2026-07-03, этап F — UX)

- **Pause-меню** (GameUI.showPauseMenu): Продолжить/Настройки/Рестарт/Карта; кнопка КАРТА
  и Esc ведут сюда (конец мискликам, убивавшим ран); pauseForModal/resumeFromModal с
  сохранением НАМЕРЕННОЙ паузы игрока (speedBeforeModal).
- **Хоткеи** (window keydown в main): Space пауза, 1/2/4 скорость, Enter старт/вызов волны,
  U апгрейд (ветка — только кликом, осознанно), M mute, Q активка, **Esc разматывает верхний
  слой**: настройки → pause-меню → прицел разряда → радиал → снятие выделения → pause-меню.
- **Пауза в модалках**: настройки и бестиарий ставят game.speed=0 (раньше враги утекали).
- **Туториал**: кнопка «пропустить обучение» (persist), пересчёт позиций на resize
  (после glide камеры, 450мс).
- **i18n**: тернарники RU/EN → словарь (tower.*, target.*); `i18n.tk()` для динамических
  ключей; **тест-гейт** tests/ui/i18n-completeness.test.ts — story/campaign/branch/enemy
  ключи обязаны быть в ОБЕИХ локалях.
- A11y: aria-label на иконки-кнопки, :focus-visible глобально; autoWave персистится;
  клик-звуки на кнопках victory/defeat.
- Тач-тултипы/превью радиуса до постройки — отложены в этап H (мобильный).

## Сделано по аудиту (2026-07-03, этап E — звуковой люкс)

- **AudioEngine переписан** (граф в шапке файла): sfxBus+musicBus → master →
  **DynamicsCompressor** (−14дБ, 6:1) → destination — конец клиппингу в плотном бою;
  **реверб** ConvolverNode с генерированным импульсом (1.4с) как send; громкости на шинах.
- **tone()/noiseBurst() хелперы** — 15× boilerplate ушёл, файл структурирован.
- **Музыка**: гармония 4 такта Cm→Ab→Eb→Bb (i–VI–III–VII), 3 арп-паттерна (ротация каждые
  4 такта), суб-слой баса, lowpass с LFO 0.07Гц (800–2400Гц), dotted-8th feedback delay,
  синт-перкуссия (kick 120→45Гц, noise-хэты) по tension.
- **Полифония**: canPlay(category, window) — выстрелы 35мс/тип, смерти 50мс;
  **kill-streak**: быстрые смерти подряд поднимаются на полтона (до +12), суб-удар глушится.
- **Дакинг** duckMusic(): босс/алярм/победа/поражение/старт волны приседают музыку.
- **Стерео-панорама** по worldX (±0.6): выстрелы/смерти/взрывы — слышно ГДЕ прорыв.
- **Амбиент build-фазы**: тихий bandpass-гул платы (setAmbient, идемпотентно из тикера).
- playError (отказ покупки), playImpact (тик попадания pulse). mute-кнопка+M — в этапе F.

## Сделано по аудиту (2026-07-03, этап D — визуальный люкс)

- **Волны дожаты по фидбеку**: паузы фаз вдвое короче (тест-гейт: разрыв ≤10с, финал ≤15с);
  `WaveEntry.jitter` — характер расстановки (скученные/растянутые/рваные/ровные);
  **ДДоС-орды** (шаг 0.25с): волна 5 (fast), волна 8 (rogue), финал — каждый босс в своей орде.
  hpMul после всего: [2.10, 3.00, 0.65, 2.35, 3.25, 1.35, 2.65, 1.95, 2.40, 2.60, 0.50, 2.50].
- **Тир-визуалы башен** (TowerViews): чип +7%/уровень, неон-кольца L2/L3, золотая рамка+пипс
  и бело-золотые пины на ветке, пульсирующий золотой ореол max-тира; **доворот прицела** —
  стрелка вокруг чипа доворачивается к цели (чип не вращается — стиль).
- **Живые враги** (EnemyViews): spawn-pop, смерть с растворением (onDied вне пула),
  поворот по движению + микро-боб, **ледяной тинт при slow**, зелёный блик хила (throttle
  0.35с), пипсы щита над HP-баром.
- **Трасса**: halo из 3 вложенных штрихов (псевдо-градиент, StrokeSpec.blur удалён);
  шевроны батчатся в ОДИН Graphics.
- **LED мигают**: слой `decorFx` (не бейкается), `Renderer.updateAmbient(t)` из тикера;
  свободные споты «дышат» в build-фазе (layers.spot.alpha).
- **Камера glide**: `Camera.glideTo/update` — экспоненциальный доезд для frameLevel;
  drag/pinch пишут напрямую (cancelGlide).
- **Vfx**: градиент-виньетка (canvas radial → Sprite) вместо 4 прямоугольников; bloom
  quality 3 + resolution 0.5 + гейт по reducedFx.
- **SVG-иконки** (`src/ui/icons.ts`): ⏸📖⚙️⚡ → инлайн-SVG currentColor; портрет врага
  в интро — реальный глиф+цвет из темы (`enemyGlyphSvg`) вместо 👾.
- **Интро врагов ДО волны**: `introduceUpcoming()` в onStartWaveClick (build: до старта,
  mid-wave call: с паузой); тикер-детектор остался фаллбеком для fragment.
- **Статистика на экранах исхода**: kills/leaks/goldEarned (`Game.runStats`), на поражении
  «Дошли до волны N из M»; **превью дельты апгрейда** в панели башни (DMG 12→18).
- Перф: бейк copper/decor c resolution до 2 (кап по 4096), free-list частиц (recycle Particle).
- Не сделано из D: бегущие шевроны, MeshRope-трейлы снарядов.

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

## LORE.md (корень репо)

Все игровые тексты RU+EN одним документом для внешней редактуры переводов: сеттинг,
слайды комикса, сюжет (интро/брифинги/дебрифы/финал), подсказки, названия уровней,
башни+ветки, враги. Формат записей строгий:
`### key: <i18n-ключ>` → `RU: <текст>` → `EN: <текст>` (одна строка на язык).
Когда пользователь вернёт отредактированный файл — распарсить эти тройки и вписать
значения обратно в src/ui/i18n.ts (ключи 1:1, экранировать кавычки по стилю строки);
раздел 0 (сеттинг) — справочный, в код не вставляется. После вставки прогнать
tests/ui/i18n-completeness.test.ts.

## Правила декора уровней (пользователь, 2026-07-03)

1. Не вылезать за поля платы, не налезать на дорожки врагов (margin 1 клетка), не мешать
   чтению башен — enforced тестами tests/levels/authored-occupancy.test.ts И build()-assert'ами
   в dsl.ts (октилинейность сегментов + границы).
2. **Композиция**: никаких одиночных компонентов, избегать двухкомпонентных пар; соединения
   должны иметь СМЫСЛ (кварц+load caps у MCU = тактовый генератор); не клонировать один
   шаблон много раз — чередовать крупные блоки (amplifierStage/timer555/opAmp/mcuCore/
   powerSupply) с 3+ компонентными связками. passiveBank шаблоны 0-2,4-6,8 — ПАРЫ, их
   поодиночке не ставить (только сателлитами крупных блоков); шаблоны 3 (транзисторный
   каскад) и 7 (кварц) — 3-компонентные, ок.
3. Ширины блоков (для расстановки): powerSupply ~15 клеток, ledBar ~7+n×3 (dip-драйвер на
   oy+3!), amplifierStage ~10×7 (раздвинут с воздухом), passiveBank ~7-9, timer555 ~10×4,
   transistorSwitch раскидывает базовый резистор на ox−6. Проверять vitest tests/levels/.
4. **Наложения деталей запрещены** (юзер: «не наложить деталь на деталь»): инвариант
   `no two decor footprints overlap` в authored-occupancy.test.ts. Внутри фабрик — минимум
   1 клетка воздуха между футпринтами (корпуса+выводы рисуются ШИРЕ клеточного футпринта).

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
