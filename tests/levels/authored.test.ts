import { describe, it } from 'vitest'
import { AUTHORED_LEVELS } from '../../src/levels'
import { assertOneFinish, assertCopperEndpointsOnPads, assertWinnable } from './_harness'

const B24 = { cols: 24, rows: 18, pitch: 30 }
const B32 = { cols: 32, rows: 24, pitch: 30 }
const B44 = { cols: 44, rows: 33, pitch: 30 }
const B60 = { cols: 60, rows: 45, pitch: 30 }
const boards = [B24, B24, B32, B32, B32, B44, B44, B44, B60, B60, B60, B60]

describe('authored campaign levels', () => {
  it('all 12 levels: one finish + copper lands on pads', () => {
    AUTHORED_LEVELS.forEach((build, i) => {
      const lvl = build(boards[i])
      assertOneFinish(lvl)
      assertCopperEndpointsOnPads(lvl)
    })
  })

  // winnable by basic defence; upper guard rises with difficulty tier (won:false would fail anyway)
  const hi = [0.45, 0.5, 0.55, 0.6, 0.65, 0.6, 0.65, 0.7, 0.85, 0.85, 0.7, 0.85] // 09/10/12 (hardest) run hot under the competent reference defense
  AUTHORED_LEVELS.forEach((build, i) => {
    it(`level ${String(i + 1).padStart(2, '0')} winnable`, () => {
      assertWinnable(build(boards[i]), 0.0, hi[i])
    })
  })
})
