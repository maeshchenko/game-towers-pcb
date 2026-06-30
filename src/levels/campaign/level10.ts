import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { passiveBank, opAmp } from '../../pipeline/circuits'

// Level 10 «Многослойный мост» — 60×45, difficulty 8.
// A single weaving path that crosses itself several times (bridges). Spots sit at the crossings
// (ultra-high value). Decor: two passive banks + an op-amp in the corner pockets.
export function buildLevel10(board: Board): Level {
  const b = new LevelBuilder(board, 110, { name: 'campaign.level9.name', difficulty: 8, archetype: 'cross', tune: { hpMul: 0.8 } })
  b.path([
    [0, 4], [55, 4], [55, 40], [30, 40], [30, 10], [10, 10], [10, 30],
    [50, 30], [50, 15], [20, 15], [20, 44], [59, 44],
  ])
  // spots near the self-crossings and long straights
      b.block(passiveBank([2, 38], 5, b.alloc))
  b.block(passiveBank([40, 36], 4, b.alloc))
  b.block(opAmp([34, 20], b.alloc))
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
