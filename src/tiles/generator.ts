import type { Board } from '../model/level'
import type { Port, TileGrid } from './types'
import { emptyGrid, layPath, setTile, rotForPorts } from './layout'
import { makeRng } from '../pipeline/rng'

const ARCHES = ['serpentineH', 'serpentineV', 'spiral', 'branching', 'multiSpawn', 'cross'] as const
type Arch = typeof ARCHES[number]

function dims(board: Board): { tcols: number; trows: number; size: number } {
  const size = 6
  return { size, tcols: Math.max(5, Math.floor(board.cols / size)), trows: Math.max(5, Math.floor(board.rows / size)) }
}

// horizontal boustrophedon over tile rows
function serpentineH(g: TileGrid): void {
  const coords: [number, number][] = []
  const xL = 1, xR = g.tcols - 2
  const lanes = Math.min(g.trows - 2, Math.max(3, g.trows - 2))
  for (let i = 0; i < lanes; i++) {
    const row = Math.round(1 + (i / Math.max(1, lanes - 1)) * (g.trows - 3))
    if (i % 2 === 0) for (let x = xL; x <= xR; x++) coords.push([x, row])
    else for (let x = xR; x >= xL; x--) coords.push([x, row])
    if (i < lanes - 1) {
      const x = i % 2 === 0 ? xR : xL
      const nrow = Math.round(1 + ((i + 1) / Math.max(1, lanes - 1)) * (g.trows - 3))
      for (let y = row + 1; y < nrow; y++) coords.push([x, y])
    }
  }
  const clean = coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  layPath(g, clean)
}

function serpentineV(g: TileGrid): void {
  const coords: [number, number][] = []
  const yT = 1, yB = g.trows - 2
  const lanes = Math.max(3, g.tcols - 2)
  for (let i = 0; i < lanes; i++) {
    const col = Math.round(1 + (i / Math.max(1, lanes - 1)) * (g.tcols - 3))
    if (i % 2 === 0) for (let y = yT; y <= yB; y++) coords.push([col, y])
    else for (let y = yB; y >= yT; y--) coords.push([col, y])
    if (i < lanes - 1) {
      const y = i % 2 === 0 ? yB : yT
      const ncol = Math.round(1 + ((i + 1) / Math.max(1, lanes - 1)) * (g.tcols - 3))
      for (let x = col + 1; x < ncol; x++) coords.push([x, y])
    }
  }
  const clean = coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  layPath(g, clean)
}

function spiral(g: TileGrid): void {
  let l = 1, r = g.tcols - 2, t = 1, b = g.trows - 2
  const coords: [number, number][] = []
  while (l <= r && t <= b) {
    for (let x = l; x <= r; x++) coords.push([x, t])
    for (let y = t + 1; y <= b; y++) coords.push([r, y])
    if (t < b) for (let x = r - 1; x >= l; x--) coords.push([x, b])
    if (l < r) for (let y = b - 1; y >= t + 1; y--) coords.push([l, y])
    l += 2; r -= 2; t += 2; b -= 2
  }
  const clean = coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
  layPath(g, clean)
}

function dedup(coords: [number, number][]): [number, number][] {
  return coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1])
}
const col = (x: number, ys: number[]): [number, number][] => ys.map((y) => [x, y] as [number, number])
const row = (y: number, xs: number[]): [number, number][] => xs.map((x) => [x, y] as [number, number])

// branching: START → forkA (split) → up & down branches → forkB (merge) → single FINISH.
// Both compiled routes share START (left, midY) and FINISH (right, midY).
function branching(g: TileGrid): void {
  const midY = Math.floor(g.trows / 2)
  const top = 1, bot = g.trows - 2
  const fxA = Math.max(2, Math.floor(g.tcols / 3))
  const fxB = Math.min(g.tcols - 3, Math.max(fxA + 2, Math.floor((2 * g.tcols) / 3)))
  setTile(g, fxA, midY, { type: 'fork', rot: rotForPorts('fork', ['W', 'N', 'S']) }) // split
  setTile(g, fxB, midY, { type: 'fork', rot: rotForPorts('fork', ['N', 'S', 'E']) }) // merge
  const up = dedup([
    ...row(midY, range(1, fxA)),           // START → forkA
    ...col(fxA, range(midY - 1, top)),     // up
    ...row(top, range(fxA + 1, fxB)),      // across top
    ...col(fxB, range(top + 1, midY)),     // down → forkB
    ...row(midY, range(fxB + 1, g.tcols - 2)), // forkB → FINISH
  ])
  const down = dedup([
    ...row(midY, range(1, fxA)),
    ...col(fxA, range(midY + 1, bot)),     // down
    ...row(bot, range(fxA + 1, fxB)),      // across bottom
    ...col(fxB, range(bot - 1, midY)),     // up → forkB
    ...row(midY, range(fxB + 1, g.tcols - 2)),
  ])
  layPath(g, up)
  layPath(g, down)
}

// multiSpawn: N START tiles (left, different rows) → a vertical collector spine with merge
// forks → one shared FINISH (right). Every compiled route ends at the same finish cell.
function multiSpawn(g: TileGrid, n: number): void {
  const count = Math.min(3, Math.max(2, n))
  const sx = Math.max(3, g.tcols - 3)
  const rows: number[] = []
  for (let i = 0; i < count; i++) rows.push(Math.round(1 + (i / (count - 1)) * (g.trows - 3)))
  const uniq = [...new Set(rows)].sort((a, b) => a - b)
  const finishRow = uniq[uniq.length - 1]
  // pre-place merge forks on the spine (all joins except the topmost, which layPath makes a corner)
  for (let i = 1; i < uniq.length; i++) {
    const r = uniq[i]
    const ports: Port[] = i === uniq.length - 1 ? ['W', 'N', 'E'] : ['W', 'N', 'S']
    setTile(g, sx, r, { type: 'fork', rot: rotForPorts('fork', ports) })
  }
  // each start: horizontal in → down the spine → horizontal out to the shared finish
  for (const r of uniq) {
    const chain = dedup([
      ...row(r, range(1, sx)),                                   // START → spine join
      ...(r < finishRow ? col(sx, range(r + 1, finishRow)) : []), // down the spine (none for bottom row)
      ...row(finishRow, range(sx + 1, g.tcols - 2)),            // → shared FINISH
    ])
    layPath(g, chain)
  }
}

// cross: two routes CROSS through a central bridge, then MERGE (fork) to ONE shared finish.
// Two spawns, one base — satisfies the global "one finish for all routes" invariant.
function cross(g: TileGrid): void {
  const cx = Math.floor(g.tcols / 2), cy = Math.floor(g.trows / 2)
  const mx = Math.min(g.tcols - 3, cx + 2)   // merge-fork column (between bridge and finish)
  const by = g.trows - 2                      // bottom row the vertical arm loops along
  // Too cramped to route a merge → fall back to a single connected path (still one finish).
  if (mx <= cx || by <= cy) { serpentineH(g); return }

  setTile(g, cx, cy, { type: 'bridge', rot: 0 })
  setTile(g, mx, cy, { type: 'fork', rot: rotForPorts('fork', ['W', 'S', 'E']) }) // merge: A from W, B from S, out E

  // Route A (horizontal): START (1,cy) → E through bridge → fork → FINISH (tcols-2, cy)
  layPath(g, row(cy, range(1, g.tcols - 2)))
  // Route B (vertical): START (cx,1) → S through bridge → down → E → up into fork from S → FINISH (shared)
  layPath(g, dedup([
    ...col(cx, range(1, by)),            // top → down through bridge → bottom
    ...row(by, range(cx, mx)),           // across to the merge column
    ...col(mx, range(by, cy)),           // up into the merge fork
    ...row(cy, range(mx, g.tcols - 2)),  // fork → shared FINISH
  ]))
}

function range(a: number, b: number): number[] {
  const out: number[] = []
  const s = a <= b ? 1 : -1
  for (let v = a; s > 0 ? v <= b : v >= b; v += s) out.push(v)
  return out
}

export function buildTileGrid(board: Board, difficulty: number, seed: number, archetype?: string): { grid: TileGrid; archetype: string } {
  const { tcols, trows, size } = dims(board)
  const g = emptyGrid(tcols, trows, size)
  const rng = makeRng(seed)
  const arch = (archetype as Arch) ?? ARCHES[Math.floor(rng() * ARCHES.length)]
  switch (arch) {
    case 'serpentineH': serpentineH(g); break
    case 'serpentineV': serpentineV(g); break
    case 'spiral': spiral(g); break
    case 'branching': branching(g); break
    case 'multiSpawn': multiSpawn(g, 2 + Math.floor(difficulty / 3)); break
    case 'cross': cross(g); break
    default: serpentineH(g)
  }
  return { grid: g, archetype: arch }
}
