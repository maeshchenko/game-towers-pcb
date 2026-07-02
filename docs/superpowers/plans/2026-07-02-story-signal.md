# План: сюжет «Сигнал извне»

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Текстовый сюжетный каркас: POST-интро, брифинги журнала смены перед уровнями, дебрифы с процентом очистки, финальный лог с твистом, статусы на карте кампании, бестиарий как «классификация форм».

**Spec (канон, все тексты RU там):** `docs/superpowers/specs/2026-07-02-story-signal-design.md`

## Global Constraints

- TS strict; `npm run test` + `npm run build` зелёные после каждой задачи; сим (`src/game`) не трогается.
- Коммит после задачи: русский, без AI-упоминаний, без Co-Authored-By, явные пути. В `src/main.ts` есть незакоммиченный пользовательский ханк (`showFloatingBonusText`, ~line 985) — коммитить только свои ханки (git apply --cached), проверять `git diff src/main.ts` после.
- Все тексты — через i18n (`src/ui/i18n.ts`), ключи `story.*`; RU из спеки ДОСЛОВНО, EN — перевод 1:1 тем же сухим регистром (КАПС там же, никаких эмоций и добавлений).
- Стиль терминала: моноширинный, зелёный на тёмном (палитра HUD), курсор-блок.

---

### Task 1: Данные истории + i18n + тесты

**Files:**
- Create: `src/story/campaignStory.ts`
- Modify: `src/ui/i18n.ts` (ключи story.* RU+EN)
- Test: `tests/story/campaignStory.test.ts`

**Interfaces (Produces):**
```ts
export interface StoryLine { key: string; glitch?: boolean; pauseMs?: number }
export interface LevelStory { brief: StoryLine[]; debriefKey: string; cleanupPct: number }
export const CAMPAIGN_STORY: {
  intro: StoryLine[]
  final: StoryLine[]
  levels: LevelStory[]          // ровно 12
}
export function cleanupPercent(completedLevels: number): number  // сумма cleanupPct первых N
```
- Тексты: перенести из спеки дословно (RU), EN перевести. Пустые строки спеки = StoryLine с key на пустую строку не нужен — использовать `{ key: 'story.blank' }` → i18n значение `' '` (одна строка-пауза), или поле `pauseMs` на предыдущей строке — решить и зафиксировать в коде комментарием.
- Глитч-флаги: брифинги уровней 8–11 — по 1–2 строки с `glitch: true`; в финале — строки «СИГНАЛ ПОВТОРЯ…».
- Тест: 12 уровней; `levels.map(l=>l.cleanupPct)` суммируется в 100; каждый key существует в RU и EN словарях; у L8–L11 есть хотя бы одна glitch-строка.

### Task 2: StoryScreen — терминальный оверлей

**Files:**
- Create: `src/ui/StoryScreen.ts`
- Modify: `src/ui/styles.css`
- Test: build + контроллер-QA (DOM-анимации)

**Interfaces (Produces):**
```ts
export class StoryScreen {
  show(lines: StoryLine[], opts: { title?: string; onDone: () => void; closeLabel?: string }): void
  destroy(): void
}
```
- Полноэкранный оверлей поверх всего (z выше victory), тёмный фон (#050c09 0.96), центрированная колонка ≤640px, моноширинный.
- Печать по буквам: 28мс/символ, после `.`/`:`/`…` пауза 220мс, между строками 120мс (+pauseMs строки). Мигающий курсор-блок `▌` на активной строке.
- Клик/клавиша: №1 — допечатать всё мгновенно; №2 — закрыть (вызвать onDone). Кнопка `[ ПРОДОЛЖИТЬ ]` появляется после допечатки.
- Глитч-строки: после допечатки 1–2 случайных символа строки мерцают подменой (`§▓/0-9`) каждые ~120мс (перерисовка через setInterval, чистится в destroy/close).
- `juice.reducedFx` (импорт из render/juice/motion) ИЛИ `prefers-reduced-motion`: печать мгновенная, глитч выключен.
- i18n: заголовок и строки резолвятся через `i18n.t(key)` в момент показа.

### Task 3: Интеграция потока

**Files:**
- Modify: `src/main.ts` (интро/брифинг/финал), `src/game/campaign.ts` (прогресс-флаги), `src/ui/GameUI.ts` (дебриф-строка в победном экране)

**Binding:**
- Прогресс (`campaign.ts`): `storyIntroSeen?: boolean`, `storyBriefSeen?: Record<number, boolean>` в types + save/load (аналогично seenIntroductions).
- Выбор уровня (onSelectLevel): если `index===0 && !storyIntroSeen` → StoryScreen(intro) → отметить → затем брифинг. Брифинг: если `!storyBriefSeen[index]` → StoryScreen(levels[index].brief, title «ЖУРНАЛ СМЕНЫ · ЗАПИСЬ NN») → отметить. Показ ПОСЛЕ загрузки уровня (фон = плата уровня), игра на паузе до закрытия (волна и так не стартует без кнопки — достаточно). Retry уровень — флаг уже стоит → не показывается.
- Победа: `ui.showVictoryScreen(...)` получает новый опциональный параметр `debrief?: string` — строка `i18n.t(levels[i].debriefKey)`; рендерится над кнопками мелким терминальным шрифтом. После L12 (index 11): СНАЧАЛА StoryScreen(final) (глитч-строки), по закрытию — обычный победный экран.
- `cleanupPercent(unlockedLevelIndex)` — для меню (Task 4).

### Task 4: Карта кампании — статусы и «ЛОГ»

**Files:**
- Modify: `src/ui/CampaignMenu.ts`, `src/ui/i18n.ts` (ключи статусов), `src/ui/styles.css`

**Binding:**
- Подзаголовок меню: `СТАНЦИЯ «ВЕГА-9» · ОЧИСТКА: NN%` (ключи `story.station`, процент из cleanupPercent по числу пройденных).
- Карточки: пройден → бейдж `ИЗОЛИРОВАНО` (зелёный, вместо «НЕТ РЕКОРДА»-зоны не мешая рекорду), доступен → `ЗАРАЖЕНО` (красный), заблокирован → `НЕТ СВЯЗИ` (вместо «ЗАБЛОКИРОВАНО», замок остаётся).
- На пройденных карточках кнопка `ЛОГ` — открывает StoryScreen с брифингом уровня (повтор). CampaignMenu получает колбэк `onShowLog(index)` из main.ts.
- EN-статусы: ISOLATED / INFECTED / NO LINK.

### Task 5: Бестиарий «формы сигнала»

**Files:**
- Modify: `src/ui/i18n.ts` (тексты бестиария), `src/ui/CampaignMenu.ts` (если заголовки там)

**Binding:**
- Каждому врагу — номенклатура в заголовке: `ФОРМА-01 «ПАКЕТ»` … boss = `ФОРМА-07 «НОСИТЕЛЬ»`. Существующие описания уязвимостей сохранить, первую строку описания заменить на классификацию в духе спеки (сухо: «Минимальная самокопирующаяся единица сигнала.»). RU+EN.
- Попап «ОБНАРУЖЕН НОВЫЙ СИГНАЛ!» — заголовок вида `ФОРМА-NN «ИМЯ»` (тот же ключ).

### Task 6 (контроллер): визуальный QA

Скриншоты: интро, брифинг L1, глитч-брифинг L9, дебриф на победном экране, карта с процентом/статусами, финал (форсировать через локальный прогон). Проверка reducedFx (мгновенная печать). Скриншоты пользователю.

## Self-review (выполнен)

Покрытие спеки: интро/брифинги/дебрифы/финал ✔ (T1–T3), меню/статусы/ЛОГ ✔ (T4), бестиарий ✔ (T5), глитч+reducedFx ✔ (T2), проценты ✔ (T1: тест суммы). Типы сквозные: StoryLine/CAMPAIGN_STORY (T1→T2,T3), StoryScreen.show (T2→T3,T4), cleanupPercent (T1→T3,T4), onShowLog (T3→T4).
