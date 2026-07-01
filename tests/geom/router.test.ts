import { describe, it, expect } from 'vitest'
import { routeOctilinear } from '../../src/geom/router'
import { isOctilinear, octilinearize } from '../../src/geom/octilinear'
import { cellKey } from '../../src/geom/grid'

describe('routeOctilinear', () => {
  it('finds a connected octilinear path on an empty board', () => {
    const path = routeOctilinear({ cols: 20, rows: 20, start: [0, 0], goal: [19, 19] })!
    expect(path[0]).toEqual([0, 0])
    expect(path[path.length - 1]).toEqual([19, 19])
    // every consecutive pair is a single octilinear grid step
    for (let i = 1; i < path.length; i++) expect(isOctilinear(path[i - 1], path[i])).toBe(true)
  })
  it('returns null when fully blocked', () => {
    const blocked = new Set<string>()
    for (let y = 0; y < 20; y++) blocked.add(cellKey([10, y]))  // wall column
    const path = routeOctilinear({ cols: 20, rows: 20, start: [0, 0], goal: [19, 19], blocked })
    expect(path).toBeNull()
  })
  it('the produced corner-collapsed waypoints stay octilinear', () => {
    const path = routeOctilinear({ cols: 30, rows: 30, start: [1, 1], goal: [25, 7], turnPenalty: 2 })!
    const wp = octilinearize(path)
    for (let i = 1; i < wp.length; i++) expect(isOctilinear(wp[i - 1], wp[i])).toBe(true)
  })
})
