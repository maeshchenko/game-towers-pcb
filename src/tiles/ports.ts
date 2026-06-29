import type { Cell } from '../geom/types'
import type { Port, Rot, Tile, TileType } from './types'

const ORDER: Port[] = ['N', 'E', 'S', 'W']
const CANONICAL: Record<TileType, Port[]> = {
  straight: ['N', 'S'], corner: ['N', 'E'], fork: ['W', 'E', 'S'],
  bridge: ['N', 'E', 'S', 'W'], start: ['N'], finish: ['N'], empty: [],
}
export function rotatePort(p: Port, rot: Rot): Port {
  return ORDER[(ORDER.indexOf(p) + rot / 90) % 4]
}
export function tilePorts(tile: Tile): Port[] {
  return CANONICAL[tile.type].map((p) => rotatePort(p, tile.rot))
}
export function opposite(p: Port): Port {
  return p === 'N' ? 'S' : p === 'S' ? 'N' : p === 'E' ? 'W' : 'E'
}
export function portDelta(p: Port): [number, number] {
  return p === 'N' ? [0, -1] : p === 'S' ? [0, 1] : p === 'E' ? [1, 0] : [-1, 0]
}
export function tileCenterCell(tc: number, tr: number, tileSize: number): Cell {
  const h = Math.floor(tileSize / 2)
  return [tc * tileSize + h, tr * tileSize + h]
}
