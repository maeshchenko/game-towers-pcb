import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { opAmp, ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 07 «Сетка контактов» — 44×33, difficulty 6.
// Dense 5-lane serpentine (a "grid of contacts") with many turns — long time-under-fire keeps it fair
// at this difficulty. Coverage-greedy spots. Decor: op-amps + passive banks in the lane gaps.
export function buildLevel07(board: Board): Level {
  const b = new LevelBuilder(board, 107, { name: 'campaign.level6.name', difficulty: 6, archetype: 'serpentine', tune: { hpMul: 2.65 } })
  b.path([
    [0, 3], [40, 3], [40, 9], [4, 9], [4, 15], [40, 15], [40, 21], [4, 21], [4, 27], [40, 27], [40, 30], [43, 30],
  ])
  b.block(passiveBank([24, 23], 4, b.alloc))
  // ── Fill the empty bands between the lanes with wired fragments (board rows: lanes at 3/9/15/21/27) ──
  b.block(passiveBank([8, 5], 0, b.alloc)); b.block(passiveBank([16, 5], 2, b.alloc))
  b.block(passiveBank([32, 5], 7, b.alloc))
  b.block(passiveBank([30, 11], 5, b.alloc)); b.block(passiveBank([36, 12], 1, b.alloc))
  b.block(railSpine([6, 30], b.alloc, 6)); b.block(railSpine([19, 31], b.alloc, 3, 4))
  b.block(opAmp([30, 31], b.alloc))
  b.block(opAmp([2, 18], b.alloc)); b.block(passiveBank([18, 17], 4, b.alloc))
  b.block(ledIndicator([34, 18], b.alloc))
  b.block(passiveBank([8, 23], 6, b.alloc)); b.block(passiveBank([16, 24], 3, b.alloc))
  // Authored wave script — this level's own dramaturgy (see W7 design notes).
  b.waves([
    // «Сетка контактов»: GLITCH (rogue) debuts — erratic speed chaos, SLOW stabilizes.
    [{ kind: 'normal', count: 9, interval: 0.7 }, { kind: 'fast', count: 6, interval: 0.4, delay: 8 }],
    [{ kind: 'rogue', count: 6, interval: 0.5 }],
    [{ kind: 'rogue', count: 8, interval: 0.45, jitter: 0.6 }, { kind: 'fast', count: 6, interval: 0.4, delay: 7 }],
    [{ kind: 'tank', count: 2, interval: 2.4 }, { kind: 'rogue', count: 8, interval: 0.45, delay: 4 }],
    [{ kind: 'rogue', count: 14, interval: 0.45, jitter: 0.6, mix: { rogue: 3, fast: 2, normal: 1 } }],
    [{ kind: 'shielded', count: 4, interval: 1.2 }, { kind: 'rogue', count: 8, interval: 0.4, delay: 6 }],
    [{ kind: 'rogue', count: 18, interval: 0.22 }],
    [{ kind: 'brute', count: 3, interval: 2.2 }, { kind: 'healer', count: 2, interval: 3.0, delay: 3 }, { kind: 'rogue', count: 8, interval: 0.4, delay: 10 }],
    [{ kind: 'rogue', count: 16, interval: 0.4, jitter: 0.5, mix: { rogue: 3, fast: 2, shielded: 1 } }],
    [{ kind: 'tank', count: 3, interval: 2.0 }, { kind: 'healer', count: 2, interval: 3.0, delay: 2 }, { kind: 'rogue', count: 10, interval: 0.4, delay: 8, jitter: 0.6 }],
    [{ kind: 'rogue', count: 20, interval: 0.35, jitter: 0.6, mix: { rogue: 3, fast: 3, normal: 1 } }, { kind: 'healer', count: 2, interval: 3.0, delay: 10 }, { kind: 'rogue', count: 12, interval: 0.2, delay: 18 }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots({ spacing: 5 })
  return b.build()
}
