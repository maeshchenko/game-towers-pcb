import { describe, it, expect } from 'vitest'
import { GameState } from '../../src/game/GameState'
import { WaveManager } from '../../src/game/WaveManager'

describe('endless mode', () => {
  it('never transitions to win; waves keep counting past waveCount', () => {
    const s = new GameState(1, 2)
    s.endless = true
    for (let w = 0; w < 5; w++) { s.startWave(); s.endWave() }
    expect(s.phase).toBe('build')
    expect(s.wave).toBe(5) // far past waveCount=2, still going
  })
  it('endless waves synthesize HARDER: counts grow, elites join, bosses every 5th', () => {
    const p = [{ x: 0, y: 0 }, { x: 500, y: 0 }]
    const script = [[{ kind: 'normal' as const, count: 6, interval: 1 }]]
    const wm = new WaveManager([p], script, 1, 50, 1, 9)
    const w12 = wm.peek(12)  // over = 12
    const w20 = wm.peek(20)  // over = 20
    const total = (w: typeof w12) => w.filter((g) => !g.mix).reduce((s2, g) => s2 + g.count, 0)
    expect(total(w12)).toBeGreaterThan(6)          // template counts scaled up
    expect(total(w20)).toBeGreaterThan(total(w12)) // and keep growing
    expect(w12.some((g) => g.mix)).toBe(true)      // elite mixed squad joined
    expect(wm.peek(14).some((g) => g.kind === 'boss')).toBe(true) // i%5===4 → boss
    expect(wm.peek(0)).toEqual(script[0])          // scripted waves untouched
  })

  it('WaveManager wraps the script while the hp ramp compounds from the real index', () => {
    const p = [{ x: 0, y: 0 }, { x: 500, y: 0 }]
    const wm = new WaveManager([p], [[{ kind: 'normal', count: 1, interval: 0.1 }]], 1, 50, 1, 5)
    wm.startWave(0)
    let guard = 0
    while (wm.active.length === 0 && guard++ < 100) wm.update(0.1)
    const hpWave0 = wm.active[0].maxHp
    wm.startWave(10) // wraps to the same script entry…
    guard = 0
    while (wm.active.length < 2 && guard++ < 100) wm.update(0.1)
    const hpWave10 = wm.active[1].maxHp
    expect(hpWave10).toBeGreaterThan(hpWave0) // …but the ramp kept compounding
  })
})

describe('endless early call (wave-dupe exploit regression)', () => {
  it('advanceWaveEarly keeps advancing past waveCount in endless', () => {
    const s = new GameState(1, 2)
    s.endless = true
    s.startWave()
    s.advanceWaveEarly()
    expect(s.wave).toBe(1)
    // Beyond the scripted count: the guard must NOT freeze the counter in endless —
    // a frozen counter re-runs the same wave and pays the early-call bonus every click.
    s.advanceWaveEarly()
    expect(s.wave).toBe(2)
    s.advanceWaveEarly()
    expect(s.wave).toBe(3)
  })
  it('non-endless still refuses to advance past the last wave', () => {
    const s = new GameState(1, 2)
    s.startWave()
    s.advanceWaveEarly()
    expect(s.wave).toBe(1)
    const gold = s.gold
    s.advanceWaveEarly() // last wave — no advance, no free clear gold
    expect(s.wave).toBe(1)
    expect(s.gold).toBe(gold)
  })
})

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
