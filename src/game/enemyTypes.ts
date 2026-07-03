export type EnemyKind = 'normal' | 'fast' | 'tank' | 'rogue' | 'brute' | 'healer' | 'boss' | 'shielded' | 'carrier' | 'fragment'

/** Data-driven special behaviours. All enemy quirks live HERE, not in scattered if-kind
 * branches — adding an enemy is a def entry, not edits across three files. */
export interface EnemyAbilities {
  /** Ragged movement: alternates lo/hi speed multipliers each `period` seconds (rogue). */
  erratic?: { period: number; lo: number; hi: number }
  /** Heals nearby allies: flat + pct of their maxHp, per second, within radius (cells). */
  heal?: { radius: number; flat: number; pct: number }
  /** Ignores slow effects entirely (boss). */
  slowImmune?: boolean
  /** Absorbs the first N HITS completely (any damage size) — countered by fire RATE, not alpha. */
  shield?: { hits: number }
  /** On death splits into smaller enemies at the same path position. */
  splitInto?: { kind: EnemyKind; count: number }
  /** Scripted phases keyed to hp fraction (boss): 2 = enraged speed, 3 = glitch dashes. */
  bossPhases?: boolean
}

export interface EnemyDef {
  kind: EnemyKind; hp: number; speed: number; bounty: number; armor: number; leak: number
  abilities?: EnemyAbilities
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  normal: { kind: 'normal', hp: 45, speed: 2.0, bounty: 4, armor: 0, leak: 1 },
  fast: { kind: 'fast', hp: 24, speed: 4.5, bounty: 5, armor: 0, leak: 1 },
  tank: { kind: 'tank', hp: 200, speed: 1.0, bounty: 16, armor: 6, leak: 3 },
  rogue: { kind: 'rogue', hp: 15, speed: 6.0, bounty: 3, armor: 0, leak: 1, abilities: { erratic: { period: 0.6, lo: 0.3, hi: 2.2 } } },
  brute: { kind: 'brute', hp: 400, speed: 1.3, bounty: 22, armor: 0, leak: 3 },
  healer: { kind: 'healer', hp: 90, speed: 1.8, bounty: 20, armor: 0, leak: 2, abilities: { heal: { radius: 2.5, flat: 15, pct: 0.03 } } },
  boss: { kind: 'boss', hp: 1800, speed: 1.1, bounty: 140, armor: 4, leak: 6, abilities: { slowImmune: true, bossPhases: true } },
  // Shield eats the first N hits regardless of size: LASER alpha-shots waste on it, rapid
  // PULSE/TESLA strip it — the counter is fire RATE, keeping the tower matrix honest.
  shielded: { kind: 'shielded', hp: 60, speed: 2.2, bounty: 8, armor: 0, leak: 1, abilities: { shield: { hits: 6 } } },
  // Carrier splits into fragments on death — killing it early makes MORE work for the exit
  // defense; splash/chain towers clean the shards. Punishes pure single-target builds.
  carrier: { kind: 'carrier', hp: 260, speed: 1.2, bounty: 18, armor: 2, leak: 3, abilities: { splitInto: { kind: 'fragment', count: 4 } } },
  fragment: { kind: 'fragment', hp: 18, speed: 3.8, bounty: 2, armor: 0, leak: 1 },
}
