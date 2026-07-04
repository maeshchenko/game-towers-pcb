// Daily-challenge modifiers. One shared roll per calendar day: everyone gets the same board
// (seed from the date stamp) AND the same twist. Pure + deterministic — no Date/random here,
// the caller passes the stamp. Sim-side so tests and the bot can reason about it.

import type { TowerKind } from './towerTypes'

export type DailyModId = 'swarm' | 'blackout' | 'windfall' | 'embargo' | 'iron'

export interface DailyMods {
  ids: DailyModId[]
  /** enemy hp multiplier (iron) */
  hpMul: number
  /** wave size multiplier (swarm) */
  countMul: number
  /** flat shift of the starting budget (blackout/windfall) */
  goldDelta: number
  /** tower kind that cannot be built today (embargo) */
  banned: TowerKind | null
}

/** Cannon stays available — the basic tool must always exist or some boards become unwinnable. */
const BANNABLE: readonly TowerKind[] = ['slow', 'sniper', 'mortar', 'tesla']

const POOL: readonly DailyModId[] = ['swarm', 'blackout', 'windfall', 'embargo', 'iron']

/** Two distinct modifiers per day, rolled from the YYYYMMDD stamp. */
export function rollDailyMods(stamp: string): DailyMods {
  let s = 0
  for (const ch of stamp) s = (s * 31 + ch.charCodeAt(0)) % 2147483647
  if (s <= 0) s += 2147483646
  const rnd = () => ((s = (s * 48271) % 2147483647) / 2147483647)
  // Adjacent stamps ("...01" vs "...02") seed nearly-equal states, so the first raw output
  // clusters and the same mod is picked every day. Warm up to let the LCG diverge first.
  for (let i = 0; i < 12; i++) rnd()

  const pool = [...POOL]
  const ids: DailyModId[] = [
    pool.splice(Math.floor(rnd() * pool.length), 1)[0],
    pool.splice(Math.floor(rnd() * pool.length), 1)[0],
  ]

  const mods: DailyMods = { ids, hpMul: 1, countMul: 1, goldDelta: 0, banned: null }
  for (const id of ids) {
    switch (id) {
      case 'swarm': mods.countMul *= 1.3; break
      case 'iron': mods.hpMul *= 1.15; break
      case 'blackout': mods.goldDelta -= 40; break
      case 'windfall': mods.goldDelta += 60; break
      case 'embargo': mods.banned = BANNABLE[Math.floor(rnd() * BANNABLE.length)]; break
    }
  }
  return mods
}
