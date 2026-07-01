import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { powerSupply, opAmp, ledIndicator, passiveBank } from '../../pipeline/circuits'

// Level 04 «Шунт питания» — 32×24, difficulty 4.
// Serpentine with a deliberate CHOKE kill-zone (a tight double-back at 50–75% of the path) where
// specials + builds cluster. Decor centrepiece: a linear power-supply block by the top edge.
export function buildLevel04(board: Board): Level {
  const b = new LevelBuilder(board, 104, { name: 'campaign.level3.name', difficulty: 4, archetype: 'serpentine', tune: { hpMul: 1.90 } })
  b.path([
    [0, 3], [28, 3], [28, 8], [6, 8], [6, 12], [26, 12], [26, 15], [9, 15], [9, 18], [29, 18], [29, 21], [31, 21],
  ])
  // kill-zone cluster around the [6..26, 12..15] double-back
      b.block(powerSupply([2, 21], b.alloc))
  b.block(passiveBank([14, 21], 4, b.alloc))
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(opAmp([10, 4], b.alloc));
  b.block(passiveBank([16, 4], 7, b.alloc));
  b.block(ledIndicator([23, 5], b.alloc));
  b.block(opAmp([10, 9], b.alloc));
  b.block(passiveBank([18, 9], 0, b.alloc));
  b.block(passiveBank([24, 10], 5, b.alloc));
  b.block(passiveBank([12, 13], 2, b.alloc));
  b.block(passiveBank([20, 13], 1, b.alloc));
  b.block(passiveBank([12, 16], 6, b.alloc));
  b.block(passiveBank([20, 16], 4, b.alloc));
  b.block(passiveBank([16, 19], 5, b.alloc));
  b.block(passiveBank([22, 19], 0, b.alloc));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
