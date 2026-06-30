import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { opAmp, ledIndicator, transistorSwitch, timer555, passiveBank } from '../../pipeline/circuits'

// Level 05 «Спиральный мост» — 32×24, difficulty 5.
// Inward rectangular spiral toward the centre, with ONE self-crossing (a bridge) on the way in. A
// central S-tier spot covers many passes (spiral double-coverage). Decor: 555 timer + passive bank.
export function buildLevel05(board: Board): Level {
  const b = new LevelBuilder(board, 105, { name: 'campaign.level4.name', difficulty: 5, archetype: 'spiral', tune: { hpMul: 2.65 } })
  b.path([
    [0, 2], [29, 2], [29, 21], [3, 21], [3, 6], [25, 6], [25, 17], [7, 17], [7, 10],
    [20, 10], [20, 13], [16, 13], [16, 23], [31, 23],
  ])
      b.block(timer555([10, 13], b.alloc))
  b.block(passiveBank([1, 23], 3, b.alloc))
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(opAmp([10, 3], b.alloc));
  b.block(passiveBank([18, 3], 7, b.alloc));
  b.block(ledIndicator([24, 3], b.alloc));
  b.block(passiveBank([10, 7], 0, b.alloc));
  b.block(passiveBank([20, 7], 5, b.alloc));
  b.block(passiveBank([9, 14], 2, b.alloc));
  b.block(passiveBank([22, 14], 1, b.alloc));
  b.block(transistorSwitch([12, 19], b.alloc));
  b.block(passiveBank([22, 19], 6, b.alloc));
  b.block(opAmp([26, 19], b.alloc));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
