# PCB TD — ЛОР И ВСЕ ИГРОВЫЕ ТЕКСТЫ / LORE & ALL GAME TEXTS

> **Как править / How to edit:** меняйте ТОЛЬКО текст после `RU:` и `EN:`.
> Строки `### key:` не трогать — по ним тексты вставляются обратно в игру автоматически.
> Пустая строка между записями обязательна. Кавычки внутри текста — обычные.

---

## 0. Сеттинг и затравка / Setting & premise

**RU.** Станция дальней космической связи «Вега-9» десятилетиями слушала пустоту. Однажды
пустота ответила: принятый сигнал оказался не посланием, а исполняемым кодом — он запустился
прямо в приёмном тракте и за ночь расползся по печатным платам станции. Заражённые цепи
нельзя обесточить: питание ядра станции должно оставаться включённым. Остался один инженер
смены и ящик запасных чипов. Игрок — этот инженер: каждый уровень — одна плата станции,
дорожки — маршруты «форм сигнала» (врагов), монтажные площадки — места для башен-чипов.
Задача кампании — изолировать заражение плата за платой и дойти до генератора, где сидит
управляющая форма. Тон: тихий инженерный хоррор + практичный оптимизм ремонтника; вся
терминология честно-электронная (формы, пакеты, шины, разряды), никакой магии.

**EN.** Deep-space relay station Vega-9 listened to the void for decades. One day the void
answered: the received signal wasn't a message but executable code — it ran inside the
receiver chain itself and crawled across the station's circuit boards overnight. Infected
circuits can't simply be powered down: core power must stay on. One shift engineer remains,
with a crate of spare chips. The player IS that engineer: every level is one board, the
copper traces are the routes of "signal forms" (enemies), mounting pads hold tower chips.
The campaign's goal is to isolate the infection board by board and reach the generator where
the controlling form resides. Tone: quiet engineering horror plus a repairman's practical
optimism; all terminology is honest electronics (forms, packets, buses, discharges) — no magic.

---

## 1. Вводные слайды (комикс) / Intro comic slides

### key: title.presents
RU: MIZHGAN GAMES ПРЕДСТАВЛЯЕТ
EN: MIZHGAN GAMES PRESENTS

### key: title.tagline
RU: tower defense на печатной плате
EN: a tower defense on a printed circuit board

### key: comic.1
RU: Станция дальней связи «Вега-9». Десятилетиями антенны слушали пустоту — и однажды пустота ответила.
EN: Deep-space relay station Vega-9. For decades the antennas listened to the void — until the void answered.

### key: comic.2
RU: Сигнал оказался не посланием. Контрольные суммы сходились сами собой: код исполнялся прямо в приёмном тракте.
EN: The signal was no message. Its checksums resolved themselves: the code was EXECUTING inside the receiver chain.

### key: comic.3
RU: За ночь он расползся по платам станции, переписывая всё на своём пути. Заражённые цепи не отключить — питание ядра трогать нельзя.
EN: Overnight it crawled across the station's boards, rewriting everything it touched. Infected circuits can't be shut down — core power must stay on.

### key: comic.4
RU: Остался один инженер и ящик запасных чипов. Каждая плата — рубеж. Каждая дорожка — линия фронта.
EN: One engineer remains, with a crate of spare chips. Every board is a front line. Every trace is a trench.


---

## 2. Сюжетные тексты / Story texts

### Интро станции (терминал перед уровнем 1) / Station intro

### key: story.intro.title
RU: DSCS VEGA-9 · INBOUND CARRIER
EN: DSCS VEGA-9 · INBOUND CARRIER

### key: story.intro.1
RU: DSCS VEGA-9 · POWER-ON SELF TEST………… OK
EN: DSCS VEGA-9 · POWER-ON SELF TEST………… OK

### key: story.intro.2
RU: RECEIVER CHAIN……………………………………… OK
EN: RECEIVER CHAIN……………………………………… OK

### key: story.intro.3
RU: REFERENCE OSCILLATOR………………………… OK
EN: REFERENCE OSCILLATOR………………………… OK

### key: story.intro.4
RU: INBOUND CARRIER: DETECTED
EN: INBOUND CARRIER: DETECTED

### key: story.intro.5
RU: ORIGIN: UNRESOLVED
EN: ORIGIN: UNRESOLVED

### key: story.intro.6
RU: STRUCTURE: PERIODIC. DECODING…
EN: STRUCTURE: PERIODIC. DECODING…

### key: story.intro.7
RU: WARNING: PAYLOAD IS EXECUTABLE.
EN: WARNING: PAYLOAD IS EXECUTABLE.

### key: story.intro.8
RU: WARNING: PAYLOAD IS RUNNING.
EN: WARNING: PAYLOAD IS RUNNING.

### key: story.intro.9
RU: ЖУРНАЛ СМЕНЫ: сигнал воспроизводит себя в приёмном тракте.
EN: SHIFT LOG: the signal is replicating inside the receiver chain.

### key: story.intro.10
RU: Начинаю изоляцию заражённых плат. Связи с внешним миром нет
EN: Beginning isolation of infected boards. No outside contact

### key: story.intro.11
RU: до окончания работ. Питание ядра отключать нельзя.
EN: until work is complete. Core power must stay on.


### Брифинги и дебрифы уровней / Level briefs & debriefs

### key: story.l01.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 01
EN: SHIFT LOG · ENTRY 01

### key: story.l01.brief.2
RU: Плата входных шин. Первичное заражение.
EN: Input bus board. Primary infection.

### key: story.l01.brief.3
RU: Сигнал разбит на пакеты, движется к выходному разъёму.
EN: Signal split into packets, moving toward the output connector.

### key: story.l01.brief.4
RU: Задача: не выпустить ни одного пакета с платы.
EN: Task: let no packet leave the board.

### key: story.l01.brief.5
RU: Чипы ставить на монтажные площадки. Питание держит база.
EN: Mount chips on build pads. Base holds power.

### key: story.l01.debrief
RU: INPUT BUSES ISOLATED. STATION CLEANUP: 6%
EN: INPUT BUSES ISOLATED. STATION CLEANUP: 6%

### key: story.l02.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 02
EN: SHIFT LOG · ENTRY 02

### key: story.l02.brief.2
RU: Ключевой каскад приёмника. Сигнал прошёл дальше, чем ожидалось.
EN: Receiver key stage. Signal advanced further than expected.

### key: story.l02.brief.3
RU: Зафиксированы быстрые формы: сокращённые копии несущей.
EN: Fast forms recorded: shortened copies of the carrier.

### key: story.l02.brief.4
RU: Скорость распространения выше расчётной на 12%.
EN: Propagation speed 12% above calculated.

### key: story.l02.brief.5
RU: Задача: изоляция каскада.
EN: Task: isolate the stage.

### key: story.l02.debrief
RU: KEY STAGE ISOLATED. STATION CLEANUP: 13%
EN: KEY STAGE ISOLATED. STATION CLEANUP: 13%

### key: story.l03.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 03
EN: SHIFT LOG · ENTRY 03

### key: story.l03.brief.2
RU: Двойной контур декодера. Сигнал идёт двумя путями одновременно.
EN: Decoder dual circuit. Signal travels two paths at once.

### key: story.l03.brief.3
RU: Копии синхронизированы между собой. Механизм синхронизации не ясен.
EN: Copies are synchronized with each other. Sync mechanism unclear.

### key: story.l03.brief.4
RU: Приёмный тракт после этой платы — чист.
EN: Receiver chain past this board is clean.

### key: story.l03.brief.5
RU: Задача: закрыть оба пути. Акт изоляции тракта — финальный.
EN: Task: close both paths. Final act of chain isolation.

### key: story.l03.debrief
RU: RECEIVER CHAIN FULLY ISOLATED. STATION CLEANUP: 20%
EN: RECEIVER CHAIN FULLY ISOLATED. STATION CLEANUP: 20%

### key: story.l04.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 04
EN: SHIFT LOG · ENTRY 04

### key: story.l04.brief.2
RU: Аномалия. Сигнал обнаружен в цепях ПИТАНИЯ.
EN: Anomaly. Signal detected in the POWER lines.

### key: story.l04.brief.3
RU: Он не должен уметь переходить через развязку.
EN: It should not be able to cross the isolation barrier.

### key: story.l04.brief.4
RU: Зафиксированы бронированные формы: несущая с избыточным кодированием.
EN: Armored forms recorded: carrier with redundant encoding.

### key: story.l04.brief.5
RU: Задача: изоляция шунта. Пересмотреть схему отступления.
EN: Task: isolate the shunt. Revise the fallback plan.

### key: story.l04.debrief
RU: SHUNT ISOLATED. BARRIER CROSSING DOCUMENTED. CLEANUP: 28%
EN: SHUNT ISOLATED. BARRIER CROSSING DOCUMENTED. CLEANUP: 28%

### key: story.l05.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 05
EN: SHIFT LOG · ENTRY 05

### key: story.l05.brief.2
RU: Спиральный мост межблочной связи. Здесь сигнал впервые ЖДАЛ.
EN: Inter-block spiral bridge. Here the signal WAITED for the first time.

### key: story.l05.brief.3
RU: Формы удерживали позицию до подачи питания на плату.
EN: Forms held position until the board was powered.

### key: story.l05.brief.4
RU: Отмечены регенерирующие структуры: повреждённые копии
EN: Regenerating structures noted: damaged copies

### key: story.l05.brief.5
RU: восстанавливаются за счёт соседних.
EN: restore themselves using neighboring ones.

### key: story.l05.brief.6
RU: Задача: изоляция моста. Не оставлять повреждённые формы без контроля.
EN: Task: isolate the bridge. Do not leave damaged forms unattended.

### key: story.l05.debrief
RU: BRIDGE ISOLATED. STATION CLEANUP: 36%
EN: BRIDGE ISOLATED. STATION CLEANUP: 36%

### key: story.l06.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 06
EN: SHIFT LOG · ENTRY 06

### key: story.l06.brief.2
RU: Главная магистраль данных. Плотность форм — максимальная с начала работ.
EN: Main data highway. Form density — highest since work began.

### key: story.l06.brief.3
RU: Наблюдение: последовательность манёвров сигнала повторяет
EN: Observation: the signal's maneuver sequence repeats

### key: story.l06.brief.4
RU: мою вчерашнюю схему расстановки чипов. Задержка — 3.2 секунды.
EN: my chip placement pattern from yesterday. Delay — 3.2 seconds.

### key: story.l06.brief.5
RU: Совпадение исключено. Он смотрит.
EN: Coincidence ruled out. It is watching.

### key: story.l06.brief.6
RU: Задача: изоляция магистрали.
EN: Task: isolate the highway.

### key: story.l06.debrief
RU: HIGHWAY ISOLATED. STATION CLEANUP: 44%
EN: HIGHWAY ISOLATED. STATION CLEANUP: 44%

### key: story.l07.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 07
EN: SHIFT LOG · ENTRY 07

### key: story.l07.brief.2
RU: Коммутационная сетка. Сигнал использует обходные маршруты,
EN: Switching grid. Signal is using bypass routes

### key: story.l07.brief.3
RU: которых нет в документации станции.
EN: not present in station documentation.

### key: story.l07.brief.4
RU: Вывод: он знает трассировку лучше меня. Источник знания не ясен.
EN: Conclusion: it knows the routing better than I do. Source of knowledge unclear.

### key: story.l07.brief.5
RU: Задача: изоляция сетки. Дальше — силовой отсек.
EN: Task: isolate the grid. Power bay next.

### key: story.l07.debrief
RU: GRID ISOLATED. SOUTH WING CLEAN. STATION CLEANUP: 53%
EN: GRID ISOLATED. SOUTH WING CLEAN. STATION CLEANUP: 53%

### key: story.l08.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 08
EN: SHIFT LOG · ENTRY 08

### key: story.l08.brief.2
RU: Силовой отсек. Работы под напряжением.
EN: Power bay. Working live.

### key: story.l08.brief.3
RU: Сигнал уплотнил формы: меньше копий, больше массы.
EN: Signal has compacted its forms: fewer copies, more mass.

### key: story.l08.brief.4
RU: Датчики отсека передают шум. Часть записей журнала повреждена.
EN: Bay sensors report noise. Part of the log is corrupted.

### key: story.l08.brief.5
RU: Задача: изоляция силовой платы. Осторо////////но.
EN: Task: isolate the power board. Caut////////ion.

### key: story.l08.debrief
RU: POWER BOARD ISOLATED. SENSORS PARTIALLY RESTORED. CLEANUP: 62%
EN: POWER BOARD ISOLATED. SENSORS PARTIALLY RESTORED. CLEANUP: 62%

### key: story.l09.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 09
EN: SHIFT LOG · ENTRY 09

### key: story.l09.brief.2
RU: Делитель опорной частоты. Сигнал пытается ПОДСТРОИТЬСЯ
EN: Reference frequency divider. Signal is trying to SYNC

### key: story.l09.brief.3
RU: под тактовую сетку станции. Если подстроится — станет неотличим
EN: to the station's clock grid. If it syncs, it becomes indistinguishable

### key: story.l09.brief.4
RU: от штатного трафика.
EN: from normal traffic.

### key: story.l09.brief.5
RU: Задача: изоляция делителя до завершения подстройки.
EN: Task: isolate the divider before sync completes.

### key: story.l09.brief.6
RU: Осталось два уровня защиты до генератора.
EN: Two defense layers remain before the generator.

### key: story.l09.debrief
RU: DIVIDER ISOLATED. SYNC ATTEMPT DISRUPTED. STATION CLEANUP: 71%
EN: DIVIDER ISOLATED. SYNC ATTEMPT DISRUPTED. STATION CLEANUP: 71%

### key: story.l10.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 10
EN: SHIFT LOG · ENTRY 10

### key: story.l10.brief.2
RU: Многослойный мост ядра. Сигнал идёт по внутренним слоям платы —
EN: Core multi-layer bridge. Signal travels the board's inner layers —

### key: story.l10.brief.3
RU: там, куда нельзя поставить чип.
EN: where no chip can be placed.

### key: story.l10.brief.4
RU: Формы выходят на поверхность только на переходных отверстиях.
EN: Forms surface only at the vias.

### key: story.l10.brief.5
RU: Задача: изоляция моста. Бить по точкам выхода.
EN: Task: isolate the bridge. Strike the exit points.

### key: story.l10.debrief
RU: CORE BRIDGE ISOLATED. STATION CLEANUP: 80%
EN: CORE BRIDGE ISOLATED. STATION CLEANUP: 80%

### key: story.l11.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 11
EN: SHIFT LOG · ENTRY 11

### key: story.l11.brief.2
RU: Предъядерный контур. Сигнал бросил на прорыв все накопленные формы.
EN: Pre-core circuit. Signal has thrown every accumulated form at the breach.

### key: story.l11.brief.3
RU: Три волны идут с трёх направлений одновременно.
EN: Three waves come from three directions at once.

### key: story.l11.brief.4
RU: Журнал вести некогда. Если запись обрывается —
EN: No time to keep the log. If this entry cuts off —

### key: story.l11.brief.5
RU: генератор защищать по схеме 12.
EN: defend the generator per scheme 12.

### key: story.l11.brief.6
RU: Задача: удержать контур.
EN: Task: hold the circuit.

### key: story.l11.debrief
RU: CIRCUIT HELD. BREACH REPELLED. STATION CLEANUP: 90%
EN: CIRCUIT HELD. BREACH REPELLED. STATION CLEANUP: 90%

### key: story.l12.brief.1
RU: ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 12
EN: SHIFT LOG · ENTRY 12

### key: story.l12.brief.2
RU: Генератор опорной частоты. Последняя плата.
EN: Reference oscillator. Final board.

### key: story.l12.brief.3
RU: Сигнал понял, что проиграл станцию. Теперь ему нужен передатчик:
EN: The signal knows it has lost the station. Now it needs a transmitter:

### key: story.l12.brief.4
RU: одна секунда на несущей — и он уйдёт в эфир. Дальше — везде.
EN: one second on the carrier — and it goes out over the air. After that — everywhere.

### key: story.l12.brief.5
RU: Задача: не дать сигналу коснуться генератора.
EN: Task: do not let the signal touch the generator.

### key: story.l12.brief.6
RU: Другой записи не будет.
EN: There will be no other entry.

### key: story.l12.debrief
RU: GENERATOR CLEAN. TRANSMISSION BLOCKED. STATION CLEANUP: 100%
EN: GENERATOR CLEAN. TRANSMISSION BLOCKED. STATION CLEANUP: 100%


### Финал / Finale

### key: story.final.1
RU: GENERATOR CLEAN.
EN: GENERATOR CLEAN.

### key: story.final.2
RU: TRANSMISSION BLOCKED.
EN: TRANSMISSION BLOCKED.

### key: story.final.3
RU: STATION CLEANUP: 100%
EN: STATION CLEANUP: 100%

### key: story.final.4
RU: POWER-ON SELF TEST………… OK
EN: POWER-ON SELF TEST………… OK

### key: story.final.5
RU: RECEIVER CHAIN…………………… OK
EN: RECEIVER CHAIN…………………… OK

### key: story.final.6
RU: REFERENCE OSCILLATOR…………… OK
EN: REFERENCE OSCILLATOR…………… OK

### key: story.final.7
RU: ЖУРНАЛ СМЕНЫ · ПОСЛЕДНЯЯ ЗАПИСЬ
EN: SHIFT LOG · FINAL ENTRY

### key: story.final.8
RU: Станция чиста. Все платы изолированы, трафик штатный.
EN: Station is clean. All boards isolated, traffic nominal.

### key: story.final.9
RU: Работы завершены.
EN: Work complete.

### key: story.final.10
RU: …
EN: …

### key: story.final.11
RU: INBOUND CARRIER: ACTIVE
EN: INBOUND CARRIER: ACTIVE

### key: story.final.12
RU: ORIGIN: UNRESOLVED
EN: ORIGIN: UNRESOLVED

### key: story.final.13
RU: SIGNAL REPEATS
EN: SIGNAL REPEATS

### key: story.final.14
RU: SIGNAL REPEATS
EN: SIGNAL REPEATS

### key: story.final.15
RU: SIGNAL REPEA//////////
EN: SIGNAL REPEA//////////

### key: story.final.16
RU: RECEIVER MANUALLY DISCONNECTED.
EN: RECEIVER MANUALLY DISCONNECTED.

### key: story.final.17
RU: END OF LOG.
EN: END OF LOG.


---

## 3. Подсказки / Tips

### key: tips.desc1
RU: Изгибы и петли трассы — золотые места: одна башня простреливает несколько проходов.
EN: Trace bends and loops are gold: one tower covers several passes.

### key: tips.desc2
RU: Бирюзовые контакты дают чипу +35% к урону и дальности. Ставьте туда самое дорогое.
EN: Cyan contacts give a chip +35% damage and range. Put your priciest tower there.

### key: tips.desc3
RU: Досрочный старт волны даёт бонус ⚡ — и он растёт с номером волны. Рискуйте.
EN: Starting a wave early grants bonus ⚡ — and it grows with the wave number. Take the risk.

### key: tips.desc4
RU: SLOW не наносит урона, но связка SLOW + MISSILE решает: медленная толпа = весь сплэш в цель.
EN: SLOW deals no damage, but SLOW + MISSILE wins: a slowed crowd eats the full splash.

### key: tips.desc5
RU: LASER пробивает броню — единственный надёжный ответ ФОРМЕ-04 «НАКОПИТЕЛЬ» и «НОСИТЕЛЮ».
EN: LASER pierces armor — the only reliable answer to FORM-04 "ACCUMULATOR" and the "CARRIER".

### key: tips.desc6
RU: Ракета MISSILE летит в точку упреждения — быстрые формы уворачиваются. Сначала замедлите их.
EN: MISSILE shells fly to a predicted point — fast forms dodge them. Slow them down first.

### key: tips.desc7
RU: TESLA бьёт цепью по 3–5 целям. Ставьте у плотных изгибов, где формы идут кучей.
EN: TESLA chains across 3–5 targets. Place it at tight bends where forms bunch up.

### key: tips.desc8
RU: РЕГЕНЕРАТОР лечит соседние формы. Снимайте его первым — смените приоритет башни на «сильный».
EN: The REGENERATOR heals nearby forms. Kill it first — switch tower priority to "strong".

### key: tips.desc9
RU: ГЛИТЧ дёргается: то ползёт, то рвёт. Аура SLOW стабилизирует его скорость.
EN: The GLITCH twitches: crawls, then bursts. A SLOW aura stabilizes its speed.

### key: tips.desc10
RU: НОСИТЕЛЬ невосприимчив к замедлению. Против него — только чистый урон и броня-пробой.
EN: The CARRIER is immune to slows. Only raw damage and armor piercing work.

### key: tips.desc11
RU: Один чип 3-го уровня обычно сильнее двух новых. Концентрируйте энергию.
EN: One level-3 chip usually beats two fresh ones. Concentrate your energy.

### key: tips.desc12
RU: Продажа возвращает 60% вложенного. Не бойтесь перестраивать оборону под состав волны.
EN: Selling refunds 60%. Do not be afraid to rebuild your defense for the wave ahead.


---

## 4. Названия уровней / Level names

### key: campaign.level0.name
RU: Вводные шины
EN: Input Buses

### key: campaign.level1.name
RU: Поворот ключа
EN: Key Turn

### key: campaign.level2.name
RU: Двойной контур
EN: Dual Circuit

### key: campaign.level3.name
RU: Шунт питания
EN: Power Shunt

### key: campaign.level4.name
RU: Спиральный мост
EN: Spiral Bridge

### key: campaign.level5.name
RU: Широкая магистраль
EN: Wide Highway

### key: campaign.level6.name
RU: Сетка контактов
EN: Pin Grid

### key: campaign.level7.name
RU: Высокое напряжение
EN: High Voltage

### key: campaign.level8.name
RU: Делитель частоты
EN: Frequency Divider

### key: campaign.level9.name
RU: Многослойный мост
EN: Multi-Layer Bridge

### key: campaign.level10.name
RU: Критический перегруз
EN: Critical Overload

### key: campaign.level11.name
RU: Финал: Генератор
EN: Final: Generator


---

## 5. Башни / Towers

> Имена башен (PULSE, SLOW, LASER, MISSILE, TESLA) — латиницей в обоих языках, это маркировка чипов.

### key: tower.cannon.desc
RU: Базовый чип средней дальности. Стабильный импульсный урон.
EN: Basic medium-range chip. Stable pulse damage.

### key: tower.slow.desc
RU: Замедляет сигналы в радиусе действия. Не наносит урона.
EN: Slows signals in range. Deals no damage.

### key: tower.sniper.desc
RU: Мощный лазер. Огромный урон и радиус с пробитием брони.
EN: Powerful laser. Huge damage and range with armor penetration.

### key: tower.mortar.desc
RU: Выпускает мощные накопительные заряды, наносящие урон по площади.
EN: Fires high-capacity discharge pulses dealing area damage.

### key: tower.tesla.desc
RU: Генерирует электрические разряды, перескакивающие между целями.
EN: Generates electrical discharges jumping between targets.


### Ветки улучшений / Upgrade branches

### key: branch.overclock.name
RU: РАЗГОН
EN: OVERCLOCK

### key: branch.overclock.desc
RU: Втрое выше скорострельность — шинковка толп.
EN: Triple fire rate — shreds swarms.

### key: branch.piercer.name
RU: БРОНЕБОЙ
EN: PIERCER

### key: branch.piercer.desc
RU: Тяжёлые пули пробивают любую броню.
EN: Heavy rounds punch through any armor.

### key: branch.cryostat.name
RU: КРИОСТАТ
EN: CRYOSTAT

### key: branch.cryostat.desc
RU: Глубокая заморозка в компактном поле.
EN: Deep freeze in a compact field.

### key: branch.fieldcoil.name
RU: КАТУШКА ПОЛЯ
EN: FIELD COIL

### key: branch.fieldcoil.desc
RU: Огромный радиус замедления.
EN: Huge slow-field radius.

### key: branch.railgun.name
RU: РЕЛЬСОТРОН
EN: RAILGUN

### key: branch.railgun.desc
RU: Медленный выстрел чудовищной силы — гроза боссов.
EN: Slow, monstrous single shot — boss killer.

### key: branch.splitbeam.name
RU: РАСЩЕПИТЕЛЬ
EN: SPLIT BEAM

### key: branch.splitbeam.desc
RU: Луч ветвится на соседние цели.
EN: The beam forks into nearby targets.

### key: branch.cluster.name
RU: КАССЕТА
EN: CLUSTER

### key: branch.cluster.desc
RU: Ковровый удар по огромной площади.
EN: Carpet strike over a huge area.

### key: branch.buster.name
RU: ПРОБОЙНИК
EN: BUSTER

### key: branch.buster.desc
RU: Редкий, но сокрушительный бронебойный снаряд.
EN: Rare but devastating armor-piercing shell.

### key: branch.arcmatrix.name
RU: ДУГОВАЯ МАТРИЦА
EN: ARC MATRIX

### key: branch.arcmatrix.desc
RU: Длинные цепи молний плавят рои.
EN: Long lightning chains melt swarms.

### key: branch.capacitor.name
RU: КОНДЕНСАТОР
EN: CAPACITOR

### key: branch.capacitor.desc
RU: Редкий мощный разряд по группе.
EN: Rare, massive group discharge.


---

## 6. Враги / Enemies

### key: enemy.normal
RU: ФОРМА-01 «ПАКЕТ»
EN: FORM-01 "PACKET"

### key: enemy.normal.desc
RU: Минимальная самокопирующаяся единица сигнала.
EN: Minimal self-replicating unit of the signal.

### key: enemy.normal.strat
RU: Стройте любые чипы для уничтожения.
EN: Build any chips to clear.

### key: enemy.fast
RU: ФОРМА-02 «СИГНАЛ»
EN: FORM-02 "SIGNAL"

### key: enemy.fast.desc
RU: Сжатая форма несущей: минимальная контрольная сумма, максимальная скорость передачи.
EN: Compressed carrier form: minimal checksum, maximum transfer rate.

### key: enemy.fast.strat
RU: Используйте скорострельные PULSE или TESLA чипы.
EN: Use fast-firing PULSE or TESLA chips.

### key: enemy.rogue
RU: ФОРМА-03 «ГЛИЧ»
EN: FORM-03 "GLITCH"

### key: enemy.rogue.desc
RU: Форма с нарушенной корректирующей матрицей; траектория не поддаётся прогнозу.
EN: Form with a disrupted error-correction matrix; trajectory unpredictable.

### key: enemy.rogue.strat
RU: Зелёные чипы SLOW стабилизируют его скорость.
EN: Green SLOW chips stabilize its erratic speed.

### key: enemy.tank
RU: ФОРМА-04 «НАКОПИТЕЛЬ»
EN: FORM-04 "ACCUMULATOR"

### key: enemy.tank.desc
RU: Форма максимальной ёмкости с наивысшим порогом целостности данных.
EN: Maximum-capacity form with the highest data-integrity threshold.

### key: enemy.tank.strat
RU: Чипы LASER наносят огромный точечный урон по накопителям.
EN: LASER chips deal high single-target damage to capacitors.

### key: enemy.healer
RU: ФОРМА-05 «РЕГЕНЕРАТОР»
EN: FORM-05 "REGENERATOR"

### key: enemy.healer.desc
RU: Форма-транслятор: рассылает избыточный код для восстановления соседних копий.
EN: Relay form: broadcasts redundant code to restore adjacent copies.

### key: enemy.healer.strat
RU: Используйте чипы LASER, настроив их приоритет на сильных врагов.
EN: Use LASER chips focused on strong targets.

### key: enemy.brute
RU: ФОРМА-06 «ВИРУС»
EN: FORM-06 "VIRUS"

### key: enemy.brute.desc
RU: Форма с усиленной структурой кода и повышенной деструктивной нагрузкой.
EN: Form with a reinforced code structure and elevated destructive payload.

### key: enemy.brute.strat
RU: Комбинируйте замедление SLOW с мощными ударами MISSILE.
EN: Combine SLOW deceleration with heavy MISSILE blasts.

### key: enemy.boss
RU: ФОРМА-07 «НОСИТЕЛЬ»
EN: FORM-07 "CARRIER"

### key: enemy.boss.desc
RU: Управляющая форма сигнала: координирует и переносит остальные копии.
EN: Signal control form: coordinates and carries the remaining copies.

### key: enemy.boss.strat
RU: Стройте улучшенные чипы LASER и MISSILE для максимального урона. Теряя целостность, меняет поведение — будьте готовы.
EN: Deploy upgraded LASER and MISSILE chips for maximum damage. It changes behaviour as it loses integrity — stay ready.

### key: enemy.shielded
RU: ФОРМА-08 «КАПСУЛА»
EN: FORM-08 "CAPSULE"

### key: enemy.shielded.desc
RU: Экранированная капсула: защитная оболочка гасит первые попадания целиком, независимо от их силы.
EN: Shielded capsule: the protective shell absorbs the first hits entirely, whatever their power.

### key: enemy.shielded.strat
RU: Мощный одиночный выстрел пропадает зря. Сбивайте экран скорострельными PULSE и TESLA.
EN: Big single shots are wasted on it. Strip the shield with rapid-fire PULSE and TESLA.

### key: enemy.carrier
RU: ФОРМА-09 «КОНТЕЙНЕР»
EN: FORM-09 "CONTAINER"

### key: enemy.carrier.desc
RU: Транспортная форма: при разрушении высвобождает рой осколков прямо на дорожку.
EN: Transport form: releases a swarm of shards onto the trace when destroyed.

### key: enemy.carrier.strat
RU: Уничтожайте КОНТЕЙНЕРЫ подальше от выхода и держите MISSILE или TESLA для зачистки осколков.
EN: Kill CONTAINERS far from the exit and keep MISSILE or TESLA ready to sweep the shards.

### key: enemy.fragment
RU: ФОРМА-10 «ОСКОЛОК»
EN: FORM-10 "SHARD"

### key: enemy.fragment.desc
RU: Обрывок кода из разрушенного контейнера: слабый, быстрый, многочисленный.
EN: A scrap of code from a destroyed container: weak, fast, numerous.

### key: enemy.fragment.strat
RU: Площадной урон MISSILE и цепи TESLA снимают их пачками.
EN: MISSILE splash and TESLA chains clear them in batches.
