import { describe, it, expect } from 'vitest'
import { pathSamples, coverage } from '../../src/geom/sampling'

describe('sampling', () => {
  it('samples a straight segment at the given step', () => {
    const s = pathSamples([[0, 0], [0, 10]], 24, 1)
    expect(s.length).toBeGreaterThanOrEqual(10)
    expect(s[0]).toEqual({ x: 12, y: 12 })
  })
  it('coverage counts nearby samples', () => {
    const s = pathSamples([[0, 0], [0, 10]], 24, 1)
    const near = coverage([1, 0], 2, s, 24)   // adjacent column, range 2 cells
    const far = coverage([30, 30], 2, s, 24)
    expect(near).toBeGreaterThan(0)
    expect(far).toBe(0)
  })
})
