// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { formatHud } from '../../src/ui/GameUI'

describe('formatHud', () => {
  it('formats wave/lives/gold', () => {
    const h = formatHud({ wave: 3, waveCount: 10, lives: 18, gold: 250, phase: 'build' })
    expect(h.wave).toBe('WAVE 3/10')
    expect(h.lives).toBe('LIVES 18')
    expect(h.gold).toBe('CURRENCY 250')
  })
})
