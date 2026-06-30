import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { mcuCore, powerSupply, passiveBank } from '../../pipeline/circuits'

// Level 11 «Критический перегруз» — 60×45, difficulty 8.
// THREE spawns funnel into a collector spine → ONE finish. Dense. Spots line the spine + convergence.
// Decor: MCU core + power supply + passive bank.
export function buildLevel11(board: Board): Level {
  const b = new LevelBuilder(board, 111, { name: 'campaign.level10.name', difficulty: 8, archetype: 'multiSpawn', tune: { hpMul: 1.20 } })
  const merge: [number, number] = [30, 22]
  const finish: [number, number] = [59, 40]
  const spine: [number, number][] = [merge, [30, 34], [50, 34], [50, 40], finish]
  b.path([[0, 2], [14, 2], [14, 22], ...spine])     // spawn 1 (top)
  b.path([[0, 22], [14, 22], ...spine])              // spawn 2 (mid)
  b.path([[0, 42], [14, 42], [14, 22], ...spine])    // spawn 3 (bottom)
  b.block(mcuCore([34, 6], b.alloc))
  b.block(powerSupply([2, 42], b.alloc))
  b.block(passiveBank([20, 4], 5, b.alloc))
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
