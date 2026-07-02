// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { juice, initMotion, setReducedFx } from '../../src/render/juice/motion'

const STORAGE_KEY = 'pcb_td_reduced_fx_v1'

// jsdom's real localStorage is unusable under this Node version (see tests/game/campaign.test.ts
// for precedent), so use a plain in-memory mock matching the Storage interface.
let store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { store = {} },
}
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

describe('motion / reduced-fx flag', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
    // Restore matchMedia to jsdom's default (unimplemented) state between tests.
    delete (window as any).matchMedia
  })

  it('defaults to off when there is no stored preference and no matchMedia support', () => {
    initMotion()
    expect(juice.reducedFx).toBe(false)
  })

  it('reads "1" from localStorage as reduced-fx on', () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    initMotion()
    expect(juice.reducedFx).toBe(true)
  })

  it('reads "0" from localStorage as reduced-fx off', () => {
    window.localStorage.setItem(STORAGE_KEY, '0')
    initMotion()
    expect(juice.reducedFx).toBe(false)
  })

  it('setReducedFx updates the live singleton and persists to localStorage', () => {
    setReducedFx(true)
    expect(juice.reducedFx).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('1')

    setReducedFx(false)
    expect(juice.reducedFx).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('0')
  })

  it('falls back to matchMedia(prefers-reduced-motion) when no stored preference exists', () => {
    window.matchMedia = ((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia

    initMotion()
    expect(juice.reducedFx).toBe(true)
  })
})
