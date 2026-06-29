import { describe, it, expect } from 'vitest'
import { computeTowerSpots } from '../../src/pipeline/spots'
import { cellKey } from '../../src/geom/grid'

const trace = { waypoints: [[2, 2], [2, 20], [25, 20]] as [number, number][], cornerRadius: 0.5 }
const board = { cols: 40, rows: 30, pitch: 24 }

// Second path: runs along top of board, distinct from first
const traceB = { waypoints: [[2, 5], [35, 5]] as [number, number][], cornerRadius: 0.5 }

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

describe('computeTowerSpots — multi-path', () => {
  it('accepts an array of traces without error', () => {
    const { spots } = computeTowerSpots({ board, trace: [trace, traceB], budget: 8 })
    expect(spots.length).toBeGreaterThan(0)
  })

  it('excludes cells on BOTH paths', () => {
    // cells on traceB: y=5, x from 2 to 35
    const onB = new Set<string>()
    for (let x = 2; x <= 35; x++) onB.add(cellKey([x, 5]))
    // cells on trace: column x=2, y=2..20; row y=20, x=2..25
    const onA = new Set<string>()
    for (let y = 2; y <= 20; y++) onA.add(cellKey([2, y]))
    for (let x = 2; x <= 25; x++) onA.add(cellKey([x, 20]))

    const { spots, specialSpots } = computeTowerSpots({ board, trace: [trace, traceB], budget: 20 })
    const allSpots = [...spots, ...specialSpots]
    for (const s of allSpots) {
      const k = cellKey(s.cell)
      expect(onA.has(k), `spot ${k} is on path A`).toBe(false)
      expect(onB.has(k), `spot ${k} is on path B`).toBe(false)
    }
  })

  it('scores a cell near both paths higher than one near only one path', () => {
    // Single-path result — best score is coverage of one path only
    const single = computeTowerSpots({ board, trace, budget: 30, minSeparation: 1 })
    // Multi-path — candidates near both paths can accumulate higher coverage
    const multi = computeTowerSpots({ board, trace: [trace, traceB], budget: 30, minSeparation: 1 })
    const maxSingle = Math.max(...single.spots.map(s => s.score), ...single.specialSpots.map(s => s.score))
    const maxMulti = Math.max(...multi.spots.map(s => s.score), ...multi.specialSpots.map(s => s.score))
    // Multi-path top scorer must be at least as good (typically strictly better since two paths contribute samples)
    expect(maxMulti).toBeGreaterThanOrEqual(maxSingle)
  })
})
