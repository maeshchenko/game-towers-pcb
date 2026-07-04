// tests/render/hitstop.test.ts
import { describe, it, expect, afterEach } from 'vitest'
import { HitStop } from '../../src/render/juice/HitStop'
import { juice } from '../../src/render/juice/motion'

afterEach(() => {
  juice.reducedFx = false
})

describe('HitStop', () => {
  it('freezes sim dt to 0 while the freeze window is active, then passes dt through again', () => {
    const h = new HitStop()
    h.trigger(0.1)
    expect(h.filter(0.05)).toBe(0) // remaining 0.1 -> 0.05
    expect(h.filter(0.05)).toBe(0) // remaining 0.05 -> 0.00
    expect(h.filter(0.05)).toBeCloseTo(0.05, 9) // no longer frozen, dt passes through
  })

  it('trigger takes the max, not the sum, of overlapping freezes', () => {
    const h = new HitStop()
    h.trigger(0.3)
    // Advance sim time enough to (a) pass the 0.25s cooldown and (b) leave some freeze remaining.
    h.filter(0.1) // remaining 0.2, sinceLast 0.1
    h.filter(0.1) // remaining 0.1, sinceLast 0.2
    h.filter(0.06) // remaining 0.04, sinceLast 0.26 (past cooldown)
    h.trigger(0.1) // accepted: remaining = max(0.04, 0.1) = 0.1, NOT 0.14
    expect(h.filter(0.1)).toBe(0) // consumes the full 0.1 remaining
    expect(h.filter(0.01)).toBeCloseTo(0.01, 9) // already unfrozen — proves it was 0.1, not 0.14
  })

  it('ignores a new trigger fired within the 0.25s cooldown of the last accepted one', () => {
    const h = new HitStop()
    h.trigger(0.05)
    expect(h.filter(0.05)).toBe(0) // consumes the freeze, sinceLast now 0.05
    h.trigger(0.2) // within cooldown (0.05s since last) -> ignored
    expect(h.filter(0.01)).toBeCloseTo(0.01, 9) // not frozen -> proves second trigger was ignored
  })

  it('accepts a new trigger once the cooldown has elapsed', () => {
    const h = new HitStop()
    h.trigger(0.05)
    h.filter(0.05) // consumes freeze, sinceLast = 0.05
    h.filter(0.25) // sinceLast = 0.30, past cooldown
    h.trigger(0.05) // accepted
    expect(h.filter(0.02)).toBe(0) // frozen again
  })

  it('reset cancels an active freeze and re-arms the cooldown for the next trigger', () => {
    const h = new HitStop()
    h.trigger(0.5)
    expect(h.filter(0.1)).toBe(0) // frozen
    h.reset()
    expect(h.filter(0.1)).toBeCloseTo(0.1, 9) // freeze cancelled, dt passes through
    h.trigger(0.05) // must be accepted right away — reset re-armed the cooldown
    expect(h.filter(0.02)).toBe(0)
  })

  it('trigger() is a no-op when juice.reducedFx is set', () => {
    juice.reducedFx = true
    const h = new HitStop()
    h.trigger(0.5)
    expect(h.filter(0.1)).toBeCloseTo(0.1, 9)
  })
})
