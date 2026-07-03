import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { mcuCore, passiveBank, railSpine, powerSupply, opAmp, timer555, transistorSwitch, ledBar, ledIndicator, amplifierStage } from '../../pipeline/circuits'

// Level 11 «Критический перегруз» — 60×45, difficulty 8.
// THREE spawns funnel into a collector spine → ONE finish. Dense. Spots line the spine + convergence.
// Decor: the board is HUGE (60×45) — circuit blocks are spread across every quadrant so the
// background reads as a packed motherboard, not a mostly-bare prototype (user feedback).
export function buildLevel11(board: Board): Level {
  const b = new LevelBuilder(board, 111, { name: 'campaign.level10.name', difficulty: 8, archetype: 'multiSpawn', tune: { hpMul: 1.20, countMul: 0.65 } })
  const merge: [number, number] = [30, 22]
  const finish: [number, number] = [59, 40]
  const spine: [number, number][] = [merge, [30, 34], [50, 34], [50, 40], finish]
  b.path([[0, 2], [14, 2], [14, 22], ...spine])     // spawn 1 (top)
  b.path([[0, 22], [14, 22], ...spine])              // spawn 2 (mid)
  b.path([[0, 42], [14, 42], [14, 22], ...spine])    // spawn 3 (bottom)
  // Top band (above the spawn rows / right of the funnel)
  b.block(mcuCore([34, 6], b.alloc))
  b.block(railSpine([16, 6], b.alloc, 3)); b.block(railSpine([43, 4], b.alloc, 8))
  b.block(passiveBank([20, 4], 7, b.alloc)) // crystal + load caps: the MCU's clock, right beside it
  b.block(powerSupply([44, 10], b.alloc))
  b.block(timer555([46, 14], b.alloc))
  // Mid-left pocket (between spawn rows 2 and 22)
  b.block(opAmp([3, 8], b.alloc))
  b.block(amplifierStage([2, 14], b.alloc))
  // Center pocket (inside the funnel loop)
  b.block(transistorSwitch([23, 26], b.alloc))
  b.block(passiveBank([21, 30], 3, b.alloc))
  // Right band (between spine row 34 and the top)
  b.block(amplifierStage([38, 24], b.alloc))
  b.block(passiveBank([52, 26], 4, b.alloc))
  // Bottom band (below the collector spine)
  b.block(timer555([18, 38], b.alloc))
  b.block(railSpine([34, 42], b.alloc, 5))
  b.block(ledIndicator([44, 43], b.alloc))
  b.block(ledBar([1, 30], b.alloc, 2))
  // Authored wave script — this level's own dramaturgy (see W11 design notes).
  b.waves([
    // «Критический перегруз»: THREE entrances (0 top, 1 mid, 2 bottom) — reading the
    // direction of each assault is the level; a mini-boss crowns wave 13.
    [{ kind: 'normal', count: 10, interval: 0.6, pathIndex: 0 }],
    [{ kind: 'normal', count: 10, interval: 0.6, pathIndex: 2 }],
    [{ kind: 'fast', count: 8, interval: 0.4, pathIndex: 1 }, { kind: 'fast', count: 8, interval: 0.4, pathIndex: 1, delay: 8 }],
    [{ kind: 'tank', count: 2, interval: 2.4, pathIndex: 0 }, { kind: 'rogue', count: 10, interval: 0.4, pathIndex: 2, delay: 4 }],
    [{ kind: 'shielded', count: 5, interval: 1.1, pathIndex: 1 }, { kind: 'fast', count: 8, interval: 0.4, pathIndex: 0, delay: 6 }],
    [{ kind: 'carrier', count: 2, interval: 2.6, pathIndex: 2 }, { kind: 'healer', count: 2, interval: 3.0, delay: 4 }, { kind: 'normal', count: 10, interval: 0.6, delay: 8 }],
    [{ kind: 'fast', count: 18, interval: 0.35, jitter: 0.5, pathIndex: 0, mix: { fast: 2, rogue: 2 } }, { kind: 'tank', count: 2, interval: 2.4, pathIndex: 2, delay: 8 }],
    [{ kind: 'fast', count: 16, interval: 0.22, pathIndex: 1 }],
    [{ kind: 'brute', count: 3, interval: 2.2, pathIndex: 0 }, { kind: 'brute', count: 3, interval: 2.2, pathIndex: 2, delay: 6 }, { kind: 'healer', count: 3, interval: 2.8, delay: 3 }],
    [{ kind: 'carrier', count: 3, interval: 2.2 }, { kind: 'shielded', count: 6, interval: 1.0, delay: 6 }, { kind: 'rogue', count: 10, interval: 0.4, delay: 12 }],
    [{ kind: 'tank', count: 3, interval: 2.0, pathIndex: 0 }, { kind: 'tank', count: 3, interval: 2.0, pathIndex: 1, delay: 5 }, { kind: 'tank', count: 3, interval: 2.0, pathIndex: 2, delay: 10 }],
    [{ kind: 'rogue', count: 22, interval: 0.3, jitter: 0.5, mix: { rogue: 2, fast: 2, shielded: 2, carrier: 1 } }],
    [{ kind: 'boss', count: 1, interval: 5.0, delay: 10 }, { kind: 'fast', count: 20, interval: 0.2, delay: 14, mix: { fast: 3, rogue: 2 } }, { kind: 'healer', count: 3, interval: 2.8, delay: 12 }],
  ])

  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
