import type { Board, Level } from '../../model/level'
import { LevelBuilder } from '../dsl'
import { ledIndicator, passiveBank, railSpine } from '../../pipeline/circuits'

// Level 01 «Вводные шины» — 24×18, difficulty 1, tutorial.
// Gentle 3-lane serpentine, START top-left → FINISH bottom-right (opposite corners), many soft turns
// (= EASY per td-map-design research). Decor is HAND-PLACED into every free band BETWEEN the lanes
// (never on the track) and wired pad-to-pad. Tower spots come from the proven coverage placer, so
// turrets land BESIDE the road, never on it.
export function buildLevel01(board: Board): Level {
  const b = new LevelBuilder(board, 101, { name: 'campaign.level0.name', difficulty: 1, archetype: 'serpentine', tune: { hpMul: 2.10 } })
  b.path([
    [0, 2], [18, 2], [18, 6], [4, 6], [4, 10], [20, 10], [20, 14], [23, 14],
  ])

  // ── Hand-placed decor, one block per free band — a populated board, not one lonely cluster ──
  // Band A (rows 0–1, above the top lane): a decoupling pair
  b.block(passiveBank([18, 0], 4, b.alloc))    // decoupling pair, top-right
  b.block(railSpine([0, 17], b.alloc, 1))      // power rail along the bottom edge
  // Band B (rows 3–5, between lanes 1 & 2): a resistor divider
  b.block(passiveBank([1, 4], 5, b.alloc))     // R-divider, left
  // Band D (rows 7–9, between lanes 2 & 3): an LED indicator
  b.block(ledIndicator([14, 8], b.alloc))      // LED + series R
  // Band F (rows 11–13, between lanes 3 & 4): crystal oscillator + an RC filter
  b.block(passiveBank([6, 12], 7, b.alloc))    // crystal + 2 load caps
  b.block(passiveBank([15, 12], 0, b.alloc))   // RC filter
  // Band G (rows 15–17, bottom free strip): two small passive fragments
  b.block(passiveBank([2, 15], 1, b.alloc))    // R + diode
  b.block(passiveBank([14, 15], 6, b.alloc))   // snubber (diode + cap)

  // Tower spots: coverage-greedy placer over the path → always BESIDE the lanes, never on them.
  // Tower spots: strategic, off-path (gap from trace), and clear of all decor (computed last).
  // spacing tightened slightly: decor now correctly excludes spots from its footprint (occupancy
  // fix), so the default spacing left too few legal slots near the dense top bands.
  // Authored wave script — this level's own dramaturgy (see W1 design notes).
  b.waves([
    // «Вводные шины»: only PACKETS — 8 waves that teach pacing, not variety.
    [{ kind: 'normal', count: 5, interval: 1.2 }],
    [{ kind: 'normal', count: 4, interval: 1.0 }, { kind: 'normal', count: 4, interval: 0.9, delay: 6, jitter: 0.4 }],
    [{ kind: 'normal', count: 6, interval: 0.9, jitter: 0.5 }, { kind: 'normal', count: 3, interval: 0.5, delay: 8 }],
    [{ kind: 'normal', count: 5, interval: 1.1 }, { kind: 'normal', count: 5, interval: 0.8, delay: 7 }],
    [{ kind: 'normal', count: 8, interval: 0.7, jitter: 0.3 }],
    [{ kind: 'normal', count: 5, interval: 0.9 }, { kind: 'normal', count: 6, interval: 0.6, delay: 6 }, { kind: 'normal', count: 4, interval: 0.4, delay: 14 }],
    [{ kind: 'normal', count: 10, interval: 0.55, jitter: 0.5 }],
    [{ kind: 'normal', count: 6, interval: 0.8 }, { kind: 'normal', count: 10, interval: 0.3, delay: 8 }],
  ])

  b.patrolSpots({ spacing: 3.5 })
  return b.build()
}
