import type { Board, Level } from '../model/level'
import type { Cell } from '../geom/types'
import { octilinearize } from '../geom/octilinear'
import { stylePath } from '../geom/pathStyle'
import { makeRng } from './rng'
import { buildDecorWithNets } from './decor'
import { routeCopper } from './copper'
import { buildTileGrid } from '../tiles/generator'
import { compileRoutes } from '../tiles/compile'
import { tileSpots } from '../tiles/spots'

export { minSpots } from './spots'

export const ARCHETYPES = ['serpentineH', 'serpentineV', 'spiral', 'branching', 'multiSpawn', 'cross'] as const
export type ArchetypeName = typeof ARCHETYPES[number]

export function generateLevel(params: {
  board: Board; difficulty: number; seed: number; archetype?: string
}): Level {
  const { board, difficulty, seed } = params
  const { grid, archetype } = buildTileGrid(board, difficulty, seed, params.archetype)
  const routes = compileRoutes(grid).map((t, i) => ({
    waypoints: stylePath(octilinearize(t.waypoints), makeRng(seed * 131 + i + 1)),
    cornerRadius: 0.5,
  }))
  const paths = routes.length ? routes : [{ waypoints: [[1, 1], [board.cols - 2, board.rows - 2]] as Cell[], cornerRadius: 0.5 }]
  const { spots, specialSpots } = tileSpots({ board, routes: paths, difficulty })
  const { decor, nets } = buildDecorWithNets({ board, trace: paths, spots, specialSpots, seed })
  const trace = paths[0]
  const copper = routeCopper({ decor, nets, board, trace, paths })
  return {
    version: 1,
    board,
    seed,
    tiles: grid,
    trace,
    paths,
    spots,
    specialSpots,
    decor,
    nets,
    copper,
    meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty, archetype },
  }
}
