import type { Board, Level, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from './spots'
import { buildDecorWithNets } from './decor'
import { routeCopper } from './copper'
import { makeRng } from './rng'

export function minSpots(difficulty: number): number {
  return Math.max(4, 6 + difficulty)
}

// Horizontal-lane boustrophedon: full-width horizontal lanes stacked top→bottom, joined by
// vertical connectors at alternating ends. Pacing: tight hairpins in the middle third
// (double-coverage chokes), wider near the ends.
// START: left side, top lane. FINISH: left or right depending on lane parity.
function buildSerpentineH(board: Board, difficulty: number, rng: () => number): Cell[] {
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
    if (t > 0.4 && t < 0.78)      gap = r < 0.6 ? 2 : 3            // hairpin / double-coverage zone (mid)
    else if (t < 0.2 || t > 0.85) gap = 4 + Math.floor(r * 3)      // open near the ends
    else                            gap = 3 + Math.floor(r * 2)      // medium
    y += gap
  }
  // Normalize lanes to span the full board height, preserving relative gap proportions.
  const top = m
  const bottom = board.rows - 1 - m
  const span = ys[ys.length - 1] - ys[0] || 1
  for (let i = 0; i < ys.length; i++)
    ys[i] = Math.round(top + ((ys[i] - ys[0]) / span) * (bottom - top))

  const wp: Cell[] = []
  for (let i = 0; i < lanes; i++) {
    const leftFirst = i % 2 === 0
    const a: Cell = leftFirst ? [xL, ys[i]] : [xR, ys[i]]
    const b: Cell = leftFirst ? [xR, ys[i]] : [xL, ys[i]]
    wp.push(a, b)
  }
  return wp
}

// Vertical-lane boustrophedon: columns swept left→right, joined at alternating top/bottom ends.
// Pacing: tight column gaps in middle third (hairpins), wider near the ends.
// START: top-left. FINISH: right side (top or bottom depending on lane parity).
function buildSerpentineV(board: Board, difficulty: number, rng: () => number): Cell[] {
  const m = 2
  const lanes = Math.max(4, Math.min(8, 4 + Math.floor(difficulty / 1.5)))
  const yT = m + Math.floor(rng() * 2)
  const yB = board.rows - 1 - m - Math.floor(rng() * 2)

  const xs: number[] = []
  let x = m + Math.floor(rng() * 2)
  for (let i = 0; i < lanes; i++) {
    xs.push(x)
    const t = lanes > 1 ? i / (lanes - 1) : 0
    const r = rng()
    let gap: number
    if (t > 0.4 && t < 0.78)      gap = r < 0.6 ? 2 : 3
    else if (t < 0.2 || t > 0.85) gap = 4 + Math.floor(r * 3)
    else                            gap = 3 + Math.floor(r * 2)
    x += gap
  }
  // Normalize xs to span full board width (left margin → right margin).
  const left = m
  const right = board.cols - 1 - m
  const span = xs[xs.length - 1] - xs[0] || 1
  for (let i = 0; i < xs.length; i++)
    xs[i] = Math.round(left + ((xs[i] - xs[0]) / span) * (right - left))

  const wp: Cell[] = []
  for (let i = 0; i < lanes; i++) {
    const topFirst = i % 2 === 0
    const a: Cell = topFirst ? [xs[i], yT] : [xs[i], yB]
    const b: Cell = topFirst ? [xs[i], yB] : [xs[i], yT]
    wp.push(a, b)
  }
  // All connectors between consecutive lanes share a y value → already octilinear.
  return wp
}

// Inward rectangular spiral: outer top-left → right → down → left → up, inset by `gap` each lap.
// All segments are purely horizontal or vertical → each consecutive pair is already octilinear.
// Ring gap ≥ 3 ensures tower range covers cells between rings (double coverage).
// START: outer top-left. FINISH: near board center (last reachable ring point).
function buildSpiral(board: Board, _difficulty: number, rng: () => number): Cell[] {
  const m = 2
  const gap = 3 + Math.floor(rng() * 2) // 3 or 4

  let l = m, t = m, r = board.cols - 1 - m, b = board.rows - 1 - m
  const wp: Cell[] = [[l, t]] // START = outer top-left

  while (true) {
    if (r - l < gap + 1 || b - t < 1) break // ring too small to be meaningful
    wp.push([r, t]) // → right along top
    wp.push([r, b]) // ↓ down along right side
    const nextL = l + gap
    if (nextL >= r - gap) break
    wp.push([nextL, b]) // ← left along bottom to next ring's left
    const nextT = t + gap
    if (nextT >= b - gap) break
    wp.push([nextL, nextT]) // ↑ up along left to next ring's top
    l = nextL; t = nextT; r -= gap; b -= gap
  }
  return wp
}

// ── Archetype registry ──────────────────────────────────────────────────────

export const ARCHETYPES = ['serpentineH', 'serpentineV', 'spiral'] as const
export type ArchetypeName = typeof ARCHETYPES[number]

function selectArchetype(rng: () => number, difficulty: number, override?: string): ArchetypeName {
  if (override && (ARCHETYPES as readonly string[]).includes(override))
    return override as ArchetypeName
  // Slight spiral bias at difficulty ≥ 5
  const weights = difficulty >= 5 ? [1, 1, 2] : [1, 1, 1]
  const total = weights.reduce((a, b) => a + b, 0)
  const pick = rng() * total
  let acc = 0
  for (let i = 0; i < ARCHETYPES.length; i++) {
    acc += weights[i]
    if (pick < acc) return ARCHETYPES[i]
  }
  return ARCHETYPES[0]
}

// ── Main entry point ────────────────────────────────────────────────────────

export function generateLevel(params: {
  board: Board; difficulty: number; seed: number; archetype?: string
}): Level {
  const { board, difficulty, seed, archetype: archetypeOverride } = params
  const rng = makeRng(seed)

  const archetype = selectArchetype(rng, difficulty, archetypeOverride)
  let rawWaypoints: Cell[]
  if (archetype === 'serpentineV')       rawWaypoints = buildSerpentineV(board, difficulty, rng)
  else if (archetype === 'spiral')       rawWaypoints = buildSpiral(board, difficulty, rng)
  else /* serpentineH */                 rawWaypoints = buildSerpentineH(board, difficulty, rng)

  const waypoints = octilinearize(rawWaypoints)
  const trace = { waypoints, cornerRadius: 0.5 }

  const target = minSpots(difficulty)
  const attempts = [
    { budget: target + 6,  minSeparation: 3, rangeCells: 4 },
    { budget: target + 12, minSeparation: 2, rangeCells: 5 },
    { budget: target + 24, minSeparation: 1, rangeCells: 6 },
  ]
  let spots: TowerSpot[] = []
  let specialSpots: TowerSpot[] = []
  for (const a of attempts) {
    const res = computeTowerSpots({
      board, trace, budget: a.budget,
      minSeparation: a.minSeparation, rangeCells: a.rangeCells,
    })
    spots = res.spots
    specialSpots = res.specialSpots
    if (spots.length + specialSpots.length >= target) break
  }

  const { decor, nets } = buildDecorWithNets({ board, trace, spots, specialSpots, seed })
  const copper = routeCopper({ decor, nets, board, trace })

  return {
    version: 1,
    board,
    seed,
    trace,
    spots,
    specialSpots,
    decor,
    nets,
    copper,
    meta: { name: `Level ${difficulty.toString().padStart(2, '0')}`, difficulty, archetype },
  }
}
