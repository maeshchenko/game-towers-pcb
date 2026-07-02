// Campaign story data for "Signal From Beyond" ("Сигнал извне").
// Framework-free: no pixi/dom/i18n imports. Holds i18n *keys* only — the
// UI layer resolves them to localized strings at render time (src/ui/i18n.ts).

/**
 * A single line of story text, rendered in the terminal-log overlay.
 * `key` resolves via i18n. `glitch` marks lines to be rendered with the
 * corrupted-text effect (Act III degradation, see spec). `pauseMs` optionally
 * overrides the default inter-line pause for this line.
 *
 * Blank separator lines from the spec's canonical text blocks are represented
 * by the shared `story.blank` key (i18n value: a single space ' ') rather than
 * a one-off key per blank line, since they carry no unique content.
 */
export interface StoryLine {
  key: string
  glitch?: boolean
  pauseMs?: number
}

/** Per-level story: pre-level briefing, post-level debrief, and cleanup contribution. */
export interface LevelStory {
  brief: StoryLine[]
  debriefKey: string
  cleanupPct: number
}

const BLANK: StoryLine = { key: 'story.blank' }

export const CAMPAIGN_STORY: {
  intro: StoryLine[]
  final: StoryLine[]
  levels: LevelStory[]
} = {
  // POST-intro: terminal overlay shown before the first campaign level
  // (and via the "LOG" button on the title screen).
  intro: [
    { key: 'story.intro.1' },
    { key: 'story.intro.2' },
    { key: 'story.intro.3' },
    { key: 'story.intro.4' },
    { key: 'story.intro.5' },
    { key: 'story.intro.6' },
    BLANK,
    { key: 'story.intro.7' },
    { key: 'story.intro.8' },
    BLANK,
    { key: 'story.intro.9' },
    { key: 'story.intro.10' },
    { key: 'story.intro.11' },
  ],

  // Final log: shown full-screen instead of the usual debrief after
  // victory on level 12. The "SIGNAL REPEATS..." lines glitch (twist reveal).
  final: [
    { key: 'story.final.1' },
    { key: 'story.final.2' },
    { key: 'story.final.3' },
    BLANK,
    { key: 'story.final.4' },
    { key: 'story.final.5' },
    { key: 'story.final.6' },
    BLANK,
    { key: 'story.final.7' },
    { key: 'story.final.8' },
    { key: 'story.final.9' },
    BLANK,
    { key: 'story.final.10' },
    BLANK,
    { key: 'story.final.11' },
    { key: 'story.final.12' },
    { key: 'story.final.13', glitch: true },
    { key: 'story.final.14', glitch: true },
    { key: 'story.final.15', glitch: true },
    BLANK,
    { key: 'story.final.16' },
    { key: 'story.final.17' },
  ],

  // cleanupPct per level: 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10 (sums to 100).
  levels: [
    // L1 "Вводные шины" — Act I
    {
      brief: [
        { key: 'story.l01.brief.1' },
        { key: 'story.l01.brief.2' },
        { key: 'story.l01.brief.3' },
        { key: 'story.l01.brief.4' },
        { key: 'story.l01.brief.5' },
      ],
      debriefKey: 'story.l01.debrief',
      cleanupPct: 6,
    },
    // L2 "Поворот ключа" — Act I
    {
      brief: [
        { key: 'story.l02.brief.1' },
        { key: 'story.l02.brief.2' },
        { key: 'story.l02.brief.3' },
        { key: 'story.l02.brief.4' },
        { key: 'story.l02.brief.5' },
      ],
      debriefKey: 'story.l02.debrief',
      cleanupPct: 7,
    },
    // L3 "Двойной контур" — Act I, receiver chain fully isolated
    {
      brief: [
        { key: 'story.l03.brief.1' },
        { key: 'story.l03.brief.2' },
        { key: 'story.l03.brief.3' },
        { key: 'story.l03.brief.4' },
        { key: 'story.l03.brief.5' },
      ],
      debriefKey: 'story.l03.debrief',
      cleanupPct: 7,
    },
    // L4 "Шунт питания" — Act II begins, anomaly in power lines
    {
      brief: [
        { key: 'story.l04.brief.1' },
        { key: 'story.l04.brief.2' },
        { key: 'story.l04.brief.3' },
        { key: 'story.l04.brief.4' },
        { key: 'story.l04.brief.5' },
      ],
      debriefKey: 'story.l04.debrief',
      cleanupPct: 8,
    },
    // L5 "Спиральный мост" — Act II
    {
      brief: [
        { key: 'story.l05.brief.1' },
        { key: 'story.l05.brief.2' },
        { key: 'story.l05.brief.3' },
        { key: 'story.l05.brief.4' },
        { key: 'story.l05.brief.5' },
        { key: 'story.l05.brief.6' },
      ],
      debriefKey: 'story.l05.debrief',
      cleanupPct: 8,
    },
    // L6 "Широкая магистраль" — Act II, "It is watching."
    {
      brief: [
        { key: 'story.l06.brief.1' },
        { key: 'story.l06.brief.2' },
        { key: 'story.l06.brief.3' },
        { key: 'story.l06.brief.4' },
        { key: 'story.l06.brief.5' },
        { key: 'story.l06.brief.6' },
      ],
      debriefKey: 'story.l06.debrief',
      cleanupPct: 8,
    },
    // L7 "Сетка контактов" — Act II ends
    {
      brief: [
        { key: 'story.l07.brief.1' },
        { key: 'story.l07.brief.2' },
        { key: 'story.l07.brief.3' },
        { key: 'story.l07.brief.4' },
        { key: 'story.l07.brief.5' },
      ],
      debriefKey: 'story.l07.debrief',
      cleanupPct: 9,
    },
    // L8 "Высокое напряжение" — Act III begins, canonical glitch in the text itself
    {
      brief: [
        { key: 'story.l08.brief.1' },
        { key: 'story.l08.brief.2' },
        { key: 'story.l08.brief.3' },
        { key: 'story.l08.brief.4' },
        { key: 'story.l08.brief.5', glitch: true },
      ],
      debriefKey: 'story.l08.debrief',
      cleanupPct: 9,
    },
    // L9 "Делитель частоты" — Act III
    {
      brief: [
        { key: 'story.l09.brief.1' },
        { key: 'story.l09.brief.2', glitch: true },
        { key: 'story.l09.brief.3' },
        { key: 'story.l09.brief.4' },
        { key: 'story.l09.brief.5' },
        { key: 'story.l09.brief.6' },
      ],
      debriefKey: 'story.l09.debrief',
      cleanupPct: 9,
    },
    // L10 "Многослойный мост" — Act III
    {
      brief: [
        { key: 'story.l10.brief.1' },
        { key: 'story.l10.brief.2' },
        { key: 'story.l10.brief.3', glitch: true },
        { key: 'story.l10.brief.4' },
        { key: 'story.l10.brief.5' },
      ],
      debriefKey: 'story.l10.debrief',
      cleanupPct: 9,
    },
    // L11 "Критический перегруз" — Act III ends, log cuts off mid-entry
    {
      brief: [
        { key: 'story.l11.brief.1' },
        { key: 'story.l11.brief.2' },
        { key: 'story.l11.brief.3' },
        { key: 'story.l11.brief.4', glitch: true },
        { key: 'story.l11.brief.5', glitch: true },
        { key: 'story.l11.brief.6' },
      ],
      debriefKey: 'story.l11.debrief',
      cleanupPct: 10,
    },
    // L12 "Финал: Генератор" — the finale; the debrief key is data-complete but
    // the UI shows the full-screen final log instead of this debrief on victory.
    {
      brief: [
        { key: 'story.l12.brief.1' },
        { key: 'story.l12.brief.2' },
        { key: 'story.l12.brief.3' },
        { key: 'story.l12.brief.4' },
        { key: 'story.l12.brief.5' },
        { key: 'story.l12.brief.6' },
      ],
      debriefKey: 'story.l12.debrief',
      cleanupPct: 10,
    },
  ],
}

/** Sum of cleanupPct for the first `completedLevels` levels (0 if none completed). */
export function cleanupPercent(completedLevels: number): number {
  return CAMPAIGN_STORY.levels
    .slice(0, Math.max(0, completedLevels))
    .reduce((sum, l) => sum + l.cleanupPct, 0)
}
