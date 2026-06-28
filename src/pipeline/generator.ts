import type { Board, Level, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from './spots'
import { growDecor } from './decor'
import { makeRng } from './rng'

export function minSpots(difficulty: number): number {
  return Math.max(4, 6 + difficulty)
}

// Orthogonal boustrophedon: full-width horizontal lanes stacked top->bottom, joined by vertical
// connectors at alternating ends. Lane gaps vary by pacing: tight hairpins in the middle third
// (double-coverage chokes), wider/open near the ends.
function buildSerpentine(board: Board, difficulty: number, rng: () => number): Cell[] {
  const m = 2
  const lanes = Math.max(4, Math.min(8, 4 + Math.floor(difficulty / 1.5)))
  const xL = m + Math.floor(rng() * 2)
  const xR = board.cols - 1 - m - Math.floor(rng() * 2)

  const ys: number[] = []
  let y = m + Math.floor(rng() * 2)
  for (let i = 0; i < lanes; i++) {
    ys.push(y)
    const t = lanes > 1 ? i / (lanes - 1) : 0
    const r = rng()
    let gap: number
    if (t > 0.4 && t < 0.78) gap = r < 0.6 ? 2 : 3            // hairpin / double-coverage zone (mid)
    else if (t < 0.2 || t > 0.85) gap = 4 + Math.floor(r * 3) // open near the ends
    else gap = 3 + Math.floor(r * 2)                          // medium
    y += gap
  }
  // keep all lanes inside the board (compress proportionally if the stack overran)
  const maxY = board.rows - 1 - m
  if (ys[ys.length - 1] > maxY) {
    const span = ys[ys.length - 1] - ys[0] || 1
    const scale = (maxY - ys[0]) / span
    for (let i = 0; i < ys.length; i++) ys[i] = Math.round(ys[0] + (ys[i] - ys[0]) * scale)
  }

  const wp: Cell[] = []
  for (let i = 0; i < lanes; i++) {
    const leftFirst = i % 2 === 0
    const a: Cell = leftFirst ? [xL, ys[i]] : [xR, ys[i]]
    const b: Cell = leftFirst ? [xR, ys[i]] : [xL, ys[i]]
    wp.push(a, b)
  }
  return wp
}

export function generateLevel(params: { board: Board; difficulty: number; seed: number }): Level {
  const { board, difficulty, seed } = params
  const rng = makeRng(seed)

  const waypoints = octilinearize(buildSerpentine(board, difficulty, rng))
  const trace = { waypoints, cornerRadius: 0.5 }

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
