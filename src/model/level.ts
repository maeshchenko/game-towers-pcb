import type { Cell } from '../geom/types'

export interface Board { cols: number; rows: number; pitch: number }
export interface Trace { waypoints: Cell[]; cornerRadius: number }
export interface TowerSpot { cell: Cell; score: number; kind: 'build' | 'special' }
export interface DecorItem { kind: string; variant: number; cell: Cell; rot: 0 | 90 | 180 | 270; scale: number; svg?: string }
export interface Level {
  version: 1
  board: Board
  seed: number
  trace: Trace
  spots: TowerSpot[]
  specialSpots: TowerSpot[]
  decor: DecorItem[]
  meta: { name: string; difficulty: number }
}

export function serializeLevel(l: Level): string {
  return JSON.stringify(l)
}

export function parseLevel(s: string): Level {
  const obj = JSON.parse(s)
  if (obj?.version !== 1) throw new Error(`unsupported level version: ${obj?.version}`)
  return obj as Level
}
