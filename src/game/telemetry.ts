// Per-wave balance telemetry over the reference defense. Framework-free; reused by
// scripts/wave-telemetry.ts and future balance tooling (also intended for reuse in
// future tower-defense projects).
import type { Level } from '../model/level'
import { Game } from './Game'
import { basicPlacement } from './sim'
import { startLives } from './difficulty'

export interface WaveStat {
  wave: number       // 1-based
  leaks: number      // lives lost during this wave
  goldStart: number  // gold at wave start (after the build phase spent it)
  towers: number     // towers standing at wave start
  durationSec: number
  kills: number
}

export interface WaveTelemetry {
  won: boolean
  livesLost: number
  waves: WaveStat[]
  /** True when losses are meaningful (≥4) and one wave contributes ≥70% of them —
   * a difficulty cliff, not a curve. */
  cliff: boolean
}

export function waveTelemetry(level: Level, seed?: number, opts?: { fixedDt?: number; tickCap?: number }): WaveTelemetry {
  const fixedDt = opts?.fixedDt ?? 0.1
  const tickCap = opts?.tickCap ?? 300_000
  const g = new Game(level, seed)
  let ticks = 0
  const waves: WaveStat[] = []
  let cur: WaveStat | null = null
  let kills = 0
  const killAtWaveStart: number[] = []
  g.events.on((e) => {
    if (e.type === 'leak' && cur) cur.leaks += e.livesLost
    if (e.type === 'enemyDied') kills++
  })
  while (g.state.phase !== 'win' && g.state.phase !== 'lose' && ticks < tickCap) {
    if (g.state.phase === 'build') {
      basicPlacement(g)
      cur = { wave: waves.length + 1, leaks: 0, goldStart: g.state.gold, towers: g.towers.length, durationSec: 0, kills: 0 }
      waves.push(cur)
      killAtWaveStart.push(kills)
      g.startWave()
    }
    g.tick(fixedDt)
    if (cur) cur.durationSec += fixedDt
    ticks++
  }
  waves.forEach((w, i) => { w.kills = (killAtWaveStart[i + 1] ?? kills) - killAtWaveStart[i] })
  const livesLost = startLives - g.state.lives
  const maxWaveLeak = Math.max(0, ...waves.map((w) => w.leaks))
  return {
    won: g.state.phase === 'win',
    livesLost,
    waves,
    cliff: livesLost >= 4 && maxWaveLeak / livesLost >= 0.7,
  }
}
