import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { mcuCore, opAmp, ledIndicator, transistorSwitch, passiveBank } from '../../pipeline/circuits'

// Level 07 «Сетка контактов» — 44×33, difficulty 6.
// Dense 5-lane serpentine (a "grid of contacts") with many turns — long time-under-fire keeps it fair
// at this difficulty. Coverage-greedy spots. Decor: MCU core + passive bank in the lane gaps.
export function buildLevel07(board: Board): Level {
  const b = new LevelBuilder(board, 107, { name: 'campaign.level6.name', difficulty: 6, archetype: 'serpentine', tune: { hpMul: 1.05 } })
  b.path([
    [0, 3], [40, 3], [40, 9], [4, 9], [4, 15], [40, 15], [40, 21], [4, 21], [4, 27], [40, 27], [40, 30], [43, 30],
  ])
  b.block(mcuCore([16, 11], b.alloc))
  b.block(passiveBank([24, 23], 4, b.alloc))
  // ── Fill the empty bands between the lanes with wired fragments (board rows: lanes at 3/9/15/21/27) ──
  b.block(passiveBank([8, 5], 0, b.alloc)); b.block(passiveBank([16, 5], 2, b.alloc))
  b.block(opAmp([24, 6], b.alloc)); b.block(passiveBank([32, 5], 7, b.alloc))
  b.block(passiveBank([30, 11], 5, b.alloc)); b.block(passiveBank([36, 12], 1, b.alloc))
  b.block(opAmp([8, 18], b.alloc)); b.block(passiveBank([18, 17], 4, b.alloc))
  b.block(transistorSwitch([28, 18], b.alloc)); b.block(ledIndicator([34, 18], b.alloc))
  b.block(passiveBank([8, 23], 6, b.alloc)); b.block(passiveBank([16, 24], 3, b.alloc))
  b.block(opAmp([34, 24], b.alloc))
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
