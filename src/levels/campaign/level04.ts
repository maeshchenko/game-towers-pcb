import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { powerSupply, ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 04 «Шунт питания» — 32×24, difficulty 4.
// Serpentine with a deliberate CHOKE kill-zone (a tight double-back at 50–75% of the path) where
// specials + builds cluster. Decor centrepiece: a linear power-supply block by the top edge.
export function buildLevel04(board: Board): Level {
  const b = new LevelBuilder(board, 104, { name: 'campaign.level3.name', difficulty: 4, archetype: 'serpentine', tune: { hpMul: 2.50 } })
  b.path([
    [0, 3], [28, 3], [28, 8], [6, 8], [6, 12], [26, 12], [26, 15], [9, 15], [9, 18], [29, 18], [29, 21], [31, 21],
  ])
  // kill-zone cluster around the [6..26, 12..15] double-back
      b.block(powerSupply([2, 21], b.alloc))
  b.block(passiveBank([14, 21], 4, b.alloc))
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(ledIndicator([22, 5], b.alloc));
  b.block(passiveBank([18, 10], 0, b.alloc));
  b.block(railSpine([0, 5], b.alloc, 2)); b.block(railSpine([16, 0], b.alloc, 7));
  b.block(passiveBank([24, 10], 5, b.alloc));
  b.block(passiveBank([12, 10], 2, b.alloc));
  b.block(passiveBank([12, 20], 6, b.alloc));
  b.block(passiveBank([20, 20], 4, b.alloc));
  b.block(passiveBank([17, 21], 5, b.alloc));
  b.block(passiveBank([23, 20], 0, b.alloc));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  // spacing tightened: decor now correctly excludes spots from its footprint (occupancy fix), so the
  // default spacing left too few legal slots in this decor-dense level.
  b.patrolSpots({ spacing: 2 })
  return b.build()
}
