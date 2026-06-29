import type { Board } from '../model/level'
import type { TileGrid } from './types'
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

function branching(g: TileGrid): void {
  const midY = Math.floor(g.trows / 2)
  const fx = Math.floor(g.tcols / 2)
  layPath(g, range(1, fx).map((x) => [x, midY] as [number, number]))
  setTile(g, fx, midY, { type: 'fork', rot: rotForPorts('fork', ['W', 'N', 'S']) })
  layPath(g, [[fx, midY], ...range(midY - 1, 1).map((y) => [fx, y] as [number, number]), ...range(fx + 1, g.tcols - 2).map((x) => [x, 1] as [number, number])])
  layPath(g, [[fx, midY], ...range(midY + 1, g.trows - 2).map((y) => [fx, y] as [number, number]), ...range(fx + 1, g.tcols - 2).map((x) => [x, g.trows - 2] as [number, number])])
}

// multiSpawn: N independent parallel horizontal routes, each with its own start and finish
function multiSpawn(g: TileGrid, n: number): void {
  const count = Math.max(2, n)
  const rowsFor = [1, g.trows - 2, Math.floor(g.trows / 3)].slice(0, count)
  for (const ry of rowsFor) {
    layPath(g, range(1, g.tcols - 2).map((x) => [x, ry] as [number, number]))
  }
}

function cross(g: TileGrid): void {
  const cx = Math.floor(g.tcols / 2), cy = Math.floor(g.trows / 2)
  setTile(g, cx, cy, { type: 'bridge', rot: 0 })
  layPath(g, range(1, g.tcols - 2).map((x) => [x, cy] as [number, number]))
  layPath(g, range(1, g.trows - 2).map((y) => [cx, y] as [number, number]))
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
