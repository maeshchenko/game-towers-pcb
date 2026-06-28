import { describe, it, expect } from 'vitest'
import { generateLevel, minSpots } from '../../src/pipeline/generator'
import { isOctilinear } from '../../src/geom/octilinear'

describe('generateLevel', () => {
  const board = { cols: 48, rows: 36, pitch: 24 }

  it('produces a valid octilinear connected trace', () => {
    const lvl = generateLevel({ board, difficulty: 3, seed: 1 })
    const wp = lvl.trace.waypoints
    expect(wp.length).toBeGreaterThanOrEqual(2)
    for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
  })

  it('is deterministic per seed', () => {
    expect(generateLevel({ board, difficulty: 3, seed: 99 }))
      .toEqual(generateLevel({ board, difficulty: 3, seed: 99 }))
  })

  it('solvability invariant holds over 100 seeds', () => {
    for (let seed = 0; seed < 100; seed++) {
      const lvl = generateLevel({ board, difficulty: 4, seed })
      const wp = lvl.trace.waypoints
      expect(wp.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
      expect(lvl.spots.length + lvl.specialSpots.length).toBeGreaterThanOrEqual(minSpots(4))
    }
  })
})
