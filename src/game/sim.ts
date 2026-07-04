import type { Level } from '../model/level'
import type { TowerKind } from './towerTypes'
import { TOWER_DEFS, TOWER_BRANCHES } from './towerTypes'
import { Game } from './Game'
import { startLives } from './difficulty'

/**
 * Reference defense strategy: spend available gold on free spots in order,
 * placing cannon on most spots and slow on every 4th (i % 4 === 3).
 * Stops when the current spot's tower is unaffordable or all spots are filled.
 */
export function basicPlacement(game: Game): void {
  // Human-like reference defense: CONCENTRATE, don't sprawl. Real players build a few towers
  // on the best-coverage spots and upgrade them before expanding — that is far stronger per
  // gold than spreading level-0 towers everywhere, so difficulty must be calibrated against it.
  // Special spots get long-range/heavy towers (sniper/mortar); regular spots rotate
  // slow/tesla/mortar/sniper/cannon for full counter-play coverage.
  const order = game.buildOrder()
  // A player realistically uses the top-coverage spots plus a little sprawl on huge maps.
  const cap = Math.min(order.length, 7 + Math.floor(order.length / 5))
  const kindFor = (r: number, special: boolean): TowerKind => {
    if (special) return r % 2 === 0 ? 'sniper' : 'mortar'
    // Damage first: a lone zero-damage SLOW as the opening tower is a guaranteed wave-1 wipe.
    const mod = r % 5
    return mod === 0 ? 'cannon' : mod === 1 ? 'tesla' : mod === 2 ? 'mortar' : mod === 3 ? 'slow' : 'sniper'
  }
  let progressed = true
  while (progressed) {
    progressed = false
    // Upgrades first once a base exists: players build 3-4 towers for coverage, THEN concentrate.
    // Pure upgrade-first starves multi-spawn maps of coverage (one L3 cannon vs three entrances).
    if (game.towers.length >= Math.min(4, cap)) for (const t of game.towers) {
      if (t.level >= t.maxLevel) continue
      // Reference bot must SEE tier-4 power, or balance calibration lies about strong players.
      // It always picks branch 0 — branch choice is player expression, not bot strategy.
      if (t.canBranch) {
        if (game.state.gold >= TOWER_BRANCHES[t.kind][0].cost && game.upgradeBranch(t, 0)) progressed = true
        continue
      }
      const cost = TOWER_DEFS[t.kind][t.level + 1].cost
      if (game.state.gold >= cost && game.upgrade(t)) progressed = true
    }
    // Then the single next-best spot.
    for (let r = 0; r < cap; r++) {
      const i = order[r]
      if (!game.canBuild(i)) continue
      const kind = kindFor(r, game.isSpecial(i))
      if (game.state.gold >= TOWER_DEFS[kind][0].cost && game.build(kind, i)) { progressed = true; break }
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
