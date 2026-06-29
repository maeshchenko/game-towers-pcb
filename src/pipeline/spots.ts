import type { Board, Trace, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { cellKey } from '../geom/grid'
import { pathSamples, coverage } from '../geom/sampling'

function pathCellSet(trace: Trace): Set<string> {
  const set = new Set<string>()
  const wp = trace.waypoints
  for (let i = 1; i < wp.length; i++) {
    const a = wp[i - 1], b = wp[i]
    const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))
    for (let k = 0; k <= steps; k++) {
      const t = steps === 0 ? 0 : k / steps
      set.add(cellKey([Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)]))
    }
  }
  return set
}

function normalizeTraces(trace: Trace | Trace[]): Trace[] {
  return Array.isArray(trace) ? trace : [trace]
}

export function computeTowerSpots(args: {
  board: Board; trace: Trace | Trace[]; budget: number
  rangeCells?: number; minSeparation?: number; specialEvery?: number
}): { spots: TowerSpot[]; specialSpots: TowerSpot[] } {
  const rangeCells = args.rangeCells ?? 4
  const minSeparation = args.minSeparation ?? 3
  const specialEvery = args.specialEvery ?? 5
  const traces = normalizeTraces(args.trace)
  // Union of all path samples (for coverage scoring across all paths)
  const allSamples = traces.flatMap(t => pathSamples(t.waypoints, args.board.pitch))
  // Union of all path cells (for exclusion)
  const onPath = new Set<string>()
  for (const t of traces) for (const k of pathCellSet(t)) onPath.add(k)
  const samples = allSamples

  const candidates: { cell: Cell; score: number }[] = []
  for (let x = 0; x < args.board.cols; x++)
    for (let y = 0; y < args.board.rows; y++) {
      const cell: Cell = [x, y]
      if (onPath.has(cellKey(cell))) continue
      const score = coverage(cell, rangeCells, samples, args.board.pitch)
      if (score > 0) candidates.push({ cell, score })
    }
  candidates.sort((a, b) => b.score - a.score)

  const chosen: { cell: Cell; score: number }[] = []
  for (const cand of candidates) {
    if (chosen.length >= args.budget) break
    const tooClose = chosen.some((c) =>
      Math.hypot(c.cell[0] - cand.cell[0], c.cell[1] - cand.cell[1]) < minSeparation)
    if (!tooClose) chosen.push(cand)
  }

  const spots: TowerSpot[] = []
  const specialSpots: TowerSpot[] = []
  chosen.forEach((c, i) => {
    if ((i + 1) % specialEvery === 0) specialSpots.push({ cell: c.cell, score: c.score, kind: 'special' })
    else spots.push({ cell: c.cell, score: c.score, kind: 'build' })
  })
  return { spots, specialSpots }
}
