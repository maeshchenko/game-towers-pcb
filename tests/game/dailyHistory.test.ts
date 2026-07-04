import { describe, it, expect, beforeEach } from 'vitest'
import { loadDailyHistory, recordDailyWin, dailyStreak } from '../../src/game/dailyHistory'

// jsdom's localStorage lacks clear() under our test env — same mock pattern as achievements.test.ts
const store = new Map<string, string>()
const localStorageMock = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

beforeEach(() => store.clear())

describe('daily history', () => {
  it('records wins once, sorted', () => {
    recordDailyWin('20260703')
    recordDailyWin('20260701')
    recordDailyWin('20260703')
    expect(loadDailyHistory()).toEqual(['20260701', '20260703'])
  })

  it('streak counts consecutive days ending today', () => {
    expect(dailyStreak('20260704', ['20260702', '20260703', '20260704'])).toBe(3)
  })

  it('unplayed today falls back to yesterday without breaking the streak', () => {
    expect(dailyStreak('20260704', ['20260702', '20260703'])).toBe(2)
  })

  it('a gap resets the streak', () => {
    expect(dailyStreak('20260704', ['20260701', '20260704'])).toBe(1)
    expect(dailyStreak('20260704', ['20260701'])).toBe(0)
  })

  it('crosses month boundaries', () => {
    expect(dailyStreak('20260701', ['20260629', '20260630', '20260701'])).toBe(3)
  })
})
