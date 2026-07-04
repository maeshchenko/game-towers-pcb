// tests/render/decals-logic.test.ts
import { describe, it, expect } from 'vitest'
import { DecalPool } from '../../src/render/juice/decalLogic'

describe('decalLogic / DecalPool.acquire', () => {
  it('hands out increasing slot indices while under capacity', () => {
    const pool = new DecalPool(3)
    expect(pool.acquire(0)).toBe(0)
    expect(pool.acquire(1)).toBe(1)
    expect(pool.acquire(2)).toBe(2)
  })

  it('reuses the oldest slot once the pool is full', () => {
    const pool = new DecalPool(40)
    const slots: number[] = []
    for (let i = 0; i < 40; i++) slots.push(pool.acquire(i))
    // 41st acquire should reuse slot 0 (the oldest, acquired at t=0)
    const reused = pool.acquire(40)
    expect(reused).toBe(slots[0])
  })

  it('continues round-robin reuse in age order past the first wrap', () => {
    const pool = new DecalPool(3)
    pool.acquire(0) // slot 0
    pool.acquire(1) // slot 1
    pool.acquire(2) // slot 2
    expect(pool.acquire(3)).toBe(0) // reuse oldest (slot 0)
    expect(pool.acquire(4)).toBe(1) // reuse next-oldest (slot 1)
    expect(pool.acquire(5)).toBe(2) // reuse next-oldest (slot 2)
  })

  it('resets bornAt when a slot is reused', () => {
    const pool = new DecalPool(1)
    pool.acquire(0)
    expect(pool.alphaAt(0, 5)).toBeCloseTo(0.25, 5) // 0.5 * (1 - 5/10)
    pool.acquire(100)
    expect(pool.alphaAt(0, 100)).toBeCloseTo(0.5, 5) // fresh birth, full alpha again
  })
})

describe('decalLogic / DecalPool.alphaAt', () => {
  it('starts at 0.5 alpha at birth', () => {
    const pool = new DecalPool(5)
    const slot = pool.acquire(10)
    expect(pool.alphaAt(slot, 10)).toBeCloseTo(0.5, 5)
  })

  it('fades linearly to 0 over 10 seconds', () => {
    const pool = new DecalPool(5)
    const slot = pool.acquire(0)
    expect(pool.alphaAt(slot, 2.5)).toBeCloseTo(0.375, 5) // 0.5 * (1 - 2.5/10)
    expect(pool.alphaAt(slot, 5)).toBeCloseTo(0.25, 5)
    expect(pool.alphaAt(slot, 7.5)).toBeCloseTo(0.125, 5)
  })

  it('reaches exactly 0 at +10s and stays 0 beyond', () => {
    const pool = new DecalPool(5)
    const slot = pool.acquire(0)
    expect(pool.alphaAt(slot, 10)).toBe(0)
    expect(pool.alphaAt(slot, 20)).toBe(0)
  })

  it('never returns a negative alpha', () => {
    const pool = new DecalPool(5)
    const slot = pool.acquire(0)
    expect(pool.alphaAt(slot, 1000)).toBeGreaterThanOrEqual(0)
  })

  it('returns 0 for a slot index that was never acquired', () => {
    const pool = new DecalPool(5)
    expect(pool.alphaAt(0, 0)).toBe(0)
    expect(pool.alphaAt(4, 100)).toBe(0)
  })

  it('returns 0 for an explicitly inactive entry', () => {
    const pool = new DecalPool(5)
    const slot = pool.acquire(0)
    pool.entries[slot].active = false
    expect(pool.alphaAt(slot, 0)).toBe(0)
  })
})
