// tests/render/particles-logic.test.ts
import { describe, it, expect } from 'vitest'
import { spawnFrom, advance, cappedCount, type BurstSpec, type P } from '../../src/render/juice/particleLogic'

// Deterministic sequence-based rand for reproducible tests: cycles through the given values.
function seq(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length]
}

describe('particleLogic / spawnFrom', () => {
  const baseSpec: BurstSpec = {
    x: 100, y: 200, count: 3,
    speed: [10, 20],
    life: [1, 2],
    color: 0xff0000, size: [2, 4],
  }

  it('spawns exactly spec.count particles', () => {
    const ps = spawnFrom(baseSpec, seq([0]))
    expect(ps.length).toBe(3)
  })

  it('places every particle at the burst origin', () => {
    const ps = spawnFrom(baseSpec, seq([0.5]))
    for (const p of ps) {
      expect(p.x).toBe(100)
      expect(p.y).toBe(200)
    }
  })

  it('honors the speed range at the low extreme (rand()=0)', () => {
    // rand() sequence: angle, speed, life, size, rotation, spin — angle=0 → vx=speed, vy≈0
    const ps = spawnFrom(baseSpec, seq([0]))
    const p = ps[0]
    expect(p.vx).toBeCloseTo(10, 5) // speed[0]
    expect(p.vy).toBeCloseTo(0, 5)
  })

  it('honors the speed range at the high extreme (rand()=1)', () => {
    const ps = spawnFrom(baseSpec, seq([1]))
    const p = ps[0]
    // angle = 2π (rand=1 over default [0,2π]) → cos≈1, sin≈0; speed = speed[1] = 20
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(20, 4)
  })

  it('honors a custom angle range', () => {
    const spec: BurstSpec = { ...baseSpec, angle: [Math.PI / 2, Math.PI / 2] }
    const ps = spawnFrom(spec, seq([0.3, 0.7, 0.1, 0.9, 0.5, 0.2]))
    const p = ps[0]
    // angle pinned to PI/2 regardless of rand → vx≈0, vy≈speed
    expect(p.vx).toBeCloseTo(0, 5)
    expect(p.vy).toBeGreaterThan(0)
  })

  it('honors the life range and sets maxLife equal to life', () => {
    const ps = spawnFrom(baseSpec, seq([0]))
    for (const p of ps) {
      expect(p.life).toBeCloseTo(1, 5) // life[0]
      expect(p.maxLife).toBe(p.life)
    }
    const ps2 = spawnFrom(baseSpec, seq([1]))
    for (const p of ps2) {
      expect(p.life).toBeCloseTo(2, 5) // life[1]
    }
  })

  it('honors the size range', () => {
    const ps = spawnFrom(baseSpec, seq([0]))
    expect(ps[0].size).toBeCloseTo(2, 5) // size[0]
    const ps2 = spawnFrom(baseSpec, seq([1]))
    expect(ps2[0].size).toBeCloseTo(4, 5) // size[1]
  })

  it('is deterministic given the same rand sequence', () => {
    const rand1 = seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    const rand2 = seq([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
    const a = spawnFrom({ ...baseSpec, count: 5 }, rand1)
    const b = spawnFrom({ ...baseSpec, count: 5 }, rand2)
    expect(a).toEqual(b)
  })
})

describe('particleLogic / advance', () => {
  function makeP(overrides: Partial<P> = {}): P {
    return { x: 0, y: 0, vx: 10, vy: 0, life: 1, maxLife: 1, size: 3, rotation: 0, spin: 0, ...overrides }
  }

  it('moves the particle by velocity * dt', () => {
    const p = makeP({ vx: 10, vy: 5 })
    advance(p, 0.5, 0, 0)
    expect(p.x).toBeCloseTo(5, 5)
    expect(p.y).toBeCloseTo(2.5, 5)
  })

  it('applies gravity to vertical velocity', () => {
    const p = makeP({ vx: 0, vy: 0 })
    advance(p, 1, 100, 0)
    expect(p.vy).toBeCloseTo(100, 5)
  })

  it('applies drag to reduce velocity magnitude over time', () => {
    const p = makeP({ vx: 10, vy: 0 })
    advance(p, 1, 0, 0.5) // 50%/s drag
    expect(p.vx).toBeCloseTo(5, 5)
  })

  it('never inverts velocity when drag * dt exceeds 1', () => {
    const p = makeP({ vx: 10, vy: 0 })
    advance(p, 1, 0, 2) // would be negative without clamping
    expect(p.vx).toBeGreaterThanOrEqual(0)
  })

  it('advances rotation by spin * dt', () => {
    const p = makeP({ spin: 2 })
    advance(p, 0.5, 0, 0)
    expect(p.rotation).toBeCloseTo(1, 5)
  })

  it('decrements life by dt and returns true while alive', () => {
    const p = makeP({ life: 1, maxLife: 1 })
    const alive = advance(p, 0.4, 0, 0)
    expect(alive).toBe(true)
    expect(p.life).toBeCloseTo(0.6, 5)
  })

  it('returns false once life reaches zero or below', () => {
    const p = makeP({ life: 0.3, maxLife: 1 })
    const alive = advance(p, 0.5, 0, 0)
    expect(alive).toBe(false)
    expect(p.life).toBeLessThanOrEqual(0)
  })
})

describe('particleLogic / cappedCount', () => {
  it('returns the full requested count when the pool is empty', () => {
    expect(cappedCount(100, 0)).toBe(100)
  })

  it('scales down proportionally to live/500 fill', () => {
    // live=250 → factor = 1 - 250/500 = 0.5
    expect(cappedCount(100, 250)).toBe(50)
  })

  it('floors the result at the count/live/500 minimum multiplier of 0.2', () => {
    // live=480 → raw factor 1-480/500=0.04, clamped to 0.2
    expect(cappedCount(100, 480)).toBe(20)
  })

  it('returns 0 once liveCount reaches the 500 cap', () => {
    expect(cappedCount(100, 500)).toBe(0)
    expect(cappedCount(100, 600)).toBe(0)
  })

  it('uses Math.floor on the scaled count', () => {
    // live=1 → factor = 1 - 1/500 = 0.998; 10*0.998=9.98 → floor 9
    expect(cappedCount(10, 1)).toBe(9)
  })
})
