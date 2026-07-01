import { describe, it, expect } from 'vitest'
import { emptyGrid, layPath, setTile } from '../../src/tiles/layout'
import { compileRoutes } from '../../src/tiles/compile'
import { rotForPorts } from '../../src/tiles/layout'

describe('compileRoutes', () => {
  it('straight L-path compiles to one connected route', () => {
    const g = emptyGrid(5, 5, 6)
    layPath(g, [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]])
    const routes = compileRoutes(g)
    expect(routes).toHaveLength(1)
    const wp = routes[0].waypoints
    expect(wp[0]).toEqual([3, 3])                 // start tile (0,0) center
    expect(wp[wp.length - 1]).toEqual([15, 15])   // finish tile (2,2) center
  })
  it('a fork yields two routes that share the trunk start', () => {
    const g = emptyGrid(7, 7, 6)
    // trunk W->fork at (3,3); branches up to finish (3,1) and right to finish (5,3)
    layPath(g, [[1, 3], [2, 3], [3, 3]])                 // start..fork cell (overwritten next)
    setTile(g, 3, 3, { type: 'fork', rot: rotForPorts('fork', ['W', 'N', 'E']) }) // in W, out N+E
    layPath(g, [[3, 3], [3, 2], [3, 1]])  // keeps fork at (3,3); finish (3,1)
    layPath(g, [[3, 3], [4, 3], [5, 3]])  // keeps fork; finish (5,3)
    const routes = compileRoutes(g)
    expect(routes.length).toBe(2)
    for (const r of routes) expect(r.waypoints[0]).toEqual([9, 21]) // start tile (1,3) center
  })
  it('a bridge passes two routes through without merging', () => {
    const g = emptyGrid(5, 5, 6)
    setTile(g, 2, 2, { type: 'bridge', rot: 0 })
    layPath(g, [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]]) // vertical route through bridge
    layPath(g, [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]) // horizontal route through bridge
    const routes = compileRoutes(g)
    expect(routes.length).toBe(2) // independent crossing routes
  })
})
