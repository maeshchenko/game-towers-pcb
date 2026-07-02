// src/ui/i18n.ts
export type Lang = 'ru' | 'en'

const TRANSLATIONS = {
  ru: {
    'campaign.title': 'КАМПАНИЯ',
    'campaign.subtitle': 'ВЫБЕРИТЕ ИСПЫТАНИЕ',
    'campaign.difficulty': 'Сложность',
    'campaign.size': 'Размер',
    'campaign.highscore': 'Рекорд: жизней',
    'campaign.locked': 'заблокировано',
    'campaign.reset': 'СБРОСИТЬ ПРОГРЕСС',
    'campaign.reset_confirm': 'Вы уверены, что хотите сбросить весь прогресс кампании?',
    
    'hud.level': 'УРОВЕНЬ',
    'hud.wave': 'ВОЛНА',
    'hud.lives': 'ЖИЗНИ',
    'hud.gold': 'ЭНЕРГИЯ',
    'hud.start_wave': 'СТАРТ ВОЛНЫ',
    'hud.map': 'КАРТА',
    'hud.wave_banner': 'ВОЛНА {n}',
    
    'settings.title': 'НАСТРОЙКИ',
    'settings.music_vol': 'Громкость музыки',
    'settings.sfx_vol': 'Громкость эффектов',
    'settings.auto_wave': 'Автоволна',
    'settings.reduced_fx': 'Сниженные эффекты',
    'settings.lang': 'Язык',
    'settings.close': 'ЗАКРЫТЬ',
    
    'result.victory_title': 'ИСПЫТАНИЕ ЗАВЕРШЕНО',
    'result.victory_subtitle': 'ЦЕПЬ СТАБИЛИЗИРОВАНА',
    'result.defeat_title': 'ЦЕПЬ РАЗОМКНУТА',
    'result.defeat_subtitle': 'КРИТИЧЕСКИЕ ПОВРЕЖДЕНИЯ',
    'result.saved_lives': 'Сохранено жизней',
    'result.lost_lives': 'Критический сбой. Допущено слишком много утечек сигнала.',
    'result.next_level': 'СЛЕД. УРОВЕНЬ',
    'result.retry': 'ПОВТОРИТЬ',
    'result.campaign_map': 'КАРТА КАМПАНИИ',

    'tower.cannon.desc': 'Базовый чип средней дальности. Стабильный импульсный урон.',
    'tower.slow.desc': 'Замедляет сигналы в радиусе действия. Не наносит урона.',
    'tower.sniper.desc': 'Мощный лазер. Огромный урон и радиус с пробитием брони.',
    'tower.mortar.desc': 'Выпускает мощные накопительные заряды, наносящие урон по площади.',
    'tower.tesla.desc': 'Генерирует электрические разряды, перескакивающие между целями.',

    'tutorial.step0': 'Энергетические пакеты пойдут от зеленого входа (START) к красному выходу (FINISH) по дорожкам платы. Ваша задача — защитить финиш!',
    'tutorial.step1': 'Кликните по этой золотой монтажной площадке, чтобы открыть круговое меню постройки чипа, и выберите PULSE ($40).',
    'tutorial.step2': 'Бирюзовые восьмиугольные контакты дают чипам мощный буст (+35% к дальности атаки и урону). Размещайте чипы с умом!',
    'tutorial.step3': 'Теперь запустите волну, нажав "START WAVE"! Уничтожение волн приносит кредиты, утечки стоят жизней. Удачи!',
    'tutorial.next': 'ДАЛЕЕ',

    // FORM-NN nomenclature (story spec: bestiary as "signal form classification").
    'enemy.normal': 'ФОРМА-01 «ПАКЕТ»',
    'enemy.fast': 'ФОРМА-02 «СИГНАЛ»',
    'enemy.rogue': 'ФОРМА-03 «ГЛИЧ»',
    'enemy.tank': 'ФОРМА-04 «НАКОПИТЕЛЬ»',
    'enemy.healer': 'ФОРМА-05 «РЕГЕНЕРАТОР»',
    'enemy.brute': 'ФОРМА-06 «ВИРУС»',
    'enemy.boss': 'ФОРМА-07 «НОСИТЕЛЬ»',
    'enemy.next_wave': 'СЛЕДУЮЩАЯ ВОЛНА:',

    // Editor UI
    'editor.new': 'Новый',
    'editor.generate': 'Авто-генерация',
    'editor.reseed': 'Новый сид',
    'editor.save': 'Сохранить',
    'editor.load': 'Загрузить',
    'editor.load_error': 'Не удалось загрузить уровень: неверный файл',
    'editor.alert': 'Сначала создай или сгенерируй уровень',
    
    'legend.title': 'ЛЕГЕНДА',
    'legend.path': 'ТРАССА ВРАГОВ',
    'legend.build': 'МОНТАЖНАЯ ПЛОЩАДКА',
    'legend.special': 'БУСТ-КОНТАКТ',
    'legend.start': 'ВХОД (СТАРТ)',
    'legend.finish': 'ВЫХОД (ФИНИШ)',
    
    'tips.title': 'ПОДСКАЗКИ',
    'tips.desc1': 'Стройте чипы рядом с трассой.',
    'tips.desc2': 'Размещайте чипы на бирюзовых контактах для буста +35%.',
    'tips.desc3': 'Запускайте волны досрочно для получения бонусной энергии (⚡).',
    'tips.desc4': 'Зелёные чипы SLOW замедляют врагов для сплэш-урона MISSILE.',
    'tips.desc5': 'Синие лазеры пробивают броню Накопителей и Боссов.',

    'mode.play': '▶ Играть',
    'mode.new_map': '🗺 Новая карта',
    'mode.editor': '✎ Редактор',
    'seed.tooltip': 'код трассы — скопируй или открой этот URL, чтобы повторить',

    // Difficulty badges
    'difficulty.easy': 'ЛЕГКО',
    'difficulty.medium': 'СРЕДНЕ',
    'difficulty.hard': 'СЛОЖНО',

    // Level names
    'campaign.level0.name': 'Вводные шины',
    'campaign.level1.name': 'Поворот ключа',
    'campaign.level2.name': 'Двойной контур',
    'campaign.level3.name': 'Шунт питания',
    'campaign.level4.name': 'Спиральный мост',
    'campaign.level5.name': 'Широкая магистраль',
    'campaign.level6.name': 'Сетка контактов',
    'campaign.level7.name': 'Высокое напряжение',
    'campaign.level8.name': 'Делитель частоты',
    'campaign.level9.name': 'Многослойный мост',
    'campaign.level10.name': 'Критический перегруз',
    'campaign.level11.name': 'Финал: Генератор',

    // Bestiary & Intros
    'bestiary.title': 'СПРАВОЧНИК СИГНАЛОВ (БЕСТИАРИЙ)',
    'bestiary.btn': '🔍 БЕСТИАРИЙ',
    'bestiary.locked': '🔒 КОНТАКТ НЕИЗВЕСТЕН',
    'bestiary.strategy': 'Уязвимость',
    'bestiary.close': 'ЗАКРЫТЬ',

    'enemy.intro.title': 'ОБНАРУЖЕН НОВЫЙ СИГНАЛ!',
    'enemy.intro.ok': 'ПОНЯТНО',

    'enemy.normal.desc': 'Минимальная самокопирующаяся единица сигнала.',
    'enemy.normal.strat': 'Стройте любые чипы для уничтожения.',
    'enemy.fast.desc': 'Сжатая форма несущей: минимальная контрольная сумма, максимальная скорость передачи.',
    'enemy.fast.strat': 'Используйте скорострельные PULSE или TESLA чипы.',
    'enemy.healer.desc': 'Форма-транслятор: рассылает избыточный код для восстановления соседних копий.',
    'enemy.healer.strat': 'Используйте чипы LASER, настроив их приоритет на сильных врагов.',
    'enemy.brute.desc': 'Форма с усиленной структурой кода и повышенной деструктивной нагрузкой.',
    'enemy.brute.strat': 'Комбинируйте замедление SLOW с мощными ударами MISSILE.',
    'enemy.tank.desc': 'Форма максимальной ёмкости с наивысшим порогом целостности данных.',
    'enemy.tank.strat': 'Чипы LASER наносят огромный точечный урон по накопителям.',
    'enemy.rogue.desc': 'Форма с нарушенной корректирующей матрицей; траектория не поддаётся прогнозу.',
    'enemy.rogue.strat': 'Зелёные чипы SLOW стабилизируют его скорость.',
    'enemy.boss.desc': 'Управляющая форма сигнала: координирует и переносит остальные копии.',
    'enemy.boss.strat': 'Стройте улучшенные чипы LASER и MISSILE для максимального урона.',

    // Story: "Сигнал извне" — POST-intro, briefings, debriefs, final log.
    // story.blank is a shared pause key for blank separator lines in the spec texts
    // (a single space, rendered as an empty terminal line between paragraphs).
    'story.blank': ' ',
    'story.continue': 'ПРОДОЛЖИТЬ',
    'story.intro.title': 'DSCS VEGA-9 · INBOUND CARRIER',
    'story.brief.title': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ',
    'story.final.title': 'TRANSMISSION BLOCKED',

    // Campaign map: station header (cleanup %) and per-card status badges.
    'story.station.title': 'СТАНЦИЯ «ВЕГА-9» · ОЧИСТКА:',
    'story.status.isolated': 'ИЗОЛИРОВАНО',
    'story.status.infected': 'ЗАРАЖЕНО',
    'story.status.nolink': 'НЕТ СВЯЗИ',
    'story.log.button': 'ЛОГ',

    'story.intro.1': 'DSCS VEGA-9 · POWER-ON SELF TEST………… OK',
    'story.intro.2': 'RECEIVER CHAIN……………………………………… OK',
    'story.intro.3': 'REFERENCE OSCILLATOR………………………… OK',
    'story.intro.4': 'INBOUND CARRIER: DETECTED',
    'story.intro.5': 'ORIGIN: UNRESOLVED',
    'story.intro.6': 'STRUCTURE: PERIODIC. DECODING…',
    'story.intro.7': 'WARNING: PAYLOAD IS EXECUTABLE.',
    'story.intro.8': 'WARNING: PAYLOAD IS RUNNING.',
    'story.intro.9': 'ЖУРНАЛ СМЕНЫ: сигнал воспроизводит себя в приёмном тракте.',
    'story.intro.10': 'Начинаю изоляцию заражённых плат. Связи с внешним миром нет',
    'story.intro.11': 'до окончания работ. Питание ядра отключать нельзя.',

    'story.l01.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 01',
    'story.l01.brief.2': 'Плата входных шин. Первичное заражение.',
    'story.l01.brief.3': 'Сигнал разбит на пакеты, движется к выходному разъёму.',
    'story.l01.brief.4': 'Задача: не выпустить ни одного пакета с платы.',
    'story.l01.brief.5': 'Чипы ставить на монтажные площадки. Питание держит база.',
    'story.l01.debrief': 'INPUT BUSES ISOLATED. STATION CLEANUP: 6%',

    'story.l02.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 02',
    'story.l02.brief.2': 'Ключевой каскад приёмника. Сигнал прошёл дальше, чем ожидалось.',
    'story.l02.brief.3': 'Зафиксированы быстрые формы: сокращённые копии несущей.',
    'story.l02.brief.4': 'Скорость распространения выше расчётной на 12%.',
    'story.l02.brief.5': 'Задача: изоляция каскада.',
    'story.l02.debrief': 'KEY STAGE ISOLATED. STATION CLEANUP: 13%',

    'story.l03.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 03',
    'story.l03.brief.2': 'Двойной контур декодера. Сигнал идёт двумя путями одновременно.',
    'story.l03.brief.3': 'Копии синхронизированы между собой. Механизм синхронизации не ясен.',
    'story.l03.brief.4': 'Приёмный тракт после этой платы — чист.',
    'story.l03.brief.5': 'Задача: закрыть оба пути. Акт изоляции тракта — финальный.',
    'story.l03.debrief': 'RECEIVER CHAIN FULLY ISOLATED. STATION CLEANUP: 20%',

    'story.l04.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 04',
    'story.l04.brief.2': 'Аномалия. Сигнал обнаружен в цепях ПИТАНИЯ.',
    'story.l04.brief.3': 'Он не должен уметь переходить через развязку.',
    'story.l04.brief.4': 'Зафиксированы бронированные формы: несущая с избыточным кодированием.',
    'story.l04.brief.5': 'Задача: изоляция шунта. Пересмотреть схему отступления.',
    'story.l04.debrief': 'SHUNT ISOLATED. BARRIER CROSSING DOCUMENTED. CLEANUP: 28%',

    'story.l05.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 05',
    'story.l05.brief.2': 'Спиральный мост межблочной связи. Здесь сигнал впервые ЖДАЛ.',
    'story.l05.brief.3': 'Формы удерживали позицию до подачи питания на плату.',
    'story.l05.brief.4': 'Отмечены регенерирующие структуры: повреждённые копии',
    'story.l05.brief.5': 'восстанавливаются за счёт соседних.',
    'story.l05.brief.6': 'Задача: изоляция моста. Не оставлять повреждённые формы без контроля.',
    'story.l05.debrief': 'BRIDGE ISOLATED. STATION CLEANUP: 36%',

    'story.l06.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 06',
    'story.l06.brief.2': 'Главная магистраль данных. Плотность форм — максимальная с начала работ.',
    'story.l06.brief.3': 'Наблюдение: последовательность манёвров сигнала повторяет',
    'story.l06.brief.4': 'мою вчерашнюю схему расстановки чипов. Задержка — 3.2 секунды.',
    'story.l06.brief.5': 'Совпадение исключено. Он смотрит.',
    'story.l06.brief.6': 'Задача: изоляция магистрали.',
    'story.l06.debrief': 'HIGHWAY ISOLATED. STATION CLEANUP: 44%',

    'story.l07.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 07',
    'story.l07.brief.2': 'Коммутационная сетка. Сигнал использует обходные маршруты,',
    'story.l07.brief.3': 'которых нет в документации станции.',
    'story.l07.brief.4': 'Вывод: он знает трассировку лучше меня. Источник знания не ясен.',
    'story.l07.brief.5': 'Задача: изоляция сетки. Дальше — силовой отсек.',
    'story.l07.debrief': 'GRID ISOLATED. SOUTH WING CLEAN. STATION CLEANUP: 53%',

    'story.l08.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 08',
    'story.l08.brief.2': 'Силовой отсек. Работы под напряжением.',
    'story.l08.brief.3': 'Сигнал уплотнил формы: меньше копий, больше массы.',
    'story.l08.brief.4': 'Датчики отсека передают шум. Часть записей журнала повреждена.',
    'story.l08.brief.5': 'Задача: изоляция силовой платы. Осторо////////но.',
    'story.l08.debrief': 'POWER BOARD ISOLATED. SENSORS PARTIALLY RESTORED. CLEANUP: 62%',

    'story.l09.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 09',
    'story.l09.brief.2': 'Делитель опорной частоты. Сигнал пытается ПОДСТРОИТЬСЯ',
    'story.l09.brief.3': 'под тактовую сетку станции. Если подстроится — станет неотличим',
    'story.l09.brief.4': 'от штатного трафика.',
    'story.l09.brief.5': 'Задача: изоляция делителя до завершения подстройки.',
    'story.l09.brief.6': 'Осталось два уровня защиты до генератора.',
    'story.l09.debrief': 'DIVIDER ISOLATED. SYNC ATTEMPT DISRUPTED. STATION CLEANUP: 71%',

    'story.l10.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 10',
    'story.l10.brief.2': 'Многослойный мост ядра. Сигнал идёт по внутренним слоям платы —',
    'story.l10.brief.3': 'там, куда нельзя поставить чип.',
    'story.l10.brief.4': 'Формы выходят на поверхность только на переходных отверстиях.',
    'story.l10.brief.5': 'Задача: изоляция моста. Бить по точкам выхода.',
    'story.l10.debrief': 'CORE BRIDGE ISOLATED. STATION CLEANUP: 80%',

    'story.l11.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 11',
    'story.l11.brief.2': 'Предъядерный контур. Сигнал бросил на прорыв все накопленные формы.',
    'story.l11.brief.3': 'Три волны идут с трёх направлений одновременно.',
    'story.l11.brief.4': 'Журнал вести некогда. Если запись обрывается —',
    'story.l11.brief.5': 'генератор защищать по схеме 12.',
    'story.l11.brief.6': 'Задача: удержать контур.',
    'story.l11.debrief': 'CIRCUIT HELD. BREACH REPELLED. STATION CLEANUP: 90%',

    'story.l12.brief.1': 'ЖУРНАЛ СМЕНЫ · ЗАПИСЬ 12',
    'story.l12.brief.2': 'Генератор опорной частоты. Последняя плата.',
    'story.l12.brief.3': 'Сигнал понял, что проиграл станцию. Теперь ему нужен передатчик:',
    'story.l12.brief.4': 'одна секунда на несущей — и он уйдёт в эфир. Дальше — везде.',
    'story.l12.brief.5': 'Задача: не дать сигналу коснуться генератора.',
    'story.l12.brief.6': 'Другой записи не будет.',
    // L12's debrief is data-complete for consistency, though the UI shows the
    // full-screen final log instead of the usual debrief line on this level.
    'story.l12.debrief': 'GENERATOR CLEAN. TRANSMISSION BLOCKED. STATION CLEANUP: 100%',

    'story.final.1': 'GENERATOR CLEAN.',
    'story.final.2': 'TRANSMISSION BLOCKED.',
    'story.final.3': 'STATION CLEANUP: 100%',
    'story.final.4': 'POWER-ON SELF TEST………… OK',
    'story.final.5': 'RECEIVER CHAIN…………………… OK',
    'story.final.6': 'REFERENCE OSCILLATOR…………… OK',
    'story.final.7': 'ЖУРНАЛ СМЕНЫ · ПОСЛЕДНЯЯ ЗАПИСЬ',
    'story.final.8': 'Станция чиста. Все платы изолированы, трафик штатный.',
    'story.final.9': 'Работы завершены.',
    'story.final.10': '…',
    'story.final.11': 'INBOUND CARRIER: ACTIVE',
    'story.final.12': 'ORIGIN: UNRESOLVED',
    'story.final.13': 'SIGNAL REPEATS',
    'story.final.14': 'SIGNAL REPEATS',
    'story.final.15': 'SIGNAL REPEA//////////',
    'story.final.16': 'RECEIVER MANUALLY DISCONNECTED.',
    'story.final.17': 'END OF LOG.',
  },
  en: {
    'campaign.title': 'CAMPAIGN',
    'campaign.subtitle': 'SELECT TEST',
    'campaign.difficulty': 'Difficulty',
    'campaign.size': 'Size',
    'campaign.highscore': 'Record: lives',
    'campaign.locked': 'locked',
    'campaign.reset': 'RESET PROGRESS',
    'campaign.reset_confirm': 'Are you sure you want to reset all campaign progress?',
    
    'hud.level': 'LEVEL',
    'hud.wave': 'WAVE',
    'hud.lives': 'LIVES',
    'hud.gold': 'ENERGY',
    'hud.start_wave': 'START WAVE',
    'hud.map': 'MAP',
    'hud.wave_banner': 'WAVE {n}',
    
    'settings.title': 'SETTINGS',
    'settings.music_vol': 'Music Volume',
    'settings.sfx_vol': 'SFX Volume',
    'settings.auto_wave': 'Auto-wave',
    'settings.reduced_fx': 'Reduced effects',
    'settings.lang': 'Language',
    'settings.close': 'CLOSE',
    
    'result.victory_title': 'TEST COMPLETED',
    'result.victory_subtitle': 'CIRCUIT STABILIZED',
    'result.defeat_title': 'CIRCUIT BROKEN',
    'result.defeat_subtitle': 'CRITICAL DAMAGE',
    'result.saved_lives': 'Saved lives',
    'result.lost_lives': 'All base lives were lost.',
    'result.next_level': 'NEXT LEVEL',
    'result.retry': 'RETRY',
    'result.campaign_map': 'CAMPAIGN MAP',

    'tower.cannon.desc': 'Basic medium-range chip. Stable pulse damage.',
    'tower.slow.desc': 'Slows signals in range. Deals no damage.',
    'tower.sniper.desc': 'Powerful laser. Huge damage and range with armor penetration.',
    'tower.mortar.desc': 'Fires high-capacity discharge pulses dealing area damage.',
    'tower.tesla.desc': 'Generates electrical discharges jumping between targets.',

    'tutorial.step0': 'Energy packets will flow from the green input (START) to the red output (FINISH) along the board traces. Your goal is to protect the finish!',
    'tutorial.step1': 'Click this gold mounting pad to open the circular chip build menu, and select PULSE ($40).',
    'tutorial.step2': 'Cyan octagonal pads give chips a powerful boost (+35% range and damage). Position your chips wisely!',
    'tutorial.step3': 'Now start the wave by clicking "START WAVE"! Clearing waves grants credits, leaks cost lives. Good luck!',
    'tutorial.next': 'NEXT',

    // FORM-NN nomenclature (story spec: bestiary as "signal form classification").
    'enemy.normal': 'FORM-01 "PACKET"',
    'enemy.fast': 'FORM-02 "SIGNAL"',
    'enemy.rogue': 'FORM-03 "GLITCH"',
    'enemy.tank': 'FORM-04 "ACCUMULATOR"',
    'enemy.healer': 'FORM-05 "REGENERATOR"',
    'enemy.brute': 'FORM-06 "VIRUS"',
    'enemy.boss': 'FORM-07 "CARRIER"',
    'enemy.next_wave': 'NEXT WAVE:',

    // Editor UI
    'editor.new': 'New',
    'editor.generate': 'Auto-Generate',
    'editor.reseed': 'Reseed',
    'editor.save': 'Save',
    'editor.load': 'Load',
    'editor.load_error': 'Failed to load level: invalid file',
    'editor.alert': 'Create or generate a level first',
    
    'legend.title': 'LEGEND',
    'legend.path': 'ENEMY PATH',
    'legend.build': 'MOUNTING PAD',
    'legend.special': 'BOOST PAD',
    'legend.start': 'START',
    'legend.finish': 'FINISH',
    
    'tips.title': 'TIPS',
    'tips.desc1': 'Build chips close to the board traces.',
    'tips.desc2': 'Place chips on cyan pads for a +35% boost.',
    'tips.desc3': 'Start waves early to earn bonus energy (⚡).',
    'tips.desc4': 'Green SLOW chips delay enemies for MISSILE splash.',
    'tips.desc5': 'Blue LASER chips penetrate armor of Capacitors & Bosses.',

    'mode.play': '▶ Play',
    'mode.new_map': '🗺 New Map',
    'mode.editor': '✎ Editor',
    'seed.tooltip': 'track code — copy or open this URL to reproduce',

    // Difficulty badges
    'difficulty.easy': 'EASY',
    'difficulty.medium': 'MEDIUM',
    'difficulty.hard': 'HARD',

    // Level names
    'campaign.level0.name': 'Input Buses',
    'campaign.level1.name': 'Key Turn',
    'campaign.level2.name': 'Dual Circuit',
    'campaign.level3.name': 'Power Shunt',
    'campaign.level4.name': 'Spiral Bridge',
    'campaign.level5.name': 'Wide Highway',
    'campaign.level6.name': 'Pin Grid',
    'campaign.level7.name': 'High Voltage',
    'campaign.level8.name': 'Frequency Divider',
    'campaign.level9.name': 'Multi-Layer Bridge',
    'campaign.level10.name': 'Critical Overload',
    'campaign.level11.name': 'Final: Generator',

    // Bestiary & Intros
    'bestiary.title': 'SIGNAL REFERENCE (BESTIARY)',
    'bestiary.btn': '🔍 BESTIARY',
    'bestiary.locked': '🔒 SIGNAL UNKNOWN',
    'bestiary.strategy': 'Weakness',
    'bestiary.close': 'CLOSE',

    'enemy.intro.title': 'NEW SIGNAL DETECTED!',
    'enemy.intro.ok': 'UNDERSTOOD',

    'enemy.normal.desc': 'Minimal self-replicating unit of the signal.',
    'enemy.normal.strat': 'Build any chips to clear.',
    'enemy.fast.desc': 'Compressed carrier form: minimal checksum, maximum transfer rate.',
    'enemy.fast.strat': 'Use fast-firing PULSE or TESLA chips.',
    'enemy.healer.desc': 'Relay form: broadcasts redundant code to restore adjacent copies.',
    'enemy.healer.strat': 'Use LASER chips focused on strong targets.',
    'enemy.brute.desc': 'Form with a reinforced code structure and elevated destructive payload.',
    'enemy.brute.strat': 'Combine SLOW deceleration with heavy MISSILE blasts.',
    'enemy.tank.desc': 'Maximum-capacity form with the highest data-integrity threshold.',
    'enemy.tank.strat': 'LASER chips deal high single-target damage to capacitors.',
    'enemy.rogue.desc': 'Form with a disrupted error-correction matrix; trajectory unpredictable.',
    'enemy.rogue.strat': 'Green SLOW chips stabilize its erratic speed.',
    'enemy.boss.desc': 'Signal control form: coordinates and carries the remaining copies.',
    'enemy.boss.strat': 'Deploy upgraded LASER and MISSILE chips for maximum damage.',

    // Story: "Signal From Beyond" — POST-intro, briefings, debriefs, final log.
    // story.blank is a shared pause key for blank separator lines in the spec texts
    // (a single space, rendered as an empty terminal line between paragraphs).
    'story.blank': ' ',
    'story.continue': 'CONTINUE',
    'story.intro.title': 'DSCS VEGA-9 · INBOUND CARRIER',
    'story.brief.title': 'SHIFT LOG · ENTRY',
    'story.final.title': 'TRANSMISSION BLOCKED',

    // Campaign map: station header (cleanup %) and per-card status badges.
    'story.station.title': 'STATION VEGA-9 · CLEANUP:',
    'story.status.isolated': 'ISOLATED',
    'story.status.infected': 'INFECTED',
    'story.status.nolink': 'NO LINK',
    'story.log.button': 'LOG',

    'story.intro.1': 'DSCS VEGA-9 · POWER-ON SELF TEST………… OK',
    'story.intro.2': 'RECEIVER CHAIN……………………………………… OK',
    'story.intro.3': 'REFERENCE OSCILLATOR………………………… OK',
    'story.intro.4': 'INBOUND CARRIER: DETECTED',
    'story.intro.5': 'ORIGIN: UNRESOLVED',
    'story.intro.6': 'STRUCTURE: PERIODIC. DECODING…',
    'story.intro.7': 'WARNING: PAYLOAD IS EXECUTABLE.',
    'story.intro.8': 'WARNING: PAYLOAD IS RUNNING.',
    'story.intro.9': 'SHIFT LOG: the signal is replicating inside the receiver chain.',
    'story.intro.10': 'Beginning isolation of infected boards. No outside contact',
    'story.intro.11': 'until work is complete. Core power must stay on.',

    'story.l01.brief.1': 'SHIFT LOG · ENTRY 01',
    'story.l01.brief.2': 'Input bus board. Primary infection.',
    'story.l01.brief.3': 'Signal split into packets, moving toward the output connector.',
    'story.l01.brief.4': 'Task: let no packet leave the board.',
    'story.l01.brief.5': 'Mount chips on build pads. Base holds power.',
    'story.l01.debrief': 'INPUT BUSES ISOLATED. STATION CLEANUP: 6%',

    'story.l02.brief.1': 'SHIFT LOG · ENTRY 02',
    'story.l02.brief.2': 'Receiver key stage. Signal advanced further than expected.',
    'story.l02.brief.3': 'Fast forms recorded: shortened copies of the carrier.',
    'story.l02.brief.4': 'Propagation speed 12% above calculated.',
    'story.l02.brief.5': 'Task: isolate the stage.',
    'story.l02.debrief': 'KEY STAGE ISOLATED. STATION CLEANUP: 13%',

    'story.l03.brief.1': 'SHIFT LOG · ENTRY 03',
    'story.l03.brief.2': 'Decoder dual circuit. Signal travels two paths at once.',
    'story.l03.brief.3': 'Copies are synchronized with each other. Sync mechanism unclear.',
    'story.l03.brief.4': 'Receiver chain past this board is clean.',
    'story.l03.brief.5': 'Task: close both paths. Final act of chain isolation.',
    'story.l03.debrief': 'RECEIVER CHAIN FULLY ISOLATED. STATION CLEANUP: 20%',

    'story.l04.brief.1': 'SHIFT LOG · ENTRY 04',
    'story.l04.brief.2': 'Anomaly. Signal detected in the POWER lines.',
    'story.l04.brief.3': 'It should not be able to cross the isolation barrier.',
    'story.l04.brief.4': 'Armored forms recorded: carrier with redundant encoding.',
    'story.l04.brief.5': 'Task: isolate the shunt. Revise the fallback plan.',
    'story.l04.debrief': 'SHUNT ISOLATED. BARRIER CROSSING DOCUMENTED. CLEANUP: 28%',

    'story.l05.brief.1': 'SHIFT LOG · ENTRY 05',
    'story.l05.brief.2': 'Inter-block spiral bridge. Here the signal WAITED for the first time.',
    'story.l05.brief.3': 'Forms held position until the board was powered.',
    'story.l05.brief.4': 'Regenerating structures noted: damaged copies',
    'story.l05.brief.5': 'restore themselves using neighboring ones.',
    'story.l05.brief.6': 'Task: isolate the bridge. Do not leave damaged forms unattended.',
    'story.l05.debrief': 'BRIDGE ISOLATED. STATION CLEANUP: 36%',

    'story.l06.brief.1': 'SHIFT LOG · ENTRY 06',
    'story.l06.brief.2': 'Main data highway. Form density — highest since work began.',
    'story.l06.brief.3': "Observation: the signal's maneuver sequence repeats",
    'story.l06.brief.4': 'my chip placement pattern from yesterday. Delay — 3.2 seconds.',
    'story.l06.brief.5': 'Coincidence ruled out. It is watching.',
    'story.l06.brief.6': 'Task: isolate the highway.',
    'story.l06.debrief': 'HIGHWAY ISOLATED. STATION CLEANUP: 44%',

    'story.l07.brief.1': 'SHIFT LOG · ENTRY 07',
    'story.l07.brief.2': 'Switching grid. Signal is using bypass routes',
    'story.l07.brief.3': 'not present in station documentation.',
    'story.l07.brief.4': 'Conclusion: it knows the routing better than I do. Source of knowledge unclear.',
    'story.l07.brief.5': 'Task: isolate the grid. Power bay next.',
    'story.l07.debrief': 'GRID ISOLATED. SOUTH WING CLEAN. STATION CLEANUP: 53%',

    'story.l08.brief.1': 'SHIFT LOG · ENTRY 08',
    'story.l08.brief.2': 'Power bay. Working live.',
    'story.l08.brief.3': 'Signal has compacted its forms: fewer copies, more mass.',
    'story.l08.brief.4': 'Bay sensors report noise. Part of the log is corrupted.',
    'story.l08.brief.5': 'Task: isolate the power board. Caut////////ion.',
    'story.l08.debrief': 'POWER BOARD ISOLATED. SENSORS PARTIALLY RESTORED. CLEANUP: 62%',

    'story.l09.brief.1': 'SHIFT LOG · ENTRY 09',
    'story.l09.brief.2': 'Reference frequency divider. Signal is trying to SYNC',
    'story.l09.brief.3': "to the station's clock grid. If it syncs, it becomes indistinguishable",
    'story.l09.brief.4': 'from normal traffic.',
    'story.l09.brief.5': 'Task: isolate the divider before sync completes.',
    'story.l09.brief.6': 'Two defense layers remain before the generator.',
    'story.l09.debrief': 'DIVIDER ISOLATED. SYNC ATTEMPT DISRUPTED. STATION CLEANUP: 71%',

    'story.l10.brief.1': 'SHIFT LOG · ENTRY 10',
    'story.l10.brief.2': "Core multi-layer bridge. Signal travels the board's inner layers —",
    'story.l10.brief.3': 'where no chip can be placed.',
    'story.l10.brief.4': 'Forms surface only at the vias.',
    'story.l10.brief.5': 'Task: isolate the bridge. Strike the exit points.',
    'story.l10.debrief': 'CORE BRIDGE ISOLATED. STATION CLEANUP: 80%',

    'story.l11.brief.1': 'SHIFT LOG · ENTRY 11',
    'story.l11.brief.2': 'Pre-core circuit. Signal has thrown every accumulated form at the breach.',
    'story.l11.brief.3': 'Three waves come from three directions at once.',
    'story.l11.brief.4': 'No time to keep the log. If this entry cuts off —',
    'story.l11.brief.5': 'defend the generator per scheme 12.',
    'story.l11.brief.6': 'Task: hold the circuit.',
    'story.l11.debrief': 'CIRCUIT HELD. BREACH REPELLED. STATION CLEANUP: 90%',

    'story.l12.brief.1': 'SHIFT LOG · ENTRY 12',
    'story.l12.brief.2': 'Reference oscillator. Final board.',
    'story.l12.brief.3': 'The signal knows it has lost the station. Now it needs a transmitter:',
    'story.l12.brief.4': 'one second on the carrier — and it goes out over the air. After that — everywhere.',
    'story.l12.brief.5': 'Task: do not let the signal touch the generator.',
    'story.l12.brief.6': 'There will be no other entry.',
    // L12's debrief is data-complete for consistency, though the UI shows the
    // full-screen final log instead of the usual debrief line on this level.
    'story.l12.debrief': 'GENERATOR CLEAN. TRANSMISSION BLOCKED. STATION CLEANUP: 100%',

    'story.final.1': 'GENERATOR CLEAN.',
    'story.final.2': 'TRANSMISSION BLOCKED.',
    'story.final.3': 'STATION CLEANUP: 100%',
    'story.final.4': 'POWER-ON SELF TEST………… OK',
    'story.final.5': 'RECEIVER CHAIN…………………… OK',
    'story.final.6': 'REFERENCE OSCILLATOR…………… OK',
    'story.final.7': 'SHIFT LOG · FINAL ENTRY',
    'story.final.8': 'Station is clean. All boards isolated, traffic nominal.',
    'story.final.9': 'Work complete.',
    'story.final.10': '…',
    'story.final.11': 'INBOUND CARRIER: ACTIVE',
    'story.final.12': 'ORIGIN: UNRESOLVED',
    'story.final.13': 'SIGNAL REPEATS',
    'story.final.14': 'SIGNAL REPEATS',
    'story.final.15': 'SIGNAL REPEA//////////',
    'story.final.16': 'RECEIVER MANUALLY DISCONNECTED.',
    'story.final.17': 'END OF LOG.',
  }
}

// Checks whether a (possibly dynamic, e.g. story.*) key exists in a given
// language's dictionary. Used by data-driven content (campaignStory) to
// verify its i18n keys resolve in both languages without importing TRANSLATIONS.
export function hasKey(lang: Lang, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(TRANSLATIONS[lang], key)
}

const LANG_KEY = 'pcb_td_lang_v1'

export class I18nManager {
  private currentLang: Lang = 'ru'

  constructor() {
    this.loadLang()
  }

  get lang(): Lang {
    return this.currentLang
  }

  set lang(l: Lang) {
    this.currentLang = l
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(LANG_KEY, l)
    }
  }

  loadLang(): void {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      const saved = window.localStorage.getItem(LANG_KEY) as Lang
      if (saved === 'ru' || saved === 'en') {
        this.currentLang = saved
        return
      }
    }
    this.currentLang = 'ru' // default to Russian
  }

  t(key: keyof typeof TRANSLATIONS.ru): string {
    const dict = TRANSLATIONS[this.currentLang] || TRANSLATIONS.ru
    return dict[key] || TRANSLATIONS.ru[key] || String(key)
  }
}

export const i18n = new I18nManager()
