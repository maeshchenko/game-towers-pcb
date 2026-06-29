import { describe, it, expect } from 'vitest'
import { chamferCorners, jogStraights, mergeCollinear, stylePath } from '../../src/geom/pathStyle'
import { isOctilinear } from '../../src/geom/octilinear'
import { makeRng } from '../../src/pipeline/rng'
import type { Cell } from '../../src/geom/types'

function allOctilinear(wp: Cell[]): boolean {
  for (let i = 1; i < wp.length; i++) if (!isOctilinear(wp[i - 1], wp[i])) return false
  return true
}

describe('pathStyle', () => {
  // a long L: start (1,5) → (60,5) → (60,40)
  const L: Cell[] = [[1, 5], [10, 5], [20, 5], [60, 5], [60, 20], [60, 40]]

  it('mergeCollinear collapses collinear runs but keeps corners + endpoints', () => {
    const m = mergeCollinear(L)
    expect(m[0]).toEqual([1, 5])
    expect(m[m.length - 1]).toEqual([60, 40])
    expect(m.length).toBe(3) // start, corner, finish
  })

  it('chamferCorners turns 90° corners into 45° cuts, stays octilinear, endpoints fixed', () => {
    const c = chamferCorners(mergeCollinear(L), 2)
    expect(c[0]).toEqual([1, 5])
    expect(c[c.length - 1]).toEqual([60, 40])
    expect(allOctilinear(c)).toBe(true)
    expect(c.length).toBeGreaterThan(3) // corner became two chamfer points
  })

  it('jogStraights bumps long straights (adds vertices), stays octilinear, endpoints fixed', () => {
    const j = jogStraights(mergeCollinear(L), 12, 2, makeRng(1))
    expect(j[0]).toEqual([1, 5])
    expect(j[j.length - 1]).toEqual([60, 40])
    expect(allOctilinear(j)).toBe(true)
    expect(j.length).toBeGreaterThan(3)
  })

  it('stylePath is deterministic and octilinear with fixed endpoints', () => {
    const a = stylePath(L, makeRng(7))
    const b = stylePath(L, makeRng(7))
    expect(a).toEqual(b)
    expect(a[0]).toEqual([1, 5])
    expect(a[a.length - 1]).toEqual([60, 40])
    expect(allOctilinear(a)).toBe(true)
  })
})
