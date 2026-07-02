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

    'enemy.normal': 'ПАКЕТ',
    'enemy.fast': 'СИГНАЛ',
    'enemy.healer': 'РЕГЕНЕРАТОР',
    'enemy.brute': 'ВИРУС',
    'enemy.tank': 'НАКОПИТЕЛЬ',
    'enemy.rogue': 'ГЛИЧ',
    'enemy.boss': 'БОСС',
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

    'enemy.normal.desc': 'Базовый пакет данных. Двигается со средней скоростью, уязвим для любых чипов.',
    'enemy.normal.strat': 'Стройте любые чипы для уничтожения.',
    'enemy.fast.desc': 'Быстрый сигнал. Низкий уровень прочности, но может проскочить мимо медленных чипов.',
    'enemy.fast.strat': 'Используйте скорострельные PULSE или TESLA чипы.',
    'enemy.healer.desc': 'Восстанавливает здоровье окружающих сигналов. Приоритетная цель.',
    'enemy.healer.strat': 'Используйте чипы LASER, настроив их приоритет на сильных врагов.',
    'enemy.brute.desc': 'Опасный вирус. Обладает повышенной прочностью и средним весом.',
    'enemy.brute.strat': 'Комбинируйте замедление SLOW с мощными ударами MISSILE.',
    'enemy.tank.desc': 'Тяжелый накопитель заряда. Огромный запас прочности, но движется медленно.',
    'enemy.tank.strat': 'Чипы LASER наносят огромный точечный урон по накопителям.',
    'enemy.rogue.desc': 'Искаженный глич-сигнал. Двигается рывками и непредсказуемо.',
    'enemy.rogue.strat': 'Зелёные чипы SLOW стабилизируют его скорость.',
    'enemy.boss.desc': 'Главный перегрузочный узел. Иммунен к замедлению чипов SLOW.',
    'enemy.boss.strat': 'Стройте улучшенные чипы LASER и MISSILE для максимального урона.',
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

    'enemy.normal': 'PACKET',
    'enemy.fast': 'SIGNAL',
    'enemy.healer': 'REGENERATOR',
    'enemy.brute': 'VIRUS',
    'enemy.tank': 'CAPACITOR',
    'enemy.rogue': 'GLITCH',
    'enemy.boss': 'BOSS',
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

    'enemy.normal.desc': 'Basic data packet. Moves at average speed, vulnerable to all chips.',
    'enemy.normal.strat': 'Build any chips to clear.',
    'enemy.fast.desc': 'Fast signal. Low integrity, but can slip past slow-firing chips.',
    'enemy.fast.strat': 'Use fast-firing PULSE or TESLA chips.',
    'enemy.healer.desc': 'Heals nearby signals. High priority target.',
    'enemy.healer.strat': 'Use LASER chips focused on strong targets.',
    'enemy.brute.desc': 'Dangerous virus. Has increased integrity and average weight.',
    'enemy.brute.strat': 'Combine SLOW deceleration with heavy MISSILE blasts.',
    'enemy.tank.desc': 'Heavy charge capacitor. High integrity, but moves slowly.',
    'enemy.tank.strat': 'LASER chips deal high single-target damage to capacitors.',
    'enemy.rogue.desc': 'Corrupted glitch. Moves erratically and in bursts.',
    'enemy.rogue.strat': 'Green SLOW chips stabilize its erratic speed.',
    'enemy.boss.desc': 'Main overload hub. Immune to SLOW deceleration effects.',
    'enemy.boss.strat': 'Deploy upgraded LASER and MISSILE chips for maximum damage.',
  }
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
