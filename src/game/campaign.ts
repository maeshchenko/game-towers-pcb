// src/game/campaign.ts
import { startLives } from './difficulty'
import type { Board, Level } from '../model/level'
import { AUTHORED_LEVELS } from '../levels'

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

export function loadProgress(): PlayerProgress {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = window.localStorage.getItem(SAVE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        if (parsed && typeof parsed.unlockedLevelIndex === 'number') {
          return {
            unlockedLevelIndex: parsed.unlockedLevelIndex,
            stars: parsed.stars || {},
            highscores: parsed.highscores || {},
            tutorialCompleted: parsed.tutorialCompleted || false,
            seenIntroductions: parsed.seenIntroductions || {},
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load campaign progress:', err)
  }
  return { unlockedLevelIndex: 0, stars: {}, highscores: {}, tutorialCompleted: false, seenIntroductions: {} }
}

export function saveProgress(progress: PlayerProgress): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(progress))
    }
  } catch (err) {
    console.error('Failed to save campaign progress:', err)
  }
}

export function registerVictory(
  levelIndex: number,
  livesRemaining: number
): { stars: number; unlockedNext: boolean } {
  const progress = loadProgress()

  // Calculate stars
  let stars = 1
  if (livesRemaining === startLives) {
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
  const reset: PlayerProgress = { unlockedLevelIndex: 0, stars: {}, highscores: {}, tutorialCompleted: false }
  saveProgress(reset)
}

export function completeTutorial(): void {
  const progress = loadProgress()
  progress.tutorialCompleted = true
  saveProgress(progress)
}
