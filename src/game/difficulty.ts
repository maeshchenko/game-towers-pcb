// cells/sec * pitch gives px/sec; SPEED_SCALE tunes the felt pace (raise to speed enemies up).
export const SPEED_SCALE = 1.6
export const startLives = 20
export function hpScale(difficulty: number): number { return 1 + difficulty * 0.06 }
export function startGold(difficulty: number): number { return 120 + difficulty * 15 }
export function waveClearGold(wave1Based: number): number { return 12 + wave1Based * 2 }
export function effectiveDamage(raw: number, armor: number, pierce = 0): number {
  return Math.max(1, raw - Math.max(0, armor - pierce))
}
