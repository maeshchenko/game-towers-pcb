import { describe, it, expect } from 'vitest'
import { rotForPorts, emptyGrid, getTile, layPath } from '../../src/tiles/layout'
import { tilePorts } from '../../src/tiles/ports'

describe('layout', () => {
  it('rotForPorts finds rotation matching a desired port set', () => {
    expect(new Set(tilePorts({ type: 'corner', rot: rotForPorts('corner', ['E', 'S']) }))).toEqual(new Set(['E', 'S']))
    expect(new Set(tilePorts({ type: 'straight', rot: rotForPorts('straight', ['E', 'W']) }))).toEqual(new Set(['E', 'W']))
  })
  it('layPath writes start/finish and a corner at the bend', () => {
    const g = emptyGrid(5, 5, 6)
    // L-shape: (0,0)->(2,0)->(2,2): horizontal then down
    layPath(g, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])
    expect(getTile(g, 0, 0)!.type).toBe('start')
    expect(getTile(g, 2, 2)!.type).toBe('finish')
    expect(getTile(g, 1, 0)!.type).toBe('straight')
    expect(getTile(g, 2, 0)!.type).toBe('corner')          // the bend
    // corner connects W (came from) and S (going down)
    expect(new Set(tilePorts(getTile(g, 2, 0)!))).toEqual(new Set(['W', 'S']))
  })
})
