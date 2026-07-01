import { describe, it, expect } from 'vitest'
import { LevelBuilder } from '../../src/levels/dsl'
import { powerSupply } from '../../src/pipeline/circuits'
import { assertOneFinish, assertCopperEndpointsOnPads } from './_harness'

const board = { cols: 24, rows: 18, pitch: 30 }

describe('authored harness', () => {
  it('passes a valid built level', () => {
    const b = new LevelBuilder(board, 1, { name: 't', difficulty: 1 }).path([[0, 1], [23, 1]])
    b.block(powerSupply([4, 8], b.alloc))
    const lvl = b.build()
    expect(() => assertOneFinish(lvl)).not.toThrow()
    expect(() => assertCopperEndpointsOnPads(lvl)).not.toThrow()
  })
})
