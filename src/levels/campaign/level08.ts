import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { transistorSwitch, amplifierStage, railSpine, powerSupply } from '../../pipeline/circuits'

// Level 08 «Высокое напряжение» — 44×33, difficulty 7.
// TWO spawns from different edges merge onto a common spine → ONE finish. Spots concentrate on the
// shared spine (the kill-zone). Decor: transistor switch + amplifier stage (high-voltage theme).
export function buildLevel08(board: Board): Level {
  const b = new LevelBuilder(board, 108, { name: 'campaign.level7.name', difficulty: 7, archetype: 'multiSpawn', tune: { hpMul: 1.95 } })
  const merge: [number, number] = [12, 16]
  const finish: [number, number] = [43, 22]
  // winding shared spine (switchbacks = more time under fire after the two spawns merge)
  const spine: [number, number][] = [merge, [38, 16], [38, 19], [16, 19], [16, 25], [40, 25], [40, 22], finish]
  // spawn 1 (top-left)
  b.path([[0, 2], [8, 2], [8, 16], merge, ...spine])
  // spawn 2 (bottom-left)
  b.path([[0, 30], [8, 30], [8, 16], merge, ...spine])
  // High-voltage theme: switching + amplification up top, control in the middle pocket,
  // power distribution along the bottom. Blocks are 3+ parts, no clone-stamping.
  b.block(transistorSwitch([26, 4], b.alloc))
  b.block(railSpine([10, 7], b.alloc, 5)); b.block(railSpine([30, 3], b.alloc, 2))
  b.block(amplifierStage([34, 8], b.alloc))
  b.block(powerSupply([12, 28], b.alloc))
  // Authored wave script — this level's own dramaturgy (see W8 design notes).
  b.waves([
    // «Высокое напряжение»: TWO entrances used TACTICALLY (0 = top, 1 = bottom);
    // CONTAINER debuts; a lone CARRIER mini-boss crowns wave 12.
    [{ kind: 'normal', count: 8, interval: 0.7, pathIndex: 0 }],
    [{ kind: 'normal', count: 8, interval: 0.7, pathIndex: 1 }],
    [{ kind: 'fast', count: 8, interval: 0.4, pathIndex: 0 }, { kind: 'fast', count: 8, interval: 0.4, pathIndex: 1, delay: 8 }],
    [{ kind: 'tank', count: 2, interval: 2.4, pathIndex: 0 }, { kind: 'rogue', count: 8, interval: 0.45, pathIndex: 1, delay: 3 }],
    [{ kind: 'carrier', count: 1, interval: 3.0 }, { kind: 'normal', count: 6, interval: 0.8, delay: 3 }],
    [{ kind: 'carrier', count: 2, interval: 2.6, pathIndex: 0 }, { kind: 'shielded', count: 4, interval: 1.2, pathIndex: 1, delay: 5 }],
    [{ kind: 'fast', count: 16, interval: 0.4, jitter: 0.5, mix: { fast: 2, rogue: 2, normal: 1 } }],
    [{ kind: 'brute', count: 3, interval: 2.2, pathIndex: 1 }, { kind: 'healer', count: 2, interval: 3.0, delay: 3 }, { kind: 'carrier', count: 1, interval: 3.0, delay: 10, pathIndex: 0 }],
    [{ kind: 'fast', count: 12, interval: 0.25, pathIndex: 0 }, { kind: 'tank', count: 2, interval: 2.4, pathIndex: 1, delay: 6 }],
    [{ kind: 'carrier', count: 3, interval: 2.4, jitter: 0.3 }, { kind: 'healer', count: 2, interval: 3.0, delay: 4 }, { kind: 'rogue', count: 10, interval: 0.4, delay: 10 }],
    [{ kind: 'shielded', count: 18, interval: 0.4, jitter: 0.5, mix: { shielded: 2, rogue: 2, fast: 2, carrier: 1 } }],
    [{ kind: 'boss', count: 1, interval: 5.0, delay: 8 }, { kind: 'tank', count: 2, interval: 2.4, delay: 10 }, { kind: 'fast', count: 16, interval: 0.22, delay: 14, mix: { fast: 3, rogue: 2 } }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots({ spacing: 10 })
  return b.build()
}
