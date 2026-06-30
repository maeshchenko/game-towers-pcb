import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { transistorSwitch, amplifierStage, passiveBank } from '../../pipeline/circuits'

// Level 08 «Высокое напряжение» — 44×33, difficulty 7.
// TWO spawns from different edges merge onto a common spine → ONE finish. Spots concentrate on the
// shared spine (the kill-zone). Decor: transistor switch + amplifier stage (high-voltage theme).
export function buildLevel08(board: Board): Level {
  const b = new LevelBuilder(board, 108, { name: 'campaign.level7.name', difficulty: 7, archetype: 'multiSpawn', tune: { hpMul: 1.0 } })
  const merge: [number, number] = [12, 16]
  const finish: [number, number] = [43, 22]
  // winding shared spine (switchbacks = more time under fire after the two spawns merge)
  const spine: [number, number][] = [merge, [38, 16], [38, 19], [16, 19], [16, 25], [40, 25], [40, 22], finish]
  // spawn 1 (top-left)
  b.path([[0, 2], [8, 2], [8, 16], merge, ...spine])
  // spawn 2 (bottom-left)
  b.path([[0, 30], [8, 30], [8, 16], merge, ...spine])
  b.block(transistorSwitch([26, 4], b.alloc))
  b.block(amplifierStage([34, 10], b.alloc))
  b.block(passiveBank([2, 16], 4, b.alloc))
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots({ spacing: 10 })
  return b.build()
}
