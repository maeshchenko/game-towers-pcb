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
  
  // Align board columns and rows with the generated tile grid size (so no paths go out of bounds)
  const actualBoard = {
    ...board,
    cols: grid.tcols * grid.tileSize,
    rows: grid.trows * grid.tileSize,
  }

  const routes = compileRoutes(grid).map((t, i) => ({
    waypoints: stylePath(octilinearize(t.waypoints), makeRng(seed * 131 + i + 1)),
    cornerRadius: 0.5,
  }))
  const paths = routes.length ? routes : [{ waypoints: [[1, 1], [actualBoard.cols - 2, actualBoard.rows - 2]] as Cell[], cornerRadius: 0.5 }]
  const { spots, specialSpots } = tileSpots({ board: actualBoard, routes: paths, difficulty })
  const { decor, nets } = buildDecorWithNets({ board: actualBoard, trace: paths, spots, specialSpots, seed })
  const trace = paths[0]
  const copper = routeCopper({
    decor, nets, board: actualBoard, trace, paths,
    spots: [...spots, ...specialSpots].map((s) => s.cell),
  })
  return {
    version: 1,
    board: actualBoard,
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
