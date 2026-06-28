import type { Board, Level } from '../model/level'
import type { Cell } from '../geom/types'
import { routeOctilinear } from '../geom/router'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from './spots'
import { growDecor } from './decor'
import { makeRng } from './rng'

function minSpots(difficulty: number): number { return Math.max(4, 6 + difficulty) }

export function generateLevel(params: { board: Board; difficulty: number; seed: number }): Level {
  const { board, difficulty, seed } = params
  const rng = makeRng(seed)
  const start: Cell = [1, 1 + Math.floor(rng() * (board.rows - 2))]
  const goal: Cell = [board.cols - 2, 1 + Math.floor(rng() * (board.rows - 2))]
  const wander = Math.min(0.9, 0.2 + difficulty * 0.1)
  const turnPenalty = 1 + (1 - wander)

  let raw = routeOctilinear({ cols: board.cols, rows: board.rows, start, goal, wander, turnPenalty })
  // Guaranteed: empty board always has a path; fall back to straight route if router is over-constrained.
  if (!raw) raw = routeOctilinear({ cols: board.cols, rows: board.rows, start, goal })!
  const waypoints = octilinearize(raw)

  const budget = minSpots(difficulty) + 6
  const { spots, specialSpots } = computeTowerSpots({ board, trace: { waypoints, cornerRadius: 0.5 }, budget })
  const decor = growDecor({ board, trace: { waypoints, cornerRadius: 0.5 }, spots, specialSpots, seed })

  return {
    version: 1,
    board,
    seed,
    trace: { waypoints, cornerRadius: 0.5 },
    spots,
    specialSpots,
    decor,
    meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty },
  }
}
