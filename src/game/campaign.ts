// src/game/campaign.ts
import { startLives } from './difficulty'

export interface CampaignLevelDef {
  name: string
  cols: number
  rows: number
  difficulty: number
  seed: number
}

export interface PlayerProgress {
  unlockedLevelIndex: number
  stars: Record<number, number>      // levelIndex -> star count (1-3)
  highscores: Record<number, number>  // levelIndex -> highscore (remaining lives)
  tutorialCompleted?: boolean
}

export const CAMPAIGN_LEVELS: CampaignLevelDef[] = [
  { name: 'Вводные шины', cols: 24, rows: 18, difficulty: 1, seed: 12048 },
  { name: 'Поворот ключа', cols: 24, rows: 18, difficulty: 2, seed: 93849 },
  { name: 'Двойной контур', cols: 32, rows: 24, difficulty: 3, seed: 57201 },
  { name: 'Шунт питания', cols: 32, rows: 24, difficulty: 4, seed: 10482 },
  { name: 'Спиральный мост', cols: 32, rows: 24, difficulty: 5, seed: 83012 },
  { name: 'Широкая магистраль', cols: 44, rows: 33, difficulty: 5, seed: 38402 },
  { name: 'Сетка контактов', cols: 44, rows: 33, difficulty: 6, seed: 74901 },
  { name: 'Высокое напряжение', cols: 44, rows: 33, difficulty: 7, seed: 90283 },
  { name: 'Частотный разделитель', cols: 60, rows: 45, difficulty: 7, seed: 48901 },
  { name: 'Многослойный мост', cols: 60, rows: 45, difficulty: 8, seed: 82903 },
  { name: 'Критический перегруз', cols: 60, rows: 45, difficulty: 8, seed: 19203 },
  { name: 'Финал: Генератор', cols: 60, rows: 45, difficulty: 9, seed: 99999 },
]

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
          }
        }
      }
    }
  } catch (err) {
    console.error('Failed to load campaign progress:', err)
  }
  return { unlockedLevelIndex: 0, stars: {}, highscores: {}, tutorialCompleted: false }
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
