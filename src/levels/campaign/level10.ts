import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { passiveBank, opAmp, railSpine } from '../../pipeline/circuits'

// Level 10 «Многослойный мост» — 60×45, difficulty 8.
// A single weaving path that crosses itself several times (bridges). Spots sit at the crossings
// (ultra-high value). Decor: two passive banks + an op-amp in the corner pockets.
export function buildLevel10(board: Board): Level {
  const b = new LevelBuilder(board, 110, { name: 'campaign.level9.name', difficulty: 8, archetype: 'cross', tune: { hpMul: 2.60 } })
  b.path([
    [0, 4], [55, 4], [55, 40], [30, 40], [30, 10], [10, 10], [10, 30],
    [50, 30], [50, 15], [20, 15], [20, 44], [59, 44],
  ])
  // spots near the self-crossings and long straights
      b.block(passiveBank([2, 38], 5, b.alloc))
  b.block(passiveBank([40, 36], 4, b.alloc))
  b.block(opAmp([34, 20], b.alloc))
  b.block(railSpine([0, 6], b.alloc, 4)); b.block(railSpine([32, 6], b.alloc, 1))
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Authored wave script — this level's own dramaturgy (see W10 design notes).
  b.waves([
    // «Многослойный мост»: the longest single lane — endurance and layered pushes.
    [{ kind: 'normal', count: 10, interval: 0.6, jitter: 0.4 }],
    [{ kind: 'fast', count: 10, interval: 0.35 }, { kind: 'normal', count: 6, interval: 0.7, delay: 9 }],
    [{ kind: 'shielded', count: 5, interval: 1.1 }, { kind: 'fast', count: 8, interval: 0.4, delay: 6 }],
    [{ kind: 'carrier', count: 2, interval: 2.6 }, { kind: 'rogue', count: 10, interval: 0.4, delay: 5, jitter: 0.6 }],
    [{ kind: 'tank', count: 3, interval: 2.0 }, { kind: 'brute', count: 2, interval: 2.4, delay: 8 }, { kind: 'healer', count: 2, interval: 3.0, delay: 4 }],
    [{ kind: 'fast', count: 18, interval: 0.35, jitter: 0.5, mix: { fast: 2, rogue: 2, shielded: 1 } }],
    [{ kind: 'fast', count: 22, interval: 0.2 }],
    [{ kind: 'carrier', count: 3, interval: 2.2 }, { kind: 'healer', count: 2, interval: 3.0, delay: 4 }, { kind: 'shielded', count: 5, interval: 1.1, delay: 10 }],
    [{ kind: 'brute', count: 4, interval: 2.0, jitter: 0.3 }, { kind: 'tank', count: 3, interval: 2.2, delay: 10 }],
    [{ kind: 'rogue', count: 20, interval: 0.35, jitter: 0.6, mix: { rogue: 3, fast: 2, carrier: 1 } }, { kind: 'healer', count: 3, interval: 2.8, delay: 10 }],
    [{ kind: 'tank', count: 4, interval: 1.8 }, { kind: 'shielded', count: 6, interval: 1.0, delay: 6 }, { kind: 'brute', count: 3, interval: 2.2, delay: 12 }],
    [{ kind: 'fast', count: 24, interval: 0.22, jitter: 0.4, mix: { fast: 3, rogue: 2, shielded: 1 } }, { kind: 'carrier', count: 3, interval: 2.2, delay: 12 }, { kind: 'healer', count: 3, interval: 2.8, delay: 8 }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
