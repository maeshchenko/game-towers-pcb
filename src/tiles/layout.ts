import type { Port, Rot, Tile, TileGrid, TileType } from './types'
import { tilePorts } from './ports'

const ROTS: Rot[] = [0, 90, 180, 270]
function sameSet(a: Port[], b: Port[]): boolean {
  if (a.length !== b.length) return false
  const sb = new Set(b); return a.every((p) => sb.has(p))
}
export function rotForPorts(type: TileType, desired: Port[]): Rot {
  for (const r of ROTS) if (sameSet(tilePorts({ type, rot: r }), desired)) return r
  throw new Error(`no rotation of ${type} matches ${desired.join('')}`)
}
export function emptyGrid(tcols: number, trows: number, tileSize: number): TileGrid {
  return { tileSize, tcols, trows, tiles: Array.from({ length: tcols * trows }, () => ({ type: 'empty', rot: 0 } as Tile)) }
}
export function idx(grid: TileGrid, tc: number, tr: number): number { return tr * grid.tcols + tc }
export function getTile(grid: TileGrid, tc: number, tr: number): Tile | null {
  if (tc < 0 || tr < 0 || tc >= grid.tcols || tr >= grid.trows) return null
  return grid.tiles[idx(grid, tc, tr)]
}
export function setTile(grid: TileGrid, tc: number, tr: number, tile: Tile): void {
  if (tc < 0 || tr < 0 || tc >= grid.tcols || tr >= grid.trows) return
  grid.tiles[idx(grid, tc, tr)] = tile
}
function dirPort(from: [number, number], to: [number, number]): Port {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  if (dx === 1) return 'E'; if (dx === -1) return 'W'; if (dy === 1) return 'S'; return 'N'
}
function opp(p: Port): Port { return p === 'N' ? 'S' : p === 'S' ? 'N' : p === 'E' ? 'W' : 'E' }

export function layPath(grid: TileGrid, coords: [number, number][]): void {
  for (let i = 0; i < coords.length; i++) {
    const [tc, tr] = coords[i]
    const existing = getTile(grid, tc, tr)
    if (existing && (existing.type === 'fork' || existing.type === 'bridge')) continue // keep junctions
    let type: TileType, desired: Port[]
    if (i === 0) { type = 'start'; desired = [dirPort(coords[0], coords[1])] }
    else if (i === coords.length - 1) { type = 'finish'; desired = [dirPort(coords[i], coords[i - 1])] }
    else {
      const pIn = opp(dirPort(coords[i - 1], coords[i]))
      const pOut = dirPort(coords[i], coords[i + 1])
      desired = [pIn, pOut]
      type = opp(pIn) === pOut ? 'straight' : 'corner'
    }
    setTile(grid, tc, tr, { type, rot: rotForPorts(type, desired) })
  }
}
