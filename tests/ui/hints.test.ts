import { describe, it, expect, beforeEach } from 'vitest'
import { hintFired, resetHints } from '../../src/ui/hints'

const store = new Map<string, string>()
Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  writable: true,
})

beforeEach(() => store.clear())

describe('contextual hints', () => {
  it('fires each hint exactly once', () => {
    expect(hintFired('branch')).toBe(true)
    expect(hintFired('branch')).toBe(false)
    expect(hintFired('branch')).toBe(false)
  })

  it('tracks each id independently', () => {
    expect(hintFired('branch')).toBe(true)
    expect(hintFired('earlycall')).toBe(true)
    expect(hintFired('branch')).toBe(false)
  })

  it('reset replays hints', () => {
    expect(hintFired('upgrade')).toBe(true)
    expect(hintFired('upgrade')).toBe(false)
    resetHints()
    expect(hintFired('upgrade')).toBe(true)
  })
})
