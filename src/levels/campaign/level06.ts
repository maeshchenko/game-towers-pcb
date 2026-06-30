import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { mcuCore, opAmp, ledIndicator, transistorSwitch, timer555, ledBar, amplifierStage, passiveBank } from '../../pipeline/circuits'

// Level 06 «Широкая магистраль» — 44×33, difficulty 5.
// Long boustrophedon, WIDE lanes (7-row gaps), clear pacing zones (open top → tighter bottom).
// 2 specials + several builds. Decor fills the wide lane-gaps: LED bar, passive bank, MCU core.
export function buildLevel06(board: Board): Level {
  const b = new LevelBuilder(board, 106, { name: 'campaign.level5.name', difficulty: 5, archetype: 'serpentine', tune: { hpMul: 1.00 } })
  b.path([
    [0, 3], [40, 3], [40, 10], [4, 10], [4, 17], [40, 17], [40, 24], [4, 24], [4, 30], [43, 30],
  ])
      b.block(ledBar([8, 5], b.alloc, 6))
  b.block(passiveBank([22, 12], 4, b.alloc))
  b.block(mcuCore([16, 25], b.alloc))
  // ── Fill bands between lanes with wired fragments (auto-added) ──
  b.block(opAmp([20, 5], b.alloc));
  b.block(passiveBank([28, 5], 7, b.alloc));
  b.block(passiveBank([34, 6], 5, b.alloc));
  b.block(ledIndicator([12, 6], b.alloc));
  b.block(opAmp([10, 12], b.alloc));
  b.block(timer555([28, 11], b.alloc));
  b.block(passiveBank([38, 13], 1, b.alloc));
  b.block(opAmp([10, 19], b.alloc));
  b.block(transistorSwitch([22, 20], b.alloc));
  b.block(passiveBank([30, 19], 4, b.alloc));
  b.block(ledIndicator([36, 20], b.alloc));
  b.block(passiveBank([10, 26], 6, b.alloc));
  b.block(amplifierStage([24, 25], b.alloc));
  b.block(passiveBank([36, 26], 0, b.alloc));
  // Tower spots from the coverage-greedy placer → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  b.patrolSpots()
  return b.build()
}
