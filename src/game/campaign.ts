// src/game/campaign.ts
import { startLives } from './difficulty'
import type { Board, Level } from '../model/level'
import { AUTHORED_LEVELS } from '../levels'
import { storageGet, storageSet } from '../util/safeStorage'
import { buyTier, starsEarned, starsSpent, type MetaLevels, type MetaUpgradeId } from './metaUpgrades'

export interface CampaignLevelDef {
  name: string
  nameKey: string
  cols: number
  rows: number
  difficulty: number
  seed: number
  /** Hand-authored builder; when present the campaign loads this Level instead of generating. */
  build?: (board: Board) => Level
}

export interface PlayerProgress {
  unlockedLevelIndex: number
  stars: Record<number, number>      // levelIndex -> star count (1-3)
  highscores: Record<number, number>  // levelIndex -> highscore (remaining lives)
  tutorialCompleted?: boolean
  seenIntroductions?: Record<string, boolean>
  /** POST-intro terminal log shown before the first campaign level (index 0). */
  storyIntroSeen?: boolean
  /** Per-level pre-level briefing, keyed by campaign level index. */
  storyBriefSeen?: Record<number, boolean>
  /** Station meta-upgrades bought with stars (v3+). Sparse track → tier map. */
  metaUpgrades?: MetaLevels
  /** Achievement ids already earned (v3+). */
  achievements?: string[]
}

export const CAMPAIGN_LEVELS: CampaignLevelDef[] = [
  { name: 'Вводные шины', nameKey: 'campaign.level0.name', cols: 24, rows: 18, difficulty: 1, seed: 12048 },
  { name: 'Поворот ключа', nameKey: 'campaign.level1.name', cols: 24, rows: 18, difficulty: 2, seed: 93849 },
  { name: 'Двойной контур', nameKey: 'campaign.level2.name', cols: 32, rows: 24, difficulty: 3, seed: 57201 },
  { name: 'Шунт питания', nameKey: 'campaign.level3.name', cols: 32, rows: 24, difficulty: 4, seed: 10482 },
  { name: 'Спиральный мост', nameKey: 'campaign.level4.name', cols: 32, rows: 24, difficulty: 5, seed: 83012 },
  { name: 'Широкая магистраль', nameKey: 'campaign.level5.name', cols: 44, rows: 33, difficulty: 5, seed: 38402 },
  { name: 'Сетка контактов', nameKey: 'campaign.level6.name', cols: 44, rows: 33, difficulty: 6, seed: 74901 },
  { name: 'Высокое напряжение', nameKey: 'campaign.level7.name', cols: 44, rows: 33, difficulty: 7, seed: 90283 },
  { name: 'Частотный разделитель', nameKey: 'campaign.level8.name', cols: 60, rows: 45, difficulty: 7, seed: 48901 },
  { name: 'Многослойный мост', nameKey: 'campaign.level9.name', cols: 60, rows: 45, difficulty: 8, seed: 82903 },
  { name: 'Критический перегруз', nameKey: 'campaign.level10.name', cols: 60, rows: 45, difficulty: 8, seed: 19203 },
  { name: 'Финал: Генератор', nameKey: 'campaign.level11.name', cols: 60, rows: 45, difficulty: 9, seed: 99999 },
]

// Attach hand-authored builders by index (levels filled in one by one); others stay generator-backed.
AUTHORED_LEVELS.forEach((fn, i) => { if (CAMPAIGN_LEVELS[i]) CAMPAIGN_LEVELS[i].build = fn })

const SAVE_KEY = 'pcb_td_campaign_progress_v1'

/** Version stamped INSIDE the JSON. Bump on any structural change and extend migrateSave() —
 * pre-versioned saves (no `v` field) are treated as v1 and migrated forward, so players never
 * lose progress across updates. */
export const SAVE_VERSION = 3

/** Normalize/upgrade a parsed save of any known version to the current PlayerProgress shape.
 * Returns null for garbage (wrong types, not an object) — caller falls back to a fresh save. */
export function migrateSave(parsed: unknown): PlayerProgress | null {
  if (!parsed || typeof parsed !== 'object') return null
  const raw = parsed as Record<string, unknown>
  if (typeof raw.unlockedLevelIndex !== 'number') return null
  // v1 (unstamped) → v2: identical fields, just adds the explicit `v` stamp on next save.
  // v2 → v3: adds metaUpgrades + achievements (default empty — nothing to transform).
  return {
    unlockedLevelIndex: Math.max(0, Math.min(CAMPAIGN_LEVELS.length - 1, raw.unlockedLevelIndex)),
    stars: (raw.stars as Record<number, number>) || {},
    highscores: (raw.highscores as Record<number, number>) || {},
    tutorialCompleted: !!raw.tutorialCompleted,
    seenIntroductions: (raw.seenIntroductions as Record<string, boolean>) || {},
    storyIntroSeen: !!raw.storyIntroSeen,
    storyBriefSeen: (raw.storyBriefSeen as Record<number, boolean>) || {},
    metaUpgrades: (raw.metaUpgrades && typeof raw.metaUpgrades === 'object' ? raw.metaUpgrades : {}) as MetaLevels,
    achievements: Array.isArray(raw.achievements) ? raw.achievements.filter((a): a is string => typeof a === 'string') : [],
  }
}

/** Stars still spendable in the workshop: earned across the campaign minus sunk into the tree. */
export function starsAvailable(progress = loadProgress()): number {
  return Math.max(0, starsEarned(progress.stars) - starsSpent(progress.metaUpgrades))
}

/** Buy the next tier of a meta track. Returns false when maxed or unaffordable. */
export function buyMetaUpgrade(id: MetaUpgradeId): boolean {
  const progress = loadProgress()
  const next = buyTier(id, progress.metaUpgrades, starsAvailable(progress))
  if (!next) return false
  progress.metaUpgrades = next
  saveProgress(progress)
  return true
}

/** Free respec: refund every spent star, keep everything else. Stars are a testament, not a trap. */
export function respecMetaUpgrades(): void {
  const progress = loadProgress()
  progress.metaUpgrades = {}
  saveProgress(progress)
}

export function loadProgress(): PlayerProgress {
  try {
    const data = storageGet(SAVE_KEY)
    if (data) {
      const migrated = migrateSave(JSON.parse(data))
      if (migrated) return migrated
    }
  } catch (err) {
    console.error('Failed to load campaign progress:', err)
  }
  return { unlockedLevelIndex: 0, stars: {}, highscores: {}, tutorialCompleted: false, seenIntroductions: {}, storyIntroSeen: false, storyBriefSeen: {} }
}

export function saveProgress(progress: PlayerProgress): void {
  storageSet(SAVE_KEY, JSON.stringify({ v: SAVE_VERSION, ...progress }))
}

/** Save-as-code: insurance against localStorage loss (itch.io iframes live on a CDN domain that
 * has already changed once, wiping saves; private modes block storage entirely). */
export function exportProgressCode(): string {
  const json = JSON.stringify({ v: SAVE_VERSION, ...loadProgress() })
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)))
}

export function importProgressCode(code: string): boolean {
  try {
    const bytes = Uint8Array.from(atob(code.trim()), (c) => c.charCodeAt(0))
    const migrated = migrateSave(JSON.parse(new TextDecoder().decode(bytes)))
    if (!migrated) return false
    saveProgress(migrated)
    return true
  } catch {
    return false
  }
}

export function registerVictory(
  levelIndex: number,
  livesRemaining: number
): { stars: number; unlockedNext: boolean } {
  const progress = loadProgress()

  // Stars: 3 forgives up to 2 leaked lives — the balance band deliberately targets SOME
  // pressure on a fair defense, so a literal perfect-run requirement made 3★ near-impossible
  // by the game's own honesty model. 2★ from 50% lives, 1★ for any win.
  let stars = 1
  if (livesRemaining >= startLives - 2) {
    stars = 3
  } else if (livesRemaining >= startLives * 0.5) {
    stars = 2
  }

  // Update stars & highscore (highest remaining lives)
  progress.stars[levelIndex] = Math.max(progress.stars[levelIndex] || 0, stars)
  progress.highscores[levelIndex] = Math.max(progress.highscores[levelIndex] || 0, livesRemaining)

  // Unlock next level
  let unlockedNext = false
  if (levelIndex === progress.unlockedLevelIndex && levelIndex + 1 < CAMPAIGN_LEVELS.length) {
    progress.unlockedLevelIndex = levelIndex + 1
    unlockedNext = true
  }

  saveProgress(progress)
  return { stars, unlockedNext }
}

export function resetProgress(): void {
  const reset: PlayerProgress = { unlockedLevelIndex: 0, stars: {}, highscores: {}, tutorialCompleted: false, metaUpgrades: {}, achievements: [] }
  saveProgress(reset)
}

export function completeTutorial(): void {
  const progress = loadProgress()
  progress.tutorialCompleted = true
  saveProgress(progress)
}
