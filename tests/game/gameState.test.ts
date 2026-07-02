import { describe, it, expect } from 'vitest'
import { GameState } from '../../src/game/GameState'

describe('GameState', () => {
  it('starts in build with gold/lives', () => {
    const g = new GameState(0, 10)
    expect(g.phase).toBe('build'); expect(g.lives).toBe(20); expect(g.gold).toBe(130)
  })
  it('spend gates on funds', () => {
    const g = new GameState(0, 10)
    expect(g.spend(40)).toBe(true); expect(g.gold).toBe(90)
    expect(g.spend(1000)).toBe(false); expect(g.gold).toBe(90)
  })
  it('wave lifecycle awards gold and advances', () => {
    const g = new GameState(0, 10)
    g.startWave(); expect(g.phase).toBe('wave')
    g.endWave(); expect(g.phase).toBe('build'); expect(g.gold).toBe(130 + 19)
  })
  it('leak reduces lives; 0 → lose', () => {
    const g = new GameState(0, 10)
    g.damageBase(20); expect(g.phase).toBe('lose'); expect(g.lives).toBe(0)
  })
  it('clearing the last wave → win', () => {
    const g = new GameState(0, 1)
    g.startWave(); g.endWave(); expect(g.phase).toBe('win')
  })
})
