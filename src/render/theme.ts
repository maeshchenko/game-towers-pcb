// Display theme: maps internal mechanic kinds → neon names/colors/glyphs (concept Ref-B).
// Pure data + helpers; no mechanics change. enemyColor/towerAccent read from here.
import { PALETTE } from '../style/palette'
import type { TowerKind } from '../game/towerTypes'

export type EnemyGlyph = 'circle' | 'square' | 'capsule' | 'diamond' | 'hex' | 'triangle' | 'bossDiamond'
export interface EnemyTheme { name: string; color: number; glyph: EnemyGlyph }

// internal EnemyKind → themed token
export const ENEMY_THEME: Record<string, EnemyTheme> = {
  fast:   { name: 'SIGNAL',    color: PALETTE.neonCyan,    glyph: 'circle' },
  normal: { name: 'PACKET',    color: PALETTE.neonRed,     glyph: 'square' },
  healer: { name: 'BURST',     color: PALETTE.neonGold,    glyph: 'capsule' },
  brute:  { name: 'VIRUS',     color: PALETTE.neonMagenta, glyph: 'diamond' },
  tank:   { name: 'CORRUPTED', color: PALETTE.neonOrange,  glyph: 'hex' },
  rogue:  { name: 'GLITCH',    color: PALETTE.neonGreen,   glyph: 'triangle' },
  boss:   { name: 'BOSS',      color: 0xff5ed0,            glyph: 'bossDiamond' },
  shielded: { name: 'CAPSULE', color: PALETTE.neonBlue,    glyph: 'hex' },
  carrier:  { name: 'CONTAINER', color: 0xd08aff,          glyph: 'diamond' },
  fragment: { name: 'SHARD',   color: 0xff8a8a,            glyph: 'triangle' },
}
export function enemyTheme(kind: string): EnemyTheme {
  return ENEMY_THEME[kind] ?? { name: kind.toUpperCase(), color: 0xffffff, glyph: 'circle' }
}

export type TowerIcon = 'rings' | 'diamond' | 'targetRing' | 'triangle' | 'bolt'
export interface TowerTheme { name: string; color: number; icon: TowerIcon }

// internal TowerKind → themed icon-chip
export const TOWER_THEME: Record<TowerKind, TowerTheme> = {
  cannon: { name: 'PULSE',      color: PALETTE.neonCyan,    icon: 'rings' },
  sniper: { name: 'LASER',      color: PALETTE.neonBlue,    icon: 'diamond' },
  slow:   { name: 'SLOW FIELD', color: PALETTE.neonGreen,   icon: 'targetRing' },
  mortar: { name: 'MISSILE',    color: PALETTE.neonOrange,  icon: 'triangle' },
  tesla:  { name: 'TESLA',      color: PALETTE.neonMagenta, icon: 'bolt' },
}
