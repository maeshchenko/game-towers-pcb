// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { formatHud } from '../../src/ui/GameUI'
import { i18n } from '../../src/ui/i18n'

describe('formatHud', () => {
  it('formats wave/lives/gold', () => {
    i18n.lang = 'ru' // the first-launch default now follows navigator.language — pin it
    const h = formatHud({ wave: 3, waveCount: 10, lives: 18, gold: 250, phase: 'build' })
    expect(h.wave).toBe('ВОЛНА 3/10')
    expect(h.lives).toBe('ЖИЗНИ 18')
    expect(h.gold).toBe('ЭНЕРГИЯ 250')
  })
})
