import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { timer555, passiveBank, railSpine, amplifierStage } from '../../pipeline/circuits'

// Level 12 «Финал: Генератор» — 60×45, difficulty 9. The showcase:
// TWO spawns merge → an inward spiral kill-zone that self-crosses (a bridge) → ONE finish.
// Decor: a 555 timer + passive bank, kept clear of the tight spiral lanes.
export function buildLevel12(board: Board): Level {
  const b = new LevelBuilder(board, 112, { name: 'campaign.level11.name', difficulty: 9, archetype: 'cross', tune: { hpMul: 2.50 } })
  const merge: [number, number] = [20, 22]
  const spiral: [number, number][] = [
    merge, [52, 22], [52, 40], [8, 40], [8, 8], [44, 8], [44, 30], [24, 30],
    [24, 18], [38, 18], [38, 26], [30, 26], [30, 44], [59, 44],
  ]
  b.path([[0, 2], [20, 2], ...spiral])      // spawn 1 (top-left)
  b.path([[0, 42], [20, 42], [20, 22], ...spiral.slice(1)]) // spawn 2 (bottom-left) → merge
      b.block(timer555([49, 2], b.alloc))
  b.block(passiveBank([2, 30], 4, b.alloc))
  b.block(railSpine([0, 5], b.alloc, 6)); b.block(railSpine([22, 4], b.alloc, 0))
  b.block(amplifierStage([46, 12], b.alloc))
  b.block(passiveBank([33, 33], 7, b.alloc))
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Authored wave script — this level's own dramaturgy (see W12 design notes).
  b.waves([
    // «Финал: Генератор»: a 14-wave SIEGE — three boss arrivals, each escorted, each worse.
    [{ kind: 'normal', count: 12, interval: 0.55, jitter: 0.4 }],
    [{ kind: 'fast', count: 12, interval: 0.3 }, { kind: 'rogue', count: 8, interval: 0.45, delay: 8 }],
    [{ kind: 'shielded', count: 6, interval: 1.0 }, { kind: 'carrier', count: 2, interval: 2.6, delay: 8 }],
    [{ kind: 'tank', count: 3, interval: 2.0, pathIndex: 0 }, { kind: 'brute', count: 3, interval: 2.2, pathIndex: 1, delay: 4 }],
    [{ kind: 'fast', count: 20, interval: 0.3, jitter: 0.5, mix: { fast: 2, rogue: 2, normal: 1 } }],
    [{ kind: 'carrier', count: 3, interval: 2.2 }, { kind: 'healer', count: 3, interval: 2.8, delay: 3 }, { kind: 'shielded', count: 6, interval: 1.0, delay: 8 }],
    [{ kind: 'boss', count: 1, interval: 5.0, delay: 6 }, { kind: 'fast', count: 12, interval: 0.25, delay: 10 }],
    [{ kind: 'rogue', count: 24, interval: 0.18, jitter: 0.3 }],
    [{ kind: 'tank', count: 4, interval: 1.8 }, { kind: 'healer', count: 3, interval: 2.8, delay: 3 }, { kind: 'carrier', count: 2, interval: 2.6, delay: 10 }],
    [{ kind: 'shielded', count: 24, interval: 0.3, jitter: 0.5, mix: { shielded: 2, rogue: 2, fast: 2, brute: 1 } }],
    [{ kind: 'boss', count: 1, interval: 5.0 }, { kind: 'boss', count: 1, interval: 5.0, delay: 20 }, { kind: 'tank', count: 3, interval: 2.2, delay: 8 }],
    [{ kind: 'brute', count: 5, interval: 1.8, jitter: 0.3 }, { kind: 'healer', count: 4, interval: 2.6, delay: 4 }, { kind: 'shielded', count: 8, interval: 0.9, delay: 10 }],
    [{ kind: 'fast', count: 26, interval: 0.25, jitter: 0.5, mix: { fast: 3, rogue: 2, carrier: 1, tank: 1 } }, { kind: 'healer', count: 3, interval: 2.8, delay: 12 }],
    [{ kind: 'boss', count: 1, interval: 5.0, delay: 8 }, { kind: 'fast', count: 26, interval: 0.18, delay: 12, mix: { fast: 3, rogue: 3 } }, { kind: 'healer', count: 4, interval: 2.6, delay: 10 }, { kind: 'tank', count: 4, interval: 1.8, delay: 20 }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
