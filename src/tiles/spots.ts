import type { Board, Trace, TowerSpot } from '../model/level'
import { computeTowerSpots, minSpots } from '../pipeline/spots'

export function tileSpots(args: { board: Board; routes: Trace[]; difficulty: number }): { spots: TowerSpot[]; specialSpots: TowerSpot[] } {
  const target = minSpots(args.difficulty)
  const attempts = [
    { budget: target + 6, minSeparation: 3, rangeCells: 4 },
    { budget: target + 12, minSeparation: 2, rangeCells: 5 },
    { budget: target + 24, minSeparation: 1, rangeCells: 6 },
  ]
  let spots: TowerSpot[] = [], specialSpots: TowerSpot[] = []
  for (const a of attempts) {
    const res = computeTowerSpots({ board: args.board, trace: args.routes, budget: a.budget, minSeparation: a.minSeparation, rangeCells: a.rangeCells })
    spots = res.spots; specialSpots = res.specialSpots
    if (spots.length + specialSpots.length >= target) break
  }
  return { spots, specialSpots }
}
