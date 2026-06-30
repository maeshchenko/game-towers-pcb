import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { mcuCore, powerSupply, timer555, passiveBank } from '../../pipeline/circuits'

// Level 12 «Финал: Генератор» — 60×45, difficulty 9. The showcase:
// TWO spawns merge → an inward spiral kill-zone that self-crosses (a bridge) → ONE finish.
// Decor centrepiece: an MCU "generator" core in the middle, ringed by supporting blocks, all wired.
export function buildLevel12(board: Board): Level {
  const b = new LevelBuilder(board, 112, { name: 'campaign.level11.name', difficulty: 9, archetype: 'cross', tune: { hpMul: 0.9 } })
  const merge: [number, number] = [20, 22]
  const spiral: [number, number][] = [
    merge, [52, 22], [52, 40], [8, 40], [8, 8], [44, 8], [44, 30], [24, 30],
    [24, 18], [38, 18], [38, 26], [30, 26], [30, 44], [59, 44],
  ]
  b.path([[0, 2], [20, 2], ...spiral])      // spawn 1 (top-left)
  b.path([[0, 42], [20, 42], [20, 22], ...spiral.slice(1)]) // spawn 2 (bottom-left) → merge
      b.block(mcuCore([29, 19], b.alloc))   // generator centrepiece (in the spiral's centre pocket)
  b.block(powerSupply([2, 44], b.alloc))
  b.block(timer555([50, 2], b.alloc))
  b.block(passiveBank([2, 30], 4, b.alloc))
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
