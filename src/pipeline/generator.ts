import type { Board, Level, Trace, TowerSpot } from '../model/level'
import type { Cell } from '../geom/types'
import { octilinearize } from '../geom/octilinear'
import { routeOctilinear } from '../geom/router'
import { computeTowerSpots, minSpots } from './spots'
import { buildDecorWithNets } from './decor'
import { routeCopper } from './copper'
import { makeRng } from './rng'

export { minSpots } from './spots'

// ── Single-path builders (each returns Cell[][] with one element) ────────────

// Horizontal-lane boustrophedon: full-width horizontal lanes stacked top→bottom, joined by
// vertical connectors at alternating ends. Pacing: tight hairpins in the middle third
// (double-coverage chokes), wider near the ends.
// START: left side, top lane. FINISH: left or right depending on lane parity.
function buildSerpentineH(board: Board, difficulty: number, rng: () => number): Cell[][] {
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
    if (t > 0.4 && t < 0.78)      gap = r < 0.6 ? 2 : 3
    else if (t < 0.2 || t > 0.85) gap = 4 + Math.floor(r * 3)
    else                            gap = 3 + Math.floor(r * 2)
    y += gap
  }
  const top = m, bottom = board.rows - 1 - m
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
  return [wp]
}

// Vertical-lane boustrophedon: columns swept left→right, joined at alternating top/bottom ends.
function buildSerpentineV(board: Board, difficulty: number, rng: () => number): Cell[][] {
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
  const left = m, right = board.cols - 1 - m
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
  return [wp]
}

// Inward rectangular spiral: outer top-left → right → down → left → up, inset by `gap` each lap.
function buildSpiral(board: Board, _difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const gap = 3 + Math.floor(rng() * 2)

  let l = m, t = m, r = board.cols - 1 - m, b = board.rows - 1 - m
  const wp: Cell[] = [[l, t]]

  while (true) {
    if (r - l < gap + 1 || b - t < 1) break
    wp.push([r, t])
    wp.push([r, b])
    const nextL = l + gap
    if (nextL >= r - gap) break
    wp.push([nextL, b])
    const nextT = t + gap
    if (nextT >= b - gap) break
    wp.push([nextL, nextT])
    l = nextL; t = nextT; r -= gap; b -= gap
  }
  return [wp]
}

// Organic: bendy, irregular single path from one corner to the opposite via random intermediate
// waypoints (interpolated toward goal + random jitter). octilinearize handles corner insertion.
// Looks hand-drawn; distinct across seeds due to rng-driven jitter offsets.
function buildOrganic(board: Board, _difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows
  const numSeg = 8 + Math.floor(rng() * 5) // 8–12 intermediate segments

  const start: Cell = [m + Math.floor(rng() * 3), m + Math.floor(rng() * 3)]
  const finish: Cell = [cols - 1 - m - Math.floor(rng() * 3), rows - 1 - m - Math.floor(rng() * 3)]

  const wp: Cell[] = [start]
  let cx = start[0], cy = start[1]
  const gx = finish[0], gy = finish[1]

  for (let s = 1; s < numSeg; s++) {
    // Blend toward goal + jitter
    const frac = s / numSeg
    const bx = Math.round(cx + (gx - cx) * (1 / (numSeg - s + 1)))
    const by = Math.round(cy + (gy - cy) * (1 / (numSeg - s + 1)))
    const jx = Math.round((rng() - 0.4) * 14)
    const jy = Math.round((rng() - 0.4) * 10)
    void frac // used conceptually for the blend
    const nx = Math.max(m, Math.min(cols - 1 - m, bx + jx))
    const ny = Math.max(m, Math.min(rows - 1 - m, by + jy))
    if (nx !== cx || ny !== cy) { wp.push([nx, ny]); cx = nx; cy = ny }
  }
  wp.push(finish)
  return [wp]
}

// Ring: spawn taps in from left edge, travels around a big rectangle (one full loop),
// then exits inward to a FINISH near center. One polyline.
function buildRing(board: Board, _difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows
  const l = m + Math.floor(rng() * 2)
  const t = m + Math.floor(rng() * 2)
  const r = cols - 1 - m - Math.floor(rng() * 2)
  const b = rows - 1 - m - Math.floor(rng() * 2)

  const midY = Math.round((t + b) / 2)
  const cx = Math.round((l + r) / 2)
  const cy = Math.round((t + b) / 2)

  // Entry on left edge; travels CW around perimeter; nearly closes; exits to center.
  const wp: Cell[] = [
    [l, midY],          // spawn (left edge, mid-height)
    [l, t],             // top-left corner
    [r, t],             // top-right corner
    [r, b],             // bottom-right corner
    [l, b],             // bottom-left corner
    [l, midY + 2],      // nearly closes the loop (slightly past entry)
    [cx, cy],           // exits inward to center (FINISH)
  ]
  return [wp]
}

// Zigzag: alternating 45° diagonal runs and short orthogonal steps, corner-to-corner.
// Visibly diagonal, unlike the orthogonal serpentines.
function buildZigzag(board: Board, difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows
  const numDiags = 4 + Math.floor(difficulty / 2)

  const x0 = m + 1, y0 = m + 1
  const xN = cols - 2 - m, yN = rows - 2 - m

  const diagLen = Math.max(4, Math.floor(Math.min(xN - x0, yN - y0) / numDiags * 0.8))
  const orthoBase = 3 + Math.floor(rng() * 3)  // 3–5

  const wp: Cell[] = [[x0, y0]]
  let cx = x0, cy = y0
  let stepDir = 0  // 0=right, 1=down

  while (cx < xN - 2 && cy < yN - 2) {
    // Diagonal run (down-right)
    const dMax = Math.min(diagLen, Math.min(xN - cx, yN - cy))
    if (dMax <= 0) break
    cx += dMax; cy += dMax
    wp.push([cx, cy])

    if (cx >= xN - 2 || cy >= yN - 2) break

    // Short orthogonal step
    const orthoLen = orthoBase + Math.floor(rng() * 2)
    if (stepDir === 0) {
      cx = Math.min(cx + orthoLen, xN - 2)
    } else {
      cy = Math.min(cy + orthoLen, yN - 2)
    }
    wp.push([cx, cy])
    stepDir = 1 - stepDir
  }

  // Close to opposite corner
  const d = Math.min(xN - cx, yN - cy)
  if (d > 0) { cx += d; cy += d; wp.push([cx, cy]) }
  if (cx < xN) wp.push([xN, cy])
  if (cy < yN) wp.push([cx, yN])

  return [wp]
}

// ── Multi-path builders ──────────────────────────────────────────────────────

// Branching: trunk from START to a fork, TWO distinct branches (upper/lower) that reconverge
// at a merge cell, then trunk to FINISH. Both paths share START, fork, merge, FINISH cells.
// Branch lengths within ~15% of each other.
function buildBranching(board: Board, _difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows
  const midY = Math.floor(rows / 2)

  const start: Cell = [m, midY]
  const finish: Cell = [cols - 1 - m, midY]

  const forkX = Math.floor(cols * 0.28) + Math.floor(rng() * 5)
  const mergeX = Math.floor(cols * 0.72) - Math.floor(rng() * 5)
  const fork: Cell = [forkX, midY]
  const merge: Cell = [mergeX, midY]
  const midX = Math.floor((forkX + mergeX) / 2)

  // Branches span at least 70% of the board height to satisfy bounding-box test.
  // aY near top, bY near bottom. Tiny jitter (≤2 cells) keeps span >70% of board height.
  const jitter = Math.floor(rows * 0.06)  // ≤ 2 for rows=36
  const aY = Math.max(m + 1, Math.floor(rows * 0.10) + Math.floor(rng() * (jitter + 1)))
  const bY = Math.min(rows - 2 - m, Math.floor(rows * 0.90) - Math.floor(rng() * (jitter + 1)))

  const pathA: Cell[] = [start, fork, [forkX, aY], [midX, aY], [mergeX, aY], merge, finish]
  const pathB: Cell[] = [start, fork, [forkX, bY], [midX, bY], [mergeX, bY], merge, finish]
  return [pathA, pathB]
}

// MultiSpawn: N independent spawns (N = clamp(2, 1+floor(difficulty/2), 4)) at different
// corners, each an octilinear A* route converging on ONE shared base/FINISH cell.
// Spawns are paired from opposite corners first to guarantee the bounding box spans the board.
function buildMultiSpawn(board: Board, difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows
  const N = Math.min(4, Math.max(2, 1 + Math.floor(difficulty / 2)))

  const base: Cell = [Math.floor(cols / 2), Math.floor(rows / 2)]

  // For N=2 we must ensure the first two spawns are diagonally opposite (guarantees
  // x AND y bounding-box coverage). Use one of the two diagonal pairs, chosen by rng.
  const useTLBR = rng() < 0.5
  const orderedCorners: Cell[] = useTLBR
    ? [[m, m], [cols - 1 - m, rows - 1 - m], [cols - 1 - m, m], [m, rows - 1 - m]]
    : [[cols - 1 - m, m], [m, rows - 1 - m], [m, m], [cols - 1 - m, rows - 1 - m]]

  const blocked = new Set<string>()
  const paths: Cell[][] = []

  for (let i = 0; i < N; i++) {
    const spawn = orderedCorners[i]
    const raw = routeOctilinear({
      cols, rows, start: spawn, goal: base,
      blocked, wander: 0.15, turnPenalty: 0.4,
    })
    const path = raw ?? [spawn, base]
    paths.push(path)
    // Block cells of this path (except base) so next routes diverge
    for (let ci = 0; ci < path.length - 1; ci++)
      blocked.add(`${path[ci][0]},${path[ci][1]}`)
  }

  return paths
}

// MultiLane: N (2–3) independent parallel top-to-bottom paths, spread across full board width.
// Each has its own spawn (top edge) and exit (bottom edge).
function buildMultiLane(board: Board, _difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows
  const N = 2 + Math.floor(rng() * 2)  // 2 or 3

  const paths: Cell[][] = []
  for (let i = 0; i < N; i++) {
    const xFrac = N === 1 ? 0.5 : i / (N - 1)
    const x = Math.round(m + xFrac * (cols - 1 - 2 * m))
    // Slight horizontal jitter at midpoint for visual variety
    const midJx = Math.floor((rng() - 0.5) * 8)
    const midX = Math.max(m, Math.min(cols - 1 - m, x + midJx))
    const midY = Math.floor(rows / 2)
    paths.push([
      [x, m],
      [midX, midY],
      [x, rows - 1 - m],
    ])
  }
  return paths
}

// Cross: TWO paths that intersect at a central junction (X / +).
// One runs left→right, one top→bottom, both through the junction cell.
function buildCross(board: Board, _difficulty: number, rng: () => number): Cell[][] {
  const m = 2
  const cols = board.cols, rows = board.rows

  const jx = Math.floor((rng() - 0.5) * 8)
  const jy = Math.floor((rng() - 0.5) * 6)
  const cx = Math.floor(cols / 2) + jx
  const cy = Math.floor(rows / 2) + jy

  const pathH: Cell[] = [[m, cy], [cx, cy], [cols - 1 - m, cy]]
  const pathV: Cell[] = [[cx, m], [cx, cy], [cx, rows - 1 - m]]
  return [pathH, pathV]
}

// ── Archetype registry ──────────────────────────────────────────────────────

export const ARCHETYPES = [
  'serpentineH', 'serpentineV', 'spiral',
  'organic', 'ring', 'zigzag',
  'branching', 'multiSpawn', 'multiLane', 'cross',
] as const
export type ArchetypeName = typeof ARCHETYPES[number]

type Builder = (board: Board, difficulty: number, rng: () => number) => Cell[][]

const BUILDERS: Record<ArchetypeName, Builder> = {
  serpentineH: buildSerpentineH,
  serpentineV:  buildSerpentineV,
  spiral:       buildSpiral,
  organic:      buildOrganic,
  ring:         buildRing,
  zigzag:       buildZigzag,
  branching:    buildBranching,
  multiSpawn:   buildMultiSpawn,
  multiLane:    buildMultiLane,
  cross:        buildCross,
}

function selectArchetype(rng: () => number, difficulty: number, override?: string): ArchetypeName {
  if (override && (ARCHETYPES as readonly string[]).includes(override))
    return override as ArchetypeName

  // Bias: simple single-path archetypes at low difficulty, complex/multi-path at high
  const weights: number[] = ARCHETYPES.map((arch) => {
    const isSimple   = ['serpentineH', 'serpentineV', 'spiral', 'ring', 'zigzag'].includes(arch)
    const isComplex  = ['branching', 'multiSpawn', 'multiLane', 'cross'].includes(arch)
    if (difficulty <= 2) return isSimple ? 3 : 1
    if (difficulty >= 7) return isComplex ? 3 : 1
    return 2  // equal weight at medium difficulty (ensures good archetype spread)
  })

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
  const rawPaths = BUILDERS[archetype](board, difficulty, rng)

  // Convert raw waypoint arrays → Trace[], octilinearizing each path
  const paths: Trace[] = rawPaths.map(wp => ({ waypoints: octilinearize(wp), cornerRadius: 0.5 }))
  const trace = paths[0]

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
      board, trace: paths, budget: a.budget,
      minSeparation: a.minSeparation, rangeCells: a.rangeCells,
    })
    spots = res.spots
    specialSpots = res.specialSpots
    if (spots.length + specialSpots.length >= target) break
  }

  const { decor, nets } = buildDecorWithNets({ board, trace: paths, spots, specialSpots, seed })
  const copper = routeCopper({ decor, nets, board, trace, paths })

  return {
    version: 1,
    board,
    seed,
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
