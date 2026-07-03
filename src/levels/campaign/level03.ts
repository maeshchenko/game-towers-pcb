import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 03 «Двойной контур» — 32×24, difficulty 3.
// Branch & merge: one START forks into two equal-length loops that rejoin to ONE finish. Modelled as
// two paths sharing first+last waypoint. Spots on both arms + a B spot at the merge.
export function buildLevel03(board: Board): Level {
  const b = new LevelBuilder(board, 103, { name: 'campaign.level2.name', difficulty: 3, archetype: 'branching', tune: { hpMul: 0.65 } })
  const start: [number, number] = [0, 12]
  const split: [number, number] = [6, 12]
  const merge: [number, number] = [25, 12]
  const finish: [number, number] = [31, 12]
  // upper arm (true 45° diagonal — [16,12]→[25,4] was a ~41.6° slur that broke PCB styling)
  b.path([start, split, [6, 4], [16, 4], [16, 12], [24, 4], [25, 4], [25, 12], merge, finish])
  // lower arm
  b.path([start, split, [6, 20], [16, 20], [16, 12], [24, 20], [25, 20], [25, 12], merge, finish])
      b.block(passiveBank([1, 1], 4, b.alloc))
  // ── Fill the big empty pockets inside the loop and the triangle ──
  b.block(ledIndicator([10, 11], b.alloc));
  b.block(passiveBank([8, 17], 5, b.alloc));
  b.block(passiveBank([9, 14], 7, b.alloc));
  b.block(passiveBank([27, 14], 1, b.alloc));
  b.block(passiveBank([28, 17], 4, b.alloc));
  b.block(passiveBank([18, 4], 0, b.alloc));
  b.block(railSpine([5, 1], b.alloc, 3)); b.block(railSpine([16, 22], b.alloc, 6));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Authored wave script — this level's own dramaturgy (see W3 design notes).
  b.waves([
    // «Двойной контур»: the FORK is the lesson (pathIndex 0/1 = upper/lower arm); REGENERATOR debuts.
    [{ kind: 'normal', count: 6, interval: 0.9, pathIndex: 0 }, { kind: 'normal', count: 6, interval: 0.9, pathIndex: 1, delay: 8 }],
    [{ kind: 'fast', count: 6, interval: 0.45, pathIndex: 0 }, { kind: 'fast', count: 6, interval: 0.45, pathIndex: 1, delay: 6 }],
    [{ kind: 'normal', count: 5, interval: 0.8, pathIndex: 0 }, { kind: 'normal', count: 5, interval: 0.8, pathIndex: 1 }],
    [{ kind: 'healer', count: 1, interval: 4.0 }, { kind: 'normal', count: 6, interval: 0.8, delay: 2 }],
    [{ kind: 'fast', count: 8, interval: 0.4, pathIndex: 0 }, { kind: 'healer', count: 1, interval: 4.0, pathIndex: 1, delay: 8 }, { kind: 'normal', count: 5, interval: 0.8, pathIndex: 1, delay: 9 }],
    [{ kind: 'normal', count: 10, interval: 0.6, jitter: 0.5, mix: { normal: 2, fast: 2 } }],
    [{ kind: 'normal', count: 8, interval: 0.6, pathIndex: 0 }, { kind: 'fast', count: 8, interval: 0.4, pathIndex: 1, delay: 3 }],
    [{ kind: 'healer', count: 2, interval: 3.0 }, { kind: 'fast', count: 10, interval: 0.4, delay: 3, jitter: 0.4 }],
    [{ kind: 'normal', count: 12, interval: 0.5, jitter: 0.5 }, { kind: 'fast', count: 8, interval: 0.3, delay: 10 }],
    [{ kind: 'normal', count: 16, interval: 0.4, jitter: 0.6, mix: { normal: 2, fast: 3 } }, { kind: 'healer', count: 2, interval: 3.0, delay: 8 }, { kind: 'fast', count: 10, interval: 0.25, delay: 16 }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots({ spacing: 7 })
  return b.build()
}
