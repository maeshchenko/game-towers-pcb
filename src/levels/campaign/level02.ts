import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 02 «Поворот ключа» — 24×18, difficulty 2.
// 4-lane serpentine with ONE tight hairpin (lanes 3 cells apart) → an S-tier double-coverage spot in
// the fold. START top-left → FINISH bottom-right. Decor: LED indicator + a passive bank in the corners.
export function buildLevel02(board: Board): Level {
  const b = new LevelBuilder(board, 102, { name: 'campaign.level1.name', difficulty: 2, archetype: 'serpentine', tune: { hpMul: 2.45 } })
  b.path([
    [0, 2], [20, 2], [20, 5], [4, 5], [4, 8], [20, 8], [20, 11], [4, 11], [4, 14], [21, 14], [23, 14],
  ])
  // S hairpin folds (double coverage), A corners
      b.block(ledIndicator([1, 16], b.alloc))
  b.block(passiveBank([14, 16], 3, b.alloc))
  // ── Fill the 2-row bands between lanes with short wired fragments ──
  b.block(passiveBank([6, 0], 0, b.alloc));
  b.block(passiveBank([12, 0], 2, b.alloc));
  b.block(ledIndicator([17, 0], b.alloc));
  b.block(railSpine([8, 16], b.alloc, 4, 3)); // short D→L→C rail replaces three clumped banks
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots({ spacing: 5 })
  return b.build()
}
