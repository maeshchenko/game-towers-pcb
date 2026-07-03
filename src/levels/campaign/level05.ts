import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 05 «Спиральный мост» — 32×24, difficulty 5.
// Inward rectangular spiral toward the centre, with ONE self-crossing (a bridge) on the way in. A
// central S-tier spot covers many passes (spiral double-coverage). Decor: passive banks + LED
// indicator, relocated off the tightly-wound spiral lanes (1-cell trace margin leaves very little
// free board here, so the 555 timer / op-amps / transistor stage that used to fill this level don't
// fit anywhere and are dropped — decor is decoration).
export function buildLevel05(board: Board): Level {
  const b = new LevelBuilder(board, 105, { name: 'campaign.level4.name', difficulty: 5, archetype: 'spiral', tune: { hpMul: 3.25 } })
  b.path([
    [0, 2], [29, 2], [29, 21], [3, 21], [3, 6], [25, 6], [25, 17], [7, 17], [7, 10],
    [20, 10], [20, 13], [16, 13], [16, 23], [31, 23],
  ])
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(railSpine([0, 0], b.alloc, 2))
  b.block(passiveBank([0, 23], 4, b.alloc))
  b.block(ledIndicator([19, 4], b.alloc))
  b.block(passiveBank([12, 12], 0, b.alloc))
  b.block(passiveBank([16, 0], 5, b.alloc))
  b.block(passiveBank([9, 14], 2, b.alloc))
  b.block(passiveBank([19, 15], 1, b.alloc))
  b.block(passiveBank([22, 19], 6, b.alloc))
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  // spacing tightened slightly: decor now correctly excludes spots from its footprint (occupancy
  // fix), so the default spacing left too few legal slots near the dense decor bands.
  // Authored wave script — this level's own dramaturgy (see W5 design notes).
  b.waves([
    // «Спиральный мост»: ACCUMULATOR (tank) debuts — armor lessons down the spiral.
    [{ kind: 'normal', count: 8, interval: 0.75 }],
    [{ kind: 'fast', count: 8, interval: 0.4 }, { kind: 'normal', count: 5, interval: 0.9, delay: 8 }],
    [{ kind: 'tank', count: 1, interval: 3.0 }, { kind: 'normal', count: 6, interval: 0.8, delay: 3 }],
    [{ kind: 'tank', count: 2, interval: 2.6 }, { kind: 'fast', count: 8, interval: 0.4, delay: 5 }],
    [{ kind: 'brute', count: 2, interval: 2.4 }, { kind: 'healer', count: 1, interval: 4.0, delay: 4 }, { kind: 'tank', count: 1, interval: 3.0, delay: 8 }],
    [{ kind: 'normal', count: 12, interval: 0.5, jitter: 0.6, mix: { normal: 2, fast: 2 } }, { kind: 'tank', count: 2, interval: 2.4, delay: 10 }],
    [{ kind: 'fast', count: 14, interval: 0.28 }, { kind: 'tank', count: 1, interval: 3.0, delay: 12 }],
    [{ kind: 'tank', count: 3, interval: 2.0, jitter: 0.3 }, { kind: 'healer', count: 2, interval: 3.0, delay: 3 }],
    [{ kind: 'fast', count: 14, interval: 0.5, jitter: 0.5, mix: { fast: 2, normal: 2, brute: 1 } }, { kind: 'tank', count: 2, interval: 2.2, delay: 12 }],
    [{ kind: 'tank', count: 4, interval: 1.8 }, { kind: 'healer', count: 2, interval: 3.0, delay: 2 }, { kind: 'fast', count: 16, interval: 0.25, delay: 12, mix: { fast: 3, normal: 2 } }],
  ])

  b.patrolSpots({ spacing: 3.5 })
  return b.build()
}
