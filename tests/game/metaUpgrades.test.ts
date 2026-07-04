import { describe, it, expect } from 'vitest'
import {
  META_UPGRADES, META_UPGRADE_IDS, metaEffects, starsSpent, starsEarned, nextTierCost, buyTier, NO_META,
} from '../../src/game/metaUpgrades'
import { Game } from '../../src/game/Game'
import type { Level } from '../../src/model/level'

function miniLevel(): Level {
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

describe('meta upgrades: data + math', () => {
  it('a full tree costs 33 of the 36 campaign stars (12 levels × 3★)', () => {
    const full = Object.fromEntries(META_UPGRADE_IDS.map((id) => [id, META_UPGRADES[id].tiers.length]))
    expect(starsSpent(full)).toBe(33)
  })
  it('empty tree → identity effects', () => {
    expect(metaEffects(undefined)).toEqual(NO_META)
    expect(metaEffects({})).toEqual(NO_META)
    expect(starsSpent({})).toBe(0)
  })
  it('effects come from the CURRENT tier, not a sum of tiers', () => {
    expect(metaEffects({ reserve: 2 }).startGold).toBe(45)
    expect(metaEffects({ firmware: 3 }).damageMul).toBeCloseTo(1.12, 5)
    expect(metaEffects({ recycler: 1 }).sellRefund).toBeCloseTo(0.68, 5)
  })
  it('starsEarned sums and clamps star records', () => {
    expect(starsEarned({ 0: 3, 1: 2, 2: 1 })).toBe(6)
    expect(starsEarned({ 0: 99, 1: -5, 2: NaN as unknown as number })).toBe(3)
  })
  it('buyTier respects affordability and max level; corrupt levels are clamped', () => {
    expect(buyTier('reserve', {}, 0)).toBeNull()                 // can't afford (cost 1)
    expect(buyTier('reserve', {}, 1)).toEqual({ reserve: 1 })
    expect(buyTier('reserve', { reserve: 3 }, 99)).toBeNull()    // maxed
    expect(nextTierCost('reserve', { reserve: 3 })).toBeNull()
    expect(metaEffects({ reserve: 99 as number }).startGold).toBe(80)  // clamp to top tier
    expect(starsSpent({ reserve: -7 as number })).toBe(0)
  })
})

describe('meta upgrades: application in Game', () => {
  const FULL = metaEffects({ reserve: 3, armor: 3, recycler: 3, capacitor: 3, firmware: 3 })
  it('startGold and lives are raised at construction', () => {
    const plain = new Game(miniLevel(), 1)
    const meta = new Game(miniLevel(), 1, { meta: FULL })
    expect(meta.state.gold).toBe(plain.state.gold + 80)
    expect(meta.state.lives).toBe(plain.state.lives + 6)
  })
  it('sell refund uses the meta fraction', () => {
    const g = new Game(miniLevel(), 1, { meta: FULL })
    g.build('cannon', 0) // cost 40
    expect(g.sellValue(g.towers[0])).toBe(Math.floor(40 * 0.85))
  })
  it('tower damage is scaled by damageMul', () => {
    const g = new Game(miniLevel(), 1, { meta: FULL })
    g.build('cannon', 0)
    g.startWave()
    let guard = 0
    while (g.enemies().length === 0 && guard++ < 2000) g.tick(0.05)
    // The tower's shot pipeline runs through Tower.update — check its produced damage.
    const t = g.towers[0]
    const shot = t.update(10, g.enemies())
    expect(shot?.damage).toBeCloseTo(10 * 1.12, 5)
  })
  it('discharge cooldown is reduced', () => {
    const g = new Game(miniLevel(), 1, { meta: FULL })
    g.startWave()
    let guard = 0
    while (g.enemies().length === 0 && guard++ < 2000) g.tick(0.05)
    expect(g.useDischarge(g.enemies()[0].pos)).toBe(true)
    expect(g.dischargeCooldown).toBeCloseTo(45 - 20, 5)
  })
})
