import { describe, it, expect } from 'vitest'
import { SpatialGrid } from '../../src/game/SpatialGrid'
import { Tower } from '../../src/game/Tower'
// fake Enemy: duck-typed pos/alive/traveled/hp, matching the pattern used in existing Tower tests

describe('Tower targeting via grid', () => {
  it('grid path picks the same target as linear scan', () => {
    const mk = (x: number, traveled: number) =>
      ({ pos: { x, y: 0 }, alive: true, traveled, hp: 10, maxHp: 10 }) as any
    const enemies = [mk(30, 5), mk(60, 10), mk(500, 20)]
    const grid = new SpatialGrid<any>(30)
    grid.rebuild(enemies)
    const a = new Tower('cannon', { x: 0, y: 0 }, 30)
    const b = new Tower('cannon', { x: 0, y: 0 }, 30)
    const shotLinear = a.update(10, enemies)          // cannon range 6*30=180px → target traveled=10 (x=60)
    const shotGrid = b.update(10, enemies, grid)
    expect(shotLinear?.target).toBe(enemies[1])
    expect(shotGrid?.target).toBe(enemies[1])
  })
})
