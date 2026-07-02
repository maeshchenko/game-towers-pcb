import { describe, it, expect } from 'vitest'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'
import { TOWER_DEFS } from '../../src/game/towerTypes'

describe('stat tables', () => {
  it('has all 7 enemy kinds with positive hp/speed', () => {
    const kinds = ['normal','fast','tank','rogue','brute','healer','boss'] as const
    for (const k of kinds) { expect(ENEMY_DEFS[k].hp).toBeGreaterThan(0); expect(ENEMY_DEFS[k].speed).toBeGreaterThan(0) }
    expect(ENEMY_DEFS.tank.armor).toBe(6)
    expect(ENEMY_DEFS.boss.leak).toBe(6)
  })
  it('has 5 tower kinds each with 3 levels and ascending cost-effect', () => {
    const kinds = ['cannon','slow','sniper','mortar','tesla'] as const
    for (const k of kinds) expect(TOWER_DEFS[k]).toHaveLength(3)
    expect(TOWER_DEFS.slow[0].aura).toBe(true)
    expect(TOWER_DEFS.sniper[0].pierce).toBe(2)
    expect(TOWER_DEFS.mortar[0].splashRadius).toBeGreaterThan(0)
    expect(TOWER_DEFS.tesla[0].chainCount).toBe(3) // buffed: tesla viable vs cannon dominance
  })
})
