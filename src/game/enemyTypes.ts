export type EnemyKind = 'normal' | 'fast' | 'tank' | 'rogue' | 'brute' | 'healer' | 'boss'
export interface EnemyDef { kind: EnemyKind; hp: number; speed: number; bounty: number; armor: number; leak: number }
export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 45, speed: 2.0, bounty: 4, armor: 0, leak: 1 },
  fast: { kind: 'fast', hp: 24, speed: 4.5, bounty: 5, armor: 0, leak: 1 },
  tank: { kind: 'tank', hp: 200, speed: 1.0, bounty: 16, armor: 6, leak: 3 },
  rogue: { kind: 'rogue', hp: 15, speed: 6.0, bounty: 3, armor: 0, leak: 1 },
  brute: { kind: 'brute', hp: 400, speed: 1.3, bounty: 22, armor: 0, leak: 3 },
  healer: { kind: 'healer', hp: 90, speed: 1.8, bounty: 20, armor: 0, leak: 2 },
  boss: { kind: 'boss', hp: 2600, speed: 0.9, bounty: 140, armor: 6, leak: 8 },
}
