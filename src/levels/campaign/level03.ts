import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank } from '../../pipeline/circuits'

// Level 03 «Двойной контур» — 32×24, difficulty 3.
// Branch & merge: one START forks into two equal-length loops that rejoin to ONE finish. Modelled as
// two paths sharing first+last waypoint. Spots on both arms + a B spot at the merge.
export function buildLevel03(board: Board): Level {
  const b = new LevelBuilder(board, 103, { name: 'campaign.level2.name', difficulty: 3, archetype: 'branching', tune: { hpMul: 0.75 } })
  const start: [number, number] = [0, 12]
  const split: [number, number] = [6, 12]
  const merge: [number, number] = [25, 12]
  const finish: [number, number] = [31, 12]
  // upper arm
  b.path([start, split, [6, 4], [16, 4], [16, 12], [25, 4], [25, 12], merge, finish])
  // lower arm
  b.path([start, split, [6, 20], [16, 20], [16, 12], [25, 20], [25, 12], merge, finish])
      b.block(passiveBank([1, 1], 4, b.alloc))
  // ── Fill the big empty pockets inside the loop and the triangle ──
  b.block(ledIndicator([11, 11], b.alloc));
  b.block(passiveBank([8, 17], 5, b.alloc));
  b.block(passiveBank([12, 14], 7, b.alloc));
  b.block(passiveBank([27, 14], 1, b.alloc));
  b.block(passiveBank([28, 17], 4, b.alloc));
  b.block(passiveBank([18, 4], 0, b.alloc));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots({ spacing: 7 })
  return b.build()
}
