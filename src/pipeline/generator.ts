import type { Board, Level, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { routeOctilinear } from '../geom/router'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from './spots'
import { growDecor } from './decor'
import { makeRng } from './rng'

export function minSpots(difficulty: number): number { return Math.max(4, 6 + difficulty) }

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

  const target = minSpots(difficulty)
  const trace = { waypoints, cornerRadius: 0.5 }
  const attempts = [
    { budget: target + 6,  minSeparation: 3, rangeCells: 4 },
    { budget: target + 12, minSeparation: 2, rangeCells: 5 },
    { budget: target + 24, minSeparation: 1, rangeCells: 6 },
  ]
  let spots: TowerSpot[] = [], specialSpots: TowerSpot[] = []
  for (const a of attempts) {
    const res = computeTowerSpots({ board, trace, budget: a.budget, minSeparation: a.minSeparation, rangeCells: a.rangeCells })
    spots = res.spots; specialSpots = res.specialSpots
    if (spots.length + specialSpots.length >= target) break
  }
  const decor = growDecor({ board, trace, spots, specialSpots, seed })

  return {
    version: 1,
    board,
    seed,
    trace,
    spots,
    specialSpots,
    decor,
    meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty },
  }
}
