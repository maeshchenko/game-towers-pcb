import { startLives, startGold, waveClearGold } from './difficulty'

export type Phase = 'build' | 'wave' | 'win' | 'lose'

export class GameState {
  lives = startLives
  gold: number
  wave = 0 // 0-based index of the NEXT wave to run
  phase: Phase = 'build'
  constructor(difficulty: number, readonly waveCount: number) { this.gold = startGold(difficulty) }
  get waveNumber(): number { return this.wave + 1 } // 1-based for display/economy
  spend(n: number): boolean { if (this.gold < n) return false; this.gold -= n; return true }
  add(n: number): void { this.gold += n }
  damageBase(leak: number): void {
    this.lives = Math.max(0, this.lives - leak)
    if (this.lives <= 0) this.phase = 'lose'
  }
  startWave(): void { if (this.phase === 'build') this.phase = 'wave' }
  /** Early next-wave call: bank the running wave's clear reward and advance the counter
   * WITHOUT leaving the 'wave' phase — the new wave overlaps the tail of the old one. */
  advanceWaveEarly(): void {
    if (this.phase !== 'wave' || this.wave + 1 >= this.waveCount) return
    this.add(waveClearGold(this.waveNumber))
    this.wave += 1
  }
  endWave(): void {
    if (this.phase !== 'wave') return
    this.add(waveClearGold(this.waveNumber))
    this.wave += 1
    this.phase = this.wave >= this.waveCount ? 'win' : 'build'
  }
}
