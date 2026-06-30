export type TowerKind = 'cannon' | 'slow' | 'sniper' | 'mortar' | 'tesla'
export interface TowerLevel {
  range: number; fireRate: number; damage: number; cost: number
  slow?: number; aura?: boolean; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
}
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6.0, fireRate: 1.5, damage: 10, cost: 40 },
    { range: 6.5, fireRate: 1.7, damage: 17, cost: 45 },
    { range: 7.0, fireRate: 1.9, damage: 28, cost: 60 },
  ],
  slow: [
    { range: 3.5, fireRate: 1.0, damage: 0, slow: 0.55, aura: true, cost: 35 },
    { range: 4.5, fireRate: 1.0, damage: 0, slow: 0.45, aura: true, cost: 35 },
    { range: 5.0, fireRate: 1.0, damage: 0, slow: 0.35, aura: true, cost: 45 },
  ],
  sniper: [
    { range: 11.0, fireRate: 0.45, damage: 50, cost: 90, pierce: 4 },
    { range: 12.5, fireRate: 0.50, damage: 80, cost: 85, pierce: 8 },
    { range: 14.0, fireRate: 0.55, damage: 130, cost: 130, pierce: 999 },
  ],
  mortar: [
    { range: 7.0, fireRate: 0.7, damage: 20, splashRadius: 2.6, cost: 70 },
    { range: 7.5, fireRate: 0.8, damage: 28, splashRadius: 3.0, cost: 70 },
    { range: 8.0, fireRate: 0.9, damage: 42, splashRadius: 3.4, cost: 90 },
  ],
  tesla: [
    { range: 5.5, fireRate: 2.2, damage: 9, chainCount: 3, chainRange: 3.0, cost: 55 },
    { range: 6.0, fireRate: 2.5, damage: 13, chainCount: 4, chainRange: 3.2, cost: 55 },
    { range: 6.5, fireRate: 2.8, damage: 17, chainCount: 5, chainRange: 3.5, cost: 75 },
  ],
}
