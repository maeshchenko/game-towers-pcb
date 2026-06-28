import { describe, it, expect } from 'vitest'
import { PALETTE, RENDER } from '../../src/style/palette'

describe('style', () => {
  it('exposes all required palette keys as numbers', () => {
    const keys = ['substrate','substrateEdge','silk','traceHalo','traceBand','traceCore',
      'chevron','startGreen','finishRed','buildGold','specialCyan','icBody','pinSilver','textDim']
    for (const k of keys) expect(typeof (PALETTE as Record<string, number>)[k]).toBe('number')
  })
  it('exposes numeric render constants', () => {
    expect(RENDER.traceBandWidth).toBeGreaterThan(0)
    expect(RENDER.cornerRadiusCells).toBeGreaterThan(0)
  })
})
