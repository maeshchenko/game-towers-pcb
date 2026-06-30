export type TowerKind = 'cannon' | 'slow' | 'sniper' | 'mortar' | 'tesla'
export interface TowerLevel {
  range: number; fireRate: number; damage: number; cost: number
  slow?: number; aura?: boolean; splashRadius?: number; chainCount?: number; chainRange?: number; pierce?: number
}
export const TOWER_DEFS: Record<TowerKind, TowerLevel[]> = {
  cannon: [
    { range: 6.0, fireRate: 1.5, damage: 10, cost: 40 },
    { range: 6.5, fireRate: 1.6, damage: 22, cost: 60 },
    { range: 7.0, fireRate: 1.8, damage: 45, cost: 90 },
  ],
  slow: [
    { range: 3.5, fireRate: 1.0, damage: 0, slow: 0.60, aura: true, cost: 35 },
    { range: 4.5, fireRate: 1.0, damage: 0, slow: 0.45, aura: true, cost: 55 },
    { range: 5.0, fireRate: 1.0, damage: 0, slow: 0.30, aura: true, cost: 80 },
  ],
  sniper: [
    { range: 11.0, fireRate: 0.45, damage: 60, cost: 90, pierce: 2 },
    { range: 13.0, fireRate: 0.45, damage: 140, cost: 120, pierce: 5 },
    { range: 15.0, fireRate: 0.50, damage: 300, cost: 180, pierce: 999 },
  ],
  mortar: [
    { range: 7.5, fireRate: 0.65, damage: 30, splashRadius: 2.6, cost: 75 },
    { range: 8.5, fireRate: 0.70, damage: 60, splashRadius: 3.0, cost: 110 },
    { range: 9.5, fireRate: 0.75, damage: 115, splashRadius: 3.5, cost: 160 },
  ],
  tesla: [
    { range: 5.5, fireRate: 2.0, damage: 12, chainCount: 3, chainRange: 3.0, cost: 60 },
    { range: 6.0, fireRate: 2.3, damage: 22, chainCount: 4, chainRange: 3.2, cost: 85 },
    { range: 6.5, fireRate: 2.6, damage: 40, chainCount: 5, chainRange: 3.5, cost: 125 },
  ],
}
