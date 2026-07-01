import { describe, it, expect } from 'vitest'
import { isOctilinear, octilinearize } from '../../src/geom/octilinear'

describe('octilinear', () => {
  it('detects octilinear segments', () => {
    expect(isOctilinear([0, 0], [0, 5])).toBe(true)   // vertical
    expect(isOctilinear([0, 0], [5, 0])).toBe(true)   // horizontal
    expect(isOctilinear([0, 0], [5, 5])).toBe(true)   // 45 deg
    expect(isOctilinear([0, 0], [5, 2])).toBe(false)  // shallow
    expect(isOctilinear([0, 0], [0, 0])).toBe(false)  // zero-length
  })
  it('passes through already-octilinear paths unchanged', () => {
    const p: [number, number][] = [[0, 0], [0, 5], [5, 5]]
    expect(octilinearize(p)).toEqual(p)
  })
  it('inserts a corner for a non-octilinear segment', () => {
    // (0,0) -> (5,2): diagonal 2 then horizontal 3 => corner at (2,2)
    const out = octilinearize([[0, 0], [5, 2]])
    expect(out).toEqual([[0, 0], [2, 2], [5, 2]])
    for (let i = 1; i < out.length; i++) expect(isOctilinear(out[i - 1], out[i])).toBe(true)
  })
  it('collapses duplicate consecutive cells', () => {
    expect(octilinearize([[1, 1], [1, 1], [1, 4]])).toEqual([[1, 1], [1, 4]])
  })
})
