import { describe, it, expect } from 'vitest'
import { computeTowerSpots } from '../../src/pipeline/spots'
import { cellKey } from '../../src/geom/grid'

const trace = { waypoints: [[2, 2], [2, 20], [25, 20]] as [number, number][], cornerRadius: 0.5 }
const board = { cols: 40, rows: 30, pitch: 24 }

describe('computeTowerSpots', () => {
  it('returns at most budget build spots', () => {
    const { spots, specialSpots } = computeTowerSpots({ board, trace, budget: 8 })
    expect(spots.length).toBeGreaterThan(0)
    expect(spots.length).toBeLessThanOrEqual(8)
    expect(spots.length + specialSpots.length).toBeLessThanOrEqual(8)
  })
  it('never places a spot on a path cell', () => {
    const pathCells = new Set(['2,2', '2,11', '2,20', '13,20', '25,20'])
    const { spots } = computeTowerSpots({ board, trace, budget: 8 })
    for (const s of spots) expect(pathCells.has(cellKey(s.cell))).toBe(false)
  })
  it('respects minimum separation between spots', () => {
    const { spots } = computeTowerSpots({ board, trace, budget: 12, minSeparation: 3 })
    for (let i = 0; i < spots.length; i++)
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot(spots[i].cell[0] - spots[j].cell[0], spots[i].cell[1] - spots[j].cell[1])
        expect(d).toBeGreaterThanOrEqual(3)
      }
  })
  it('tags some special spots', () => {
    const { specialSpots } = computeTowerSpots({ board, trace, budget: 12, specialEvery: 4 })
    expect(specialSpots.length).toBeGreaterThan(0)
    expect(specialSpots.every((s) => s.kind === 'special')).toBe(true)
  })
})
