import type { Cell } from '../geom/types'
import type { Copper } from '../pipeline/copper'
import type { TileGrid } from '../tiles/types'

export type { Copper }

export interface Board { cols: number; rows: number; pitch: number }
export interface Trace { waypoints: Cell[]; cornerRadius: number }
export interface TowerSpot { cell: Cell; score: number; kind: 'build' | 'special' }
export interface DecorItem { kind: string; variant: number; cell: Cell; rot: 0 | 90 | 180 | 270; scale: number; svg?: string; ref?: string }
export interface Level {
  version: 1
  board: Board
  seed: number
  trace: Trace
  /** All enemy paths. Authoritative when present and non-empty; trace stays as paths[0] for backward compat. */
  paths?: Trace[]
  spots: TowerSpot[]
  specialSpots: TowerSpot[]
  decor: DecorItem[]
  /** Each net is an array of indices into decor[]. Optional; produced by step 2 routing. */
  nets?: number[][]
  /** Copper polylines connecting pad anchors of electrically connected components. */
  copper?: Copper[]
  tiles?: TileGrid
  meta: { name: string; difficulty: number; archetype?: string; balance?: { won: boolean; pressure: number }
    /** per-map balance knob from scripts/balance-optimize: enemy-HP multiplier (1 = none). */
    tune?: { hpMul?: number; countMul?: number }
    /** Hand-authored wave script (outer array = waves, inner = spawn groups). Overrides the
     * shared mapWaves(difficulty) template; wave count may differ from 10. Kept structural
     * (kind as string) to avoid a model→game dependency — Game validates kinds on load.
     * Field semantics mirror game/WaveManager WaveEntry (delay/mix/jitter/pathIndex). */
    waves?: {
      kind: string; count: number; interval: number
      pathIndex?: number; delay?: number; jitter?: number
      mix?: Record<string, number>
    }[][] }
}

/** Returns the authoritative set of enemy paths for a level. */
export function levelPaths(level: Level): Trace[] {
  return level.paths && level.paths.length > 0 ? level.paths : [level.trace]
}

export function serializeLevel(l: Level): string {
  return JSON.stringify(l)
}

export function parseLevel(s: string): Level {
  const obj = JSON.parse(s)
  if (obj?.version !== 1) throw new Error(`unsupported level version: ${obj?.version}`)
  return obj as Level
}
