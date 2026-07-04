// Lifetime profile stats ("Личное дело оператора"): accumulated at every run end and
// surfaced in the campaign menu + used by cumulative achievements (kills_1000 etc.).
// Storage is its own key — resetting campaign progress deliberately keeps the dossier.
import { storageGet, storageSet } from '../util/safeStorage'
import type { TowerKind } from './towerTypes'

const KEY = 'pcb_td_stats_v1'

export interface ProfileStats {
  totalKills: number
  totalWins: number
  totalLosses: number
  totalLeaks: number
  totalGoldEarned: number
  totalBuilds: number
  buildsByKind: Partial<Record<TowerKind, number>>
  killsByEnemy: Record<string, number>
  totalDischarges: number
  totalBranches: number
  bestEndlessWave: number
  dailiesPlayed: number
}

export const EMPTY_STATS: ProfileStats = {
  totalKills: 0, totalWins: 0, totalLosses: 0, totalLeaks: 0, totalGoldEarned: 0,
  totalBuilds: 0, buildsByKind: {}, killsByEnemy: {}, totalDischarges: 0,
  totalBranches: 0, bestEndlessWave: 0, dailiesPlayed: 0,
}

export function loadStats(): ProfileStats {
  try {
    const raw = storageGet(KEY)
    if (!raw) return { ...EMPTY_STATS, buildsByKind: {}, killsByEnemy: {} }
    const p = JSON.parse(raw) as Partial<ProfileStats>
    return {
      ...EMPTY_STATS,
      ...p,
      buildsByKind: (p.buildsByKind && typeof p.buildsByKind === 'object' ? p.buildsByKind : {}) as ProfileStats['buildsByKind'],
      killsByEnemy: (p.killsByEnemy && typeof p.killsByEnemy === 'object' ? p.killsByEnemy : {}),
    }
  } catch {
    return { ...EMPTY_STATS, buildsByKind: {}, killsByEnemy: {} }
  }
}

export interface RunRecord {
  won: boolean
  kills: number
  leaks: number
  goldEarned: number
  builds: Partial<Record<TowerKind, number>>
  killsByEnemy: Record<string, number>
  discharges: number
  branches: number
  endlessWave: number
  daily: boolean
}

/** Merge one finished run into the dossier; returns the updated stats (already saved). */
export function recordRun(run: RunRecord): ProfileStats {
  const s = loadStats()
  s.totalKills += run.kills
  if (run.won) s.totalWins += 1
  else s.totalLosses += 1
  s.totalLeaks += run.leaks
  s.totalGoldEarned += run.goldEarned
  for (const [k, n] of Object.entries(run.builds)) {
    s.totalBuilds += n ?? 0
    s.buildsByKind[k as TowerKind] = (s.buildsByKind[k as TowerKind] ?? 0) + (n ?? 0)
  }
  for (const [k, n] of Object.entries(run.killsByEnemy)) {
    s.killsByEnemy[k] = (s.killsByEnemy[k] ?? 0) + n
  }
  s.totalDischarges += run.discharges
  s.totalBranches += run.branches
  s.bestEndlessWave = Math.max(s.bestEndlessWave, run.endlessWave)
  if (run.daily) s.dailiesPlayed += 1
  storageSet(KEY, JSON.stringify(s))
  return s
}

/** Most-built tower kind, or null before the first build. */
export function favoriteTower(s: ProfileStats): TowerKind | null {
  let best: TowerKind | null = null
  let bestN = 0
  for (const [k, n] of Object.entries(s.buildsByKind)) {
    if ((n ?? 0) > bestN) { bestN = n ?? 0; best = k as TowerKind }
  }
  return best
}
