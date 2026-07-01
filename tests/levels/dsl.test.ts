import { describe, it, expect } from 'vitest'
import { LevelBuilder } from '../../src/levels/dsl'
import { powerSupply } from '../../src/pipeline/circuits'

const board = { cols: 24, rows: 18, pitch: 30 }
const meta = { name: 'test', difficulty: 1 }

describe('LevelBuilder', () => {
  it('assembles a level with one path, spots, and finish at the last waypoint', () => {
    const lvl = new LevelBuilder(board, 1, meta)
      .path([[0, 2], [10, 2], [10, 10], [23, 10]])
      .buildSpot([5, 3], [11, 9])
      .specialSpot([9, 9])
      .build()
    expect(lvl.version).toBe(1)
    expect(lvl.paths!.length).toBe(1)
    expect(lvl.trace.waypoints[lvl.trace.waypoints.length - 1]).toEqual([23, 10])
    expect(lvl.spots.length).toBe(2)
    expect(lvl.specialSpots.length).toBe(1)
  })

  it('throws when paths have different finishes', () => {
    expect(() =>
      new LevelBuilder(board, 1, meta)
        .path([[0, 2], [23, 2]])
        .path([[0, 16], [23, 16]])
        .build()
    ).toThrow(/one finish/i)
  })

  it('routes copper for a placed block (endpoints land on pads)', () => {
    const b = new LevelBuilder(board, 1, meta).path([[0, 0], [23, 0]])
    b.block(powerSupply([4, 8], b.alloc))
    const lvl = b.build()
    expect(lvl.decor.length).toBeGreaterThan(0)
    expect(lvl.nets!.length).toBeGreaterThan(0)
    expect(lvl.copper!.length).toBeGreaterThan(0)
  })
})
