import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { opAmp, ledIndicator, transistorSwitch, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 06 «Широкая магистраль» — 44×33, difficulty 5.
// Long boustrophedon, WIDE lanes (7-row gaps), clear pacing zones (open top → tighter bottom).
// 2 specials + several builds. Decor fills the wide lane-gaps with op-amps, LEDs and passive banks.
export function buildLevel06(board: Board): Level {
  const b = new LevelBuilder(board, 106, { name: 'campaign.level5.name', difficulty: 5, archetype: 'serpentine', tune: { hpMul: 1.35 } })
  b.path([
    [0, 3], [40, 3], [40, 10], [4, 10], [4, 17], [40, 17], [40, 24], [4, 24], [4, 30], [43, 30],
  ])
      b.block(passiveBank([22, 12], 4, b.alloc))
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(opAmp([20, 7], b.alloc));
  b.block(passiveBank([28, 5], 7, b.alloc));
  b.block(passiveBank([34, 6], 5, b.alloc));
  b.block(ledIndicator([12, 6], b.alloc));
  b.block(opAmp([10, 14], b.alloc));
  b.block(passiveBank([38, 13], 1, b.alloc));
  b.block(railSpine([23, 13], b.alloc, 1)); b.block(railSpine([0, 8], b.alloc, 8));
  b.block(railSpine([18, 28], b.alloc, 4));
  b.block(opAmp([10, 21], b.alloc));
  b.block(transistorSwitch([25, 21], b.alloc));
  b.block(passiveBank([30, 19], 4, b.alloc));
  b.block(ledIndicator([34, 20], b.alloc));
  b.block(passiveBank([10, 26], 6, b.alloc));
  b.block(passiveBank([36, 26], 0, b.alloc));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Authored wave script — this level's own dramaturgy (see W6 design notes).
  b.waves([
    // «Широкая магистраль»: CAPSULE (shielded) debuts — alpha shots waste, rate strips.
    [{ kind: 'normal', count: 9, interval: 0.7, jitter: 0.4 }],
    [{ kind: 'fast', count: 9, interval: 0.4 }, { kind: 'normal', count: 6, interval: 0.8, delay: 8 }],
    [{ kind: 'tank', count: 2, interval: 2.4 }, { kind: 'brute', count: 1, interval: 3.0, delay: 6 }, { kind: 'fast', count: 6, interval: 0.4, delay: 8 }],
    [{ kind: 'shielded', count: 3, interval: 1.4 }, { kind: 'normal', count: 6, interval: 0.8, delay: 4 }],
    [{ kind: 'shielded', count: 4, interval: 1.2 }, { kind: 'fast', count: 8, interval: 0.4, delay: 6 }],
    [{ kind: 'normal', count: 14, interval: 0.5, jitter: 0.5, mix: { normal: 2, fast: 2, shielded: 1 } }],
    [{ kind: 'brute', count: 3, interval: 2.2 }, { kind: 'healer', count: 2, interval: 3.0, delay: 3 }, { kind: 'shielded', count: 3, interval: 1.4, delay: 10 }],
    [{ kind: 'fast', count: 16, interval: 0.25 }, { kind: 'shielded', count: 3, interval: 1.4, delay: 12 }],
    [{ kind: 'tank', count: 3, interval: 2.0 }, { kind: 'healer', count: 2, interval: 3.0, delay: 2 }, { kind: 'normal', count: 12, interval: 0.5, delay: 8, mix: { fast: 2, normal: 2 } }],
    [{ kind: 'shielded', count: 6, interval: 1.0, jitter: 0.4 }, { kind: 'brute', count: 2, interval: 2.4, delay: 8 }, { kind: 'healer', count: 2, interval: 3.0, delay: 4 }],
    [{ kind: 'normal', count: 18, interval: 0.4, jitter: 0.5, mix: { normal: 2, fast: 2, shielded: 2 } }, { kind: 'tank', count: 3, interval: 2.0, delay: 10 }, { kind: 'fast', count: 14, interval: 0.22, delay: 18 }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
