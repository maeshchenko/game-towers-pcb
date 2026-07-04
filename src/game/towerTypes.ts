export type TowerKind = 'cannon' | 'slow' | 'sniper' | 'mortar' | 'tesla'
export interface TowerLevel {
  range: number; fireRate: number; damage: number; cost: number
  slow?: number; aura?: boolean; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
  /** Cells/sec — presence marks this tower as projectile-based (damage lands on arrival). */
  projectileSpeed?: number
  /** Ignite on hit: hp/sec over burnDur seconds (tier-4 status weapons). */
  burnDps?: number
  burnDur?: number
  /** Armor shred on hit: enemy armor −N for shredDur seconds (stacks refresh, not add). */
  shredArmor?: number
  shredDur?: number
}
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6.0, fireRate: 1.5, damage: 10, cost: 40, projectileSpeed: 18 },
    { range: 6.5, fireRate: 1.6, damage: 22, cost: 60, projectileSpeed: 18 },
    { range: 7.0, fireRate: 1.8, damage: 45, cost: 90, projectileSpeed: 18 },
  ],
  slow: [
    { range: 3.5, fireRate: 1.0, damage: 0, slow: 0.60, aura: true, cost: 35 },
    { range: 4.5, fireRate: 1.0, damage: 0, slow: 0.45, aura: true, cost: 55 },
    { range: 5.0, fireRate: 1.0, damage: 0, slow: 0.30, aura: true, cost: 80 },
  ],
  sniper: [
    { range: 11.0, fireRate: 0.45, damage: 60, cost: 90, pierce: 2 },
    { range: 13.0, fireRate: 0.45, damage: 140, cost: 120, pierce: 5 },
    // pierce 8 (not 999): beats every current armor value, but keeps the armor axis alive
    // for future shielded enemies instead of hard-disabling it forever.
    { range: 15.0, fireRate: 0.50, damage: 300, cost: 180, pierce: 8 },
  ],
  mortar: [
    { range: 7.5, fireRate: 0.65, damage: 30, splashRadius: 2.6, cost: 75, projectileSpeed: 7 },
    { range: 8.5, fireRate: 0.70, damage: 60, splashRadius: 3.0, cost: 110, projectileSpeed: 7 },
    { range: 9.5, fireRate: 0.75, damage: 115, splashRadius: 3.5, cost: 160, projectileSpeed: 7 },
  ],
  tesla: [
    { range: 5.5, fireRate: 2.0, damage: 12, chainCount: 3, chainRange: 3.0, cost: 60 },
    { range: 6.0, fireRate: 2.3, damage: 22, chainCount: 4, chainRange: 3.2, cost: 85 },
    { range: 6.5, fireRate: 2.6, damage: 40, chainCount: 5, chainRange: 3.5, cost: 125 },
  ],
}

/** Tier-4 specialization: at max linear level each tower picks ONE of two branches that
 * change its ROLE (Kingdom Rush pattern), not just its numbers. Composed entirely from
 * existing sim mechanics (rate/pierce/splash/chain/aura) — no new status effects.
 * `id` doubles as the i18n key suffix (branch.<id>.name / .desc). */
export interface TowerBranch extends TowerLevel { id: string }
export const TOWER_BRANCHES: Record<TowerKind, [TowerBranch, TowerBranch]> = {
  cannon: [
    // A: rapid-fire swarm shredder  B: armor-piercing generalist
    { id: 'overclock', range: 7.0, fireRate: 3.4, damage: 34, cost: 220, projectileSpeed: 22 },
    { id: 'piercer', range: 7.5, fireRate: 1.8, damage: 95, pierce: 6, cost: 240, projectileSpeed: 18 },
  ],
  slow: [
    // A: deep freeze, tight field   B: huge coverage, moderate slow
    { id: 'cryostat', range: 5.0, fireRate: 1.0, damage: 0, slow: 0.20, aura: true, cost: 170 },
    { id: 'fieldcoil', range: 7.5, fireRate: 1.0, damage: 0, slow: 0.32, aura: true, cost: 190 },
  ],
  sniper: [
    // A: single-target boss killer that STRIPS armor — every other tower hits harder after
    // a railgun tag (the game's first cross-tower synergy)
    { id: 'railgun', range: 17.0, fireRate: 0.3, damage: 700, pierce: 12, shredArmor: 3, shredDur: 4, cost: 320 },
    { id: 'splitbeam', range: 15.0, fireRate: 0.5, damage: 340, pierce: 6, chainCount: 3, chainRange: 2.5, cost: 300 },
  ],
  mortar: [
    // A: wide incendiary carpet (burn = the game's first DoT: splash tags crowds, fire
    // finishes them — synergizes with SLOW keeping enemies inside the burning patch)
    { id: 'cluster', range: 9.5, fireRate: 0.95, damage: 80, splashRadius: 4.6, burnDps: 9, burnDur: 3, cost: 280, projectileSpeed: 7 },
    { id: 'buster', range: 10.5, fireRate: 0.45, damage: 360, splashRadius: 1.8, pierce: 10, cost: 300, projectileSpeed: 9 },
  ],
  tesla: [
    // A: swarm melter (long chains) B: heavy burst capacitor
    { id: 'arcmatrix', range: 7.0, fireRate: 2.8, damage: 48, chainCount: 8, chainRange: 4.2, cost: 260 },
    { id: 'capacitor', range: 6.5, fireRate: 1.1, damage: 170, chainCount: 4, chainRange: 3.5, cost: 240 },
  ],
}
