// tests/game/campaign.test.ts
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadProgress, saveProgress, registerVictory, resetProgress, completeTutorial, migrateSave, exportProgressCode, importProgressCode, SAVE_VERSION } from '../../src/game/campaign'
import { startLives } from '../../src/game/difficulty'

let store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { store = {} },
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

describe('campaign', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads empty progress by default', () => {
    const p = loadProgress()
    expect(p.unlockedLevelIndex).toBe(0)
    expect(p.stars).toEqual({})
    expect(p.highscores).toEqual({})
    expect(p.seenIntroductions).toEqual({})
  })

  it('saves and loads progress', () => {
    const custom = { unlockedLevelIndex: 3, stars: { 0: 3, 1: 2 }, highscores: { 0: 20, 1: 12 }, tutorialCompleted: true, seenIntroductions: {}, storyIntroSeen: false, storyBriefSeen: {} }
    saveProgress(custom)
    const loaded = loadProgress()
    expect(loaded).toEqual(custom)
  })

  it('calculates stars rating correctly', () => {
    // 3 stars for max lives
    const r3 = registerVictory(0, startLives)
    expect(r3.stars).toBe(3)

    // 3 stars still forgives up to 2 leaked lives
    const r3b = registerVictory(0, startLives - 2)
    expect(r3b.stars).toBe(3)

    // 3 leaks is no longer perfect → 2 stars (>= 50% lives)
    const r2a = registerVictory(0, startLives - 3)
    expect(r2a.stars).toBe(2)

    // 2 stars for >= 50% lives (e.g. 10 lives)
    const r2 = registerVictory(0, 10)
    expect(r2.stars).toBe(2)

    // 1 star for < 50% lives (e.g. 5 lives)
    const r1 = registerVictory(0, 5)
    expect(r1.stars).toBe(1)
  })

  it('unlocks next level on victory and updates highscore', () => {
    expect(loadProgress().unlockedLevelIndex).toBe(0)

    const res = registerVictory(0, 15)
    expect(res.unlockedNext).toBe(true)

    const progress = loadProgress()
    expect(progress.unlockedLevelIndex).toBe(1)
    expect(progress.stars[0]).toBe(2) // 15 lives -> 2 stars
    expect(progress.highscores[0]).toBe(15)
  })

  it('does not unlock next level if levelIndex is not the highest unlocked', () => {
    // Unlock level 2
    registerVictory(0, startLives)
    registerVictory(1, startLives)
    expect(loadProgress().unlockedLevelIndex).toBe(2)

    // Replay level 0
    const res = registerVictory(0, startLives)
    expect(res.unlockedNext).toBe(false)
    expect(loadProgress().unlockedLevelIndex).toBe(2)
  })

  it('resets progress successfully', () => {
    registerVictory(0, startLives)
    expect(loadProgress().unlockedLevelIndex).toBe(1)

    resetProgress()
    expect(loadProgress().unlockedLevelIndex).toBe(0)
    expect(loadProgress().stars).toEqual({})
    expect(loadProgress().tutorialCompleted).toBe(false)
  })

  it('manages tutorial status', () => {
    expect(loadProgress().tutorialCompleted).toBe(false)
    completeTutorial()
    expect(loadProgress().tutorialCompleted).toBe(true)
  })

  describe('save versioning & migration', () => {
    it('stamps the current version into stored JSON', () => {
      saveProgress(loadProgress())
      const raw = JSON.parse(store['pcb_td_campaign_progress_v1'])
      expect(raw.v).toBe(SAVE_VERSION)
    })

    it('migrates a legacy unstamped (v1) save without losing progress', () => {
      store['pcb_td_campaign_progress_v1'] = JSON.stringify({ unlockedLevelIndex: 4, stars: { 2: 3 }, highscores: { 2: 20 } })
      const p = loadProgress()
      expect(p.unlockedLevelIndex).toBe(4)
      expect(p.stars[2]).toBe(3)
      expect(p.storyBriefSeen).toEqual({})
    })

    it('rejects garbage and clamps out-of-range level index', () => {
      expect(migrateSave(null)).toBeNull()
      expect(migrateSave('nope')).toBeNull()
      expect(migrateSave({ unlockedLevelIndex: 'x' })).toBeNull()
      expect(migrateSave({ unlockedLevelIndex: 999 })!.unlockedLevelIndex).toBe(11)
    })

    it('export/import round-trips progress through a code', () => {
      registerVictory(0, startLives)
      const code = exportProgressCode()
      resetProgress()
      expect(loadProgress().unlockedLevelIndex).toBe(0)
      expect(importProgressCode(code)).toBe(true)
      expect(loadProgress().unlockedLevelIndex).toBe(1)
      expect(loadProgress().stars[0]).toBe(3)
    })

    it('import rejects malformed codes', () => {
      expect(importProgressCode('%%% not base64 %%%')).toBe(false)
      expect(importProgressCode(btoa('{"broken": true}'))).toBe(false)
    })
  })
})
