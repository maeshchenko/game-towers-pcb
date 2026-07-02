# План: этап 2b — переработка декора платы

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Декор выглядит как настоящая плата: детали не лезут на геймплей, разводка по правилам (45°, teardrop-пады, без тупиков), приглушённая палитра, аккуратная композиция. Фидбек пользователя 2026-07-02.

**Context:** Полная карта пайплайна — в отчёте разведки (см. леджер S03). Ключевые точки: `pipeline/decor.ts` (генерация+occupancy), `pipeline/copper.ts` (роутинг, НЕ блокирует споты), `levels/dsl.ts` (дубль FOOTPRINT), `render/Renderer.ts` (drawCopper сырой, drawRoutingWeb — случайный мусор, drawVintageItem без opts), `render/vintageDecor.ts` (локальная яркая палитра C, LED всегда 0xe23a3a), `render/copperStyle.ts` (chamfer45/teardrop — готов, не подключён).

## Global Constraints

- TS strict; `npm run test` + `npm run build` зелёные после каждой задачи; сим/пайплайн — без pixi.
- Коммит после задачи: русский, без AI-упоминаний, без Co-Authored-By, явные пути. НЕ трогать незакоммиченные пользовательские правки (index.html viewport, showFloatingBonusText, range-thumb CSS, .pcb-floating-bonus).
- Визуальная цель каждой задачи: декор — ФОН. Ничто в декоре не должно быть ярче/контрастнее геймплейных элементов (трасса 0x6cf2a0, брекеты 0xe8c84a, октагоны 0x3fb6d8).

### Task A: Занятость — медь и детали не лезут на геймплей
- `pipeline/copper.ts`: блокировать в 2×-гриде клетки спотов и спец-спотов (дилатация 1) так же, как клетки трассы (`copper.ts:84-94`); прокинуть споты в `routeCopper` (вызовы: `dsl.ts:275`, `pipeline/generator.ts`).
- `levels/dsl.ts:15-22`: удалить локальный FOOTPRINT, использовать `footprintCells` из `render/decorBuilder.ts`... ВНИМАНИЕ: dsl — уровень logic, decorBuilder — render, но он framework-free (проверить: если импортирует pixi — вынести FOOTPRINT/footprintCells в `src/model/footprint.ts` и реэкспортировать).
- Убрать straight-line fallback в copper.ts:226-229 — не нашли путь → пропустить сегмент (лучше нет дорожки, чем фейковая через всё).
- Тесты: ни одна копперная полилиния не проходит через клетки спотов (все 12 authored-уровней); футпринты authored-декора не пересекают споты.

### Task B: Медь по правилам — фаски, teardrop, никакого случайного мусора
- `Renderer.drawCopper`: использовать `render/copperStyle.ts` (`strokeCopper`/chamfer45/teardrop) вместо сырых полилиний; via-кружок только там, где конец НЕ на паде компонента (пад рисует vintageDecor) — эвристика: конец полилинии, совпадающий с padAnchor любого элемента → без кружка (или проще: если рядом <0.7 клетки есть pad anchor). turnPenalty 2.0→3.5 (меньше зигзагов).
- `drawRoutingWeb` — УДАЛИТЬ вызов и функцию (случайные обрубки). Взамен ничего: кросс-штриховка+сетка достаточно.
- Тесты: существующие copper-тесты зелёные (при изменении turnPenalty пути меняются — тесты на ортогональность/эндпоинты должны выдержать).

### Task C: Приглушение палитры декора
- `vintageDecor.ts` палитра `C` (строки 24-33): металлики темнее (wire 0xb8c0c0→0x5f6a66, solder 0xe4eaea→0x8b958f, solderMid 0x7e8884→0x4d5652, pad 0xb9c2bd→0x7d8a82), корпуса приглушить (resTan 0xc8a86a→0x8f7d54, disc 0xcf8a3c→0x8f6a3c, elecBlue 0x2747a0→0x2a3a5c), **ledRed 0xe23a3a→убрать красный вовсе**: LED цвет по variant — variant 1 → тусклый зелёный 0x2f7a4a, иначе тусклый янтарь 0x7d6a2f; `Renderer.drawVintageItem` (Renderer.ts:176) передать `{ color }` по variant. Белые блики/спекуляры — alpha вдвое ниже.
- Слой декора: `layers.decor.alpha = 0.8`, слой copper: `alpha = 0.9` (после cacheAsTexture — проверить, что alpha применяется к контейнеру поверх кэша).
- Тест: нет (визуал); build.

### Task D: Композиция — поля, меньше одиночек
- `dsl.ts` `fillBlocks`: default gap 1→2 (декор дальше от трассы).
- `pipeline/decor.ts`: `tpTarget` (test points) 4-8→2-4; `viaTarget` /150→/260 (меньше случайных виа); mark() margin 1→оставить.
- authored-уровни НЕ перекраивать вручную — блоки уже структурные; правки только параметрические.
- Тесты: существующие decor-тесты (4 mounting holes и пр.) зелёные; подкрутить константы в тестах, если они пиннили старые цифры.

### Task E (контроллер): визуальный QA-цикл
Скриншоты уровней 1/5/12, сравнение с фидбеком, итерации параметров до «фон не отвлекает». Затем S02 Task 12 (перф+финал).
