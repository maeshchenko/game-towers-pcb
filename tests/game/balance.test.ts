import { describe, it, expect } from 'vitest'
import { generateBalancedLevel, evaluate, FAIR_LO, FAIR_HI } from '../../src/game/balance'
import { generateLevel } from '../../src/pipeline/generator'

describe('balance', () => {
  const board = { cols: 64, rows: 48, pitch: 24 }

  it('generateBalancedLevel tags a balance verdict and is deterministic', () => {
    const a = generateBalancedLevel({ board, difficulty: 5, seed: 1 })
    const b = generateBalancedLevel({ board, difficulty: 5, seed: 1 })
    expect(a).toEqual(b)
    expect(typeof a.meta.balance!.pressure).toBe('number')
  })

  it('produced levels are winnable (the core guarantee) and mostly in the fair band', () => {
    let won = 0, fair = 0
    for (let s = 0; s < 6; s++) {
      const v = generateBalancedLevel({ board, difficulty: 5, seed: s }).meta.balance!
      if (v.won) won++
      if (v.won && v.pressure >= FAIR_LO && v.pressure <= FAIR_HI) fair++
    }
    expect(won).toBe(6)                      // every produced level is winnable by a basic defense
    expect(fair).toBeGreaterThanOrEqual(3)   // most land in the fair-pressure band
  })

  it('evaluate is deterministic', () => {
    const lvl = generateLevel({ board, difficulty: 5, seed: 3 })
    expect(evaluate(lvl, 3)).toEqual(evaluate(lvl, 3))
  })
})
