import type { Board, Level } from '../model/level'
import type { Cell } from '../geom/types'
import { octilinearize } from '../geom/octilinear'
import { computeTowerSpots } from '../pipeline/spots'
import { growDecor } from '../pipeline/decor'

export class EditorState {
  draftPoints: Cell[] = []
  level: Level | null = null
  constructor(public board: Board, public seed: number) {}

  addPoint(cell: Cell): void {
    this.draftPoints = octilinearize([...this.rawDraft(), cell])
  }
  private rawDraft(): Cell[] { return this.draftPoints }

  commitTrace(): void {
    if (this.draftPoints.length < 2) return
    this.level = {
      version: 1, board: this.board, seed: this.seed,
      trace: { waypoints: [...this.draftPoints], cornerRadius: 0.5 },
      spots: [], specialSpots: [], decor: [],
      meta: { name: 'Untitled', difficulty: 1 },
    }
    this.recompute()
  }

  recompute(): void {
    if (!this.level) return
    const budget = 14
    const { spots, specialSpots } = computeTowerSpots({ board: this.board, trace: this.level.trace, budget })
    this.level.spots = spots
    this.level.specialSpots = specialSpots
    this.level.decor = growDecor({ board: this.board, trace: this.level.trace, spots, specialSpots, seed: this.seed })
  }

  reseed(seed: number): void {
    this.seed = seed
    if (this.level) { this.level.seed = seed; this.recompute() }
  }

  loadLevel(l: Level): void { this.level = l; this.board = l.board; this.seed = l.seed; this.draftPoints = [...l.trace.waypoints] }
  clear(): void { this.draftPoints = []; this.level = null }
}
