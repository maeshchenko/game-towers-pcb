import type { Level } from '../model/level'
import type { TowerKind } from './towerTypes'
import { TOWER_DEFS } from './towerTypes'
import { Game } from './Game'
import { startLives } from './difficulty'

/**
 * Reference defense strategy: spend available gold on free spots in order,
 * placing cannon on most spots and slow on every 4th (i % 4 === 3).
 * Stops when the current spot's tower is unaffordable or all spots are filled.
 */
export function basicPlacement(game: Game): void {
  // Reference defense: fill the highest-value pads (best coverage first — a thinking player) with cannon
  // DPS and a slow at every 4th, then drain leftover gold into upgrades round-robin.
  const order = game.buildOrder()
  for (let r = 0; r < order.length; r++) {
    const i = order[r]
    if (!game.canBuild(i)) continue
    const kind: TowerKind = r % 4 === 3 ? 'slow' : 'cannon'
    if (game.state.gold < TOWER_DEFS[kind][0].cost) continue
    game.build(kind, i)
  }
  let progressed = true
  while (progressed) {
    progressed = false
    for (const t of game.towers) {
      if (t.level >= t.maxLevel) continue
      const cost = TOWER_DEFS[t.kind][t.level + 1].cost
      if (game.state.gold >= cost && game.upgrade(t)) progressed = true
    }
  }
}

export interface SimResult {
  won: boolean
  livesLost: number
  /** Fraction of starting lives lost: livesLost / startLives. In [0, 1]. */
  pressure: number
  wavesCleared: number
  ticks: number
}

/**
 * Headless combat simulation. Runs a full game using basicPlacement as the
 * tower strategy and returns aggregate outcome metrics.
 *
 * @param level   Level definition (paths + spots).
 * @param seed    RNG seed forwarded to Game (default 1 inside Game if omitted).
 * @param opts    fixedDt – simulation step in seconds (default 0.1);
 *                tickCap – hard upper bound on iterations (default 200 000).
 */
export function simulate(
  level: Level,
  seed?: number,
  opts?: { fixedDt?: number; tickCap?: number },
): SimResult {
  const fixedDt = opts?.fixedDt ?? 0.1
  const tickCap = opts?.tickCap ?? 200_000
  const g = new Game(level, seed)
  let ticks = 0

  while (g.state.phase !== 'win' && g.state.phase !== 'lose' && ticks < tickCap) {
    if (g.state.phase === 'build') {
      basicPlacement(g)
      g.startWave()
    }
    g.tick(fixedDt)
    ticks++
  }

  const livesLost = startLives - g.state.lives
  const pressure = livesLost / startLives

  return {
    won: g.state.phase === 'win',
    livesLost,
    pressure,
    wavesCleared: g.state.wave,
    ticks,
  }
}
