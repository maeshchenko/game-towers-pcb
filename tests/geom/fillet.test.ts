import { describe, it, expect } from 'vitest'
import { filletPath } from '../../src/geom/fillet'
import { cellToPx, dist } from '../../src/geom/grid'

describe('filletPath', () => {
  const pitch = 24
  it('keeps endpoints exact', () => {
    const wp: [number, number][] = [[0, 0], [0, 4], [4, 4]]
    const out = filletPath(wp, 0.5, pitch)
    expect(out[0]).toEqual(cellToPx([0, 0], pitch))
    expect(out[out.length - 1]).toEqual(cellToPx([4, 4], pitch))
  })
  it('rounds the corner: no point sits exactly on the sharp vertex', () => {
    const wp: [number, number][] = [[0, 0], [0, 4], [4, 4]]
    const sharp = cellToPx([0, 4], pitch)
    const out = filletPath(wp, 0.5, pitch)
    const minToSharp = Math.min(...out.map((p) => dist(p, sharp)))
    expect(minToSharp).toBeGreaterThan(0)
  })
  it('a straight path (no interior turn) returns its endpoints', () => {
    const out = filletPath([[0, 0], [0, 6]], 0.5, pitch)
    expect(out[0]).toEqual(cellToPx([0, 0], pitch))
    expect(out[out.length - 1]).toEqual(cellToPx([0, 6], pitch))
  })
})
