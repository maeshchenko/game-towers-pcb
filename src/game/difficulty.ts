// cells/sec * pitch gives px/sec; SPEED_SCALE tunes the felt pace (raise to speed enemies up).
export const SPEED_SCALE = 1.6
export const startLives = 20
export function hpScale(difficulty: number): number { return 1 + difficulty * 0.06 }
// Generous economy is a design value: the fun of a TD is BUILDING — many towers, many
// shots — not sitting broke. Wave pressure is balanced by the per-wave HP ramp + hpMul instead.
export function startGold(difficulty: number): number { return 130 + difficulty * 15 }
export function waveClearGold(wave1Based: number): number { return 16 + wave1Based * 3 }
export function effectiveDamage(raw: number, armor: number, pierce = 0): number {
  return Math.max(1, raw - Math.max(0, armor - pierce))
}
