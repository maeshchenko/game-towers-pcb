# PCB TD

Tower defense на печатной плате: враги — пакеты данных, бегущие по медным дорожкам от входа
к выходу; башни — чипы, которые ставятся на монтажные площадки. 12 уровней кампании,
5 типов башен, 7 типов врагов, туториал, бестиарий, встроенный редактор уровней.

Стек: Pixi.js v8, TypeScript (strict), Vite, Vitest.

## Запуск

```bash
npm install
npm run dev        # dev-сервер (http://localhost:5173)
npm run build      # tsc + vite build
npm run test       # юнит-тесты
npm run balance:optimize  # headless-балансировщик кампании
```

Редактор уровней: открыть `/editor`.

## Структура

- `src/game` — симуляция (framework-free, headless-прогоняемая): башни, враги, волны,
  экономика, события.
- `src/render` — Pixi-рендер: плата, трассы, view-объекты игры.
- `src/ui` — DOM HUD, меню кампании, звук (WebAudio-синтез), i18n (RU/EN).
- `src/pipeline`, `src/tiles`, `src/geom` — генерация уровней и геометрия трасс.
- `src/levels/campaign` — 12 авторских уровней (DSL).
- `tests` — Vitest-сьют.

## Документация

- `MEMORY.md` — канонические заметки: решения, конвенции, гочи.
- `PLANS.md` — живой roadmap.
- `docs/superpowers/specs/` — дизайн-спеки, `docs/superpowers/plans/` — планы имплементации.
- `AGENTS.md` — правила работы агентов в репо.
