import { describe, it, expect } from 'vitest'
import { SpatialGrid } from '../../src/game/SpatialGrid'

const item = (x: number, y: number) => ({ pos: { x, y } })

describe('SpatialGrid', () => {
  it('queryCircle returns exactly the items inside the radius', () => {
    const grid = new SpatialGrid<{ pos: { x: number; y: number } }>(30)
    const inside = [item(0, 0), item(25, 0), item(0, -29)]
    const outside = [item(31, 0), item(100, 100), item(-40, 5)]
    grid.rebuild([...inside, ...outside])
    const got = grid.queryCircle({ x: 0, y: 0 }, 30)
    expect(new Set(got)).toEqual(new Set(inside))
  })

  it('matches brute force on random data', () => {
    const grid = new SpatialGrid<{ pos: { x: number; y: number } }>(30)
    let s = 42
    const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
    const items = Array.from({ length: 300 }, () => item(rnd() * 1800, rnd() * 1350))
    grid.rebuild(items)
    for (let q = 0; q < 20; q++) {
      const c = { x: rnd() * 1800, y: rnd() * 1350 }, r = 30 + rnd() * 300
      const brute = items.filter((i) => Math.hypot(i.pos.x - c.x, i.pos.y - c.y) <= r)
      expect(new Set(grid.queryCircle(c, r))).toEqual(new Set(brute))
    }
  })

  it('rebuild clears previous contents', () => {
    const grid = new SpatialGrid<{ pos: { x: number; y: number } }>(30)
    grid.rebuild([item(0, 0)])
    grid.rebuild([])
    expect(grid.queryCircle({ x: 0, y: 0 }, 100)).toEqual([])
  })
})
