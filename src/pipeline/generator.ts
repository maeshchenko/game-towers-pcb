import type { Board, Level, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { routeOctilinear } from '../geom/router'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from './spots'
import { growDecor } from './decor'
import { makeRng } from './rng'

export function minSpots(difficulty: number): number {
  return Math.max(4, 6 + difficulty)
}

// Serpentine waypoints: x sweeps left→right; y alternates top/bottom band with jitter.
function buildWaypoints(board: Board, difficulty: number, rng: () => number): Cell[] {
  const m = 2
  const segments = Math.max(4, Math.min(10, 4 + Math.floor(difficulty / 1.5)))
  const startTop = rng() < 0.5
  const wp: Cell[] = []
  for (let i = 0; i <= segments; i++) {
    const tx = i / segments
    const x = Math.round(m + tx * (board.cols - 1 - 2 * m))
    const top = m + Math.floor(rng() * 3)
    const bot = board.rows - 1 - m - Math.floor(rng() * 3)
    const atTop = startTop ? i % 2 === 0 : i % 2 === 1
    wp.push([x, atTop ? top : bot])
  }
  return wp
}

// A* each consecutive leg; concatenate contiguously; block used cells so the path never crosses itself.
function routeThrough(board: Board, waypoints: Cell[]): Cell[] {
  const blocked = new Set<string>()
  const full: Cell[] = []
  for (let i = 1; i < waypoints.length; i++) {
    const a = full.length === 0 ? waypoints[0] : full[full.length - 1]
    const b = waypoints[i]
    blocked.delete(cellKey(a))
    let leg = routeOctilinear({ cols: board.cols, rows: board.rows, start: a, goal: b, blocked, turnPenalty: 2, wander: 0.35 })
    if (!leg) leg = routeOctilinear({ cols: board.cols, rows: board.rows, start: a, goal: b })
    if (!leg) continue
    const from = full.length === 0 ? 0 : 1
    for (let k = from; k < leg.length; k++) {
      full.push(leg[k])
      blocked.add(cellKey(leg[k]))
    }
  }
  return full
}

export function generateLevel(params: { board: Board; difficulty: number; seed: number }): Level {
  const { board, difficulty, seed } = params
  const rng = makeRng(seed)

  const waypoints = buildWaypoints(board, difficulty, rng)
  let routed = routeThrough(board, waypoints)
  if (routed.length < 2) {
    routed = routeOctilinear({ cols: board.cols, rows: board.rows, start: [1, 1], goal: [board.cols - 2, board.rows - 2] })!
  }
  const trace = { waypoints: octilinearize(routed), cornerRadius: 0.5 }

  const target = minSpots(difficulty)
  const attempts = [
    { budget: target + 6, minSeparation: 3, rangeCells: 4 },
    { budget: target + 12, minSeparation: 2, rangeCells: 5 },
    { budget: target + 24, minSeparation: 1, rangeCells: 6 },
  ]
  let spots: TowerSpot[] = []
  let specialSpots: TowerSpot[] = []
  for (const a of attempts) {
    const res = computeTowerSpots({ board, trace, budget: a.budget, minSeparation: a.minSeparation, rangeCells: a.rangeCells })
    spots = res.spots
    specialSpots = res.specialSpots
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
