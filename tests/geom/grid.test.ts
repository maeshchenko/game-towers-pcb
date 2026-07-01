import { describe, it, expect } from 'vitest'
import { cellToPx, snapToCell, dist, cellKey } from '../../src/geom/grid'

describe('grid', () => {
  it('cellToPx returns cell center', () => {
    expect(cellToPx([0, 0], 24)).toEqual({ x: 12, y: 12 })
    expect(cellToPx([2, 3], 24)).toEqual({ x: 60, y: 84 })
  })
  it('snapToCell is inverse of cellToPx center', () => {
    expect(snapToCell({ x: 60, y: 84 }, 24)).toEqual([2, 3])
    expect(snapToCell({ x: 13, y: 11 }, 24)).toEqual([0, 0])
  })
  it('dist is euclidean', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
  })
  it('cellKey is stable and unique', () => {
    expect(cellKey([2, 3])).toBe('2,3')
    expect(cellKey([2, 3])).toBe(cellKey([2, 3]))
  })
})
