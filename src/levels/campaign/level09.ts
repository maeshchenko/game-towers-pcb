import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 09 «Частотный разделитель» — 60×45, difficulty 7.
// Long 6-lane serpentine (frequency-divider theme: the path "steps down" repeatedly). Many turns +
// length keep it fair at d7. Decor: passive banks + LED indicators in the lane gaps.
export function buildLevel09(board: Board): Level {
  const b = new LevelBuilder(board, 109, { name: 'campaign.level8.name', difficulty: 7, archetype: 'serpentine', tune: { hpMul: 1.30 } })
  b.path([
    [0, 3], [55, 3], [55, 9], [5, 9], [5, 15], [55, 15], [55, 21], [5, 21],
    [5, 27], [55, 27], [55, 33], [5, 33], [5, 39], [58, 39],
  ])
  b.block(passiveBank([24, 35], 5, b.alloc))
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(passiveBank([22, 5], 7, b.alloc));
  b.block(railSpine([8, 6], b.alloc, 0)); b.block(railSpine([10, 12], b.alloc, 5));
  b.block(railSpine([40, 24], b.alloc, 7)); b.block(railSpine([8, 36], b.alloc, 2));
  b.block(passiveBank([48, 5], 1, b.alloc));
  b.block(passiveBank([30, 11], 5, b.alloc));
  b.block(passiveBank([30, 17], 0, b.alloc));
  b.block(ledIndicator([46, 17], b.alloc));
  b.block(passiveBank([12, 23], 6, b.alloc));
  b.block(passiveBank([28, 24], 2, b.alloc));
  b.block(passiveBank([34, 29], 4, b.alloc));
  b.block(ledIndicator([50, 29], b.alloc));
  b.block(passiveBank([36, 35], 7, b.alloc));
  b.block(passiveBank([46, 35], 1, b.alloc));
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
