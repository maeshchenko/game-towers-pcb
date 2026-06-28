import { describe, it, expect } from 'vitest'
import { makeRng } from '../../src/pipeline/rng'
import { growDecor } from '../../src/pipeline/decor'
import { cellKey } from '../../src/geom/grid'

const board = { cols: 40, rows: 30, pitch: 24 }
const trace = { waypoints: [[2, 2], [2, 20], [25, 20]] as [number, number][], cornerRadius: 0.5 }
const spots = [{ cell: [5, 5] as [number, number], score: 5, kind: 'build' as const }]
const specialSpots: never[] = []

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = makeRng(42), b = makeRng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('differs across seeds', () => {
    expect(makeRng(1)()).not.toEqual(makeRng(2)())
  })
})

describe('growDecor', () => {
  it('is deterministic for a seed', () => {
    const a = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    const b = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    expect(a).toEqual(b)
  })
  it('places at least one item and none on a path or spot cell', () => {
    const items = growDecor({ board, trace, spots, specialSpots, seed: 7 })
    expect(items.length).toBeGreaterThan(0)
    const blocked = new Set<string>(['2,2', '2,20', '25,20', '5,5'])
    for (const it of items) expect(blocked.has(cellKey(it.cell))).toBe(false)
  })
})
