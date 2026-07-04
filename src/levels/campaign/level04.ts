import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { powerSupply, ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 04 «Шунт питания» — 32×24, difficulty 4.
// Serpentine with a deliberate CHOKE kill-zone (a tight double-back at 50–75% of the path) where
// specials + builds cluster. Decor centrepiece: a linear power-supply block by the top edge.
export function buildLevel04(board: Board): Level {
  const b = new LevelBuilder(board, 104, { name: 'campaign.level3.name', difficulty: 4, archetype: 'serpentine', tune: { hpMul: 2.60 } })
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
  // Authored wave script — this level's own dramaturgy (see W4 design notes).
  b.waves([
    // «Шунт питания»: VIRUS (brute) debuts — raw HP walls between speed pulses.
    [{ kind: 'normal', count: 7, interval: 0.8 }],
    [{ kind: 'fast', count: 7, interval: 0.45 }, { kind: 'normal', count: 5, interval: 0.9, delay: 7 }],
    [{ kind: 'brute', count: 1, interval: 3.0 }, { kind: 'normal', count: 6, interval: 0.8, delay: 2 }],
    [{ kind: 'brute', count: 2, interval: 2.5 }, { kind: 'fast', count: 8, interval: 0.4, delay: 6 }],
    [{ kind: 'normal', count: 12, interval: 0.55, jitter: 0.5, mix: { normal: 2, fast: 2 } }],
    [{ kind: 'brute', count: 2, interval: 2.4 }, { kind: 'healer', count: 1, interval: 4.0, delay: 2 }, { kind: 'normal', count: 8, interval: 0.7, delay: 6 }],
    [{ kind: 'fast', count: 12, interval: 0.3 }, { kind: 'brute', count: 1, interval: 3.0, delay: 10 }],
    [{ kind: 'brute', count: 3, interval: 2.2, jitter: 0.3 }, { kind: 'healer', count: 1, interval: 4.0, delay: 3 }, { kind: 'fast', count: 6, interval: 0.4, delay: 12 }],
    [{ kind: 'normal', count: 14, interval: 0.6, jitter: 0.5, mix: { normal: 2, fast: 2, brute: 1 } }],
    [{ kind: 'brute', count: 4, interval: 2.0 }, { kind: 'healer', count: 2, interval: 3.0, delay: 2 }, { kind: 'fast', count: 14, interval: 0.25, delay: 12 }],
  ])

  b.patrolSpots({ spacing: 2 })
  return b.build()
}
