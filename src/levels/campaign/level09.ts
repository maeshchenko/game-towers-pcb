import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 09 «Частотный разделитель» — 60×45, difficulty 7.
// Long 6-lane serpentine (frequency-divider theme: the path "steps down" repeatedly). Many turns +
// length keep it fair at d7. Decor: passive banks + LED indicators in the lane gaps.
export function buildLevel09(board: Board): Level {
  const b = new LevelBuilder(board, 109, { name: 'campaign.level8.name', difficulty: 7, archetype: 'serpentine', tune: { hpMul: 3.00 } })
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
  b.block(ledIndicator([49, 29], b.alloc));
  b.block(passiveBank([36, 35], 7, b.alloc));
  b.block(passiveBank([46, 35], 1, b.alloc));
  // Authored wave script — this level's own dramaturgy (see W9 design notes).
  b.waves([
    // «Частотный разделитель»: the theme IS rhythm — high-frequency swarms alternate
    // with low-frequency armor columns; ragged glitch static in between.
    [{ kind: 'fast', count: 8, interval: 0.35 }],
    [{ kind: 'tank', count: 2, interval: 2.8 }],
    [{ kind: 'fast', count: 10, interval: 0.3 }, { kind: 'tank', count: 2, interval: 2.6, delay: 10 }],
    [{ kind: 'rogue', count: 10, interval: 0.4, jitter: 0.7 }],
    [{ kind: 'fast', count: 6, interval: 0.25 }, { kind: 'fast', count: 6, interval: 0.25, delay: 6 }, { kind: 'fast', count: 6, interval: 0.25, delay: 12 }],
    [{ kind: 'tank', count: 3, interval: 2.2 }, { kind: 'shielded', count: 4, interval: 1.2, delay: 5 }],
    [{ kind: 'fast', count: 16, interval: 0.35, jitter: 0.6, mix: { fast: 3, rogue: 2 } }, { kind: 'healer', count: 2, interval: 3.0, delay: 8 }],
    [{ kind: 'carrier', count: 2, interval: 2.6 }, { kind: 'fast', count: 12, interval: 0.25, delay: 6 }],
    [{ kind: 'brute', count: 3, interval: 2.2 }, { kind: 'tank', count: 2, interval: 2.4, delay: 8 }, { kind: 'healer', count: 2, interval: 3.0, delay: 4 }],
    [{ kind: 'fast', count: 20, interval: 0.2, jitter: 0.2 }],
    [{ kind: 'tank', count: 18, interval: 0.45, jitter: 0.5, mix: { tank: 1, shielded: 2, rogue: 2, fast: 2 } }, { kind: 'carrier', count: 2, interval: 2.6, delay: 12 }],
    [{ kind: 'tank', count: 4, interval: 1.8 }, { kind: 'healer', count: 3, interval: 2.8, delay: 3 }, { kind: 'fast', count: 20, interval: 0.25, delay: 14, mix: { fast: 3, rogue: 2, normal: 1 } }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
