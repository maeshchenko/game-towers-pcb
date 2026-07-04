// Achievements: declarative defs checked at run end against a per-run tracker, the sim and
// the lifetime dossier (profileStats). Persistence rides the campaign save
// (PlayerProgress.achievements, v3). The tracker is a plain EventBus subscriber — the sim
// knows nothing about achievements.
//
// Adding one: entry here (id + category + check) → i18n `ach.<id>.name/.desc` in BOTH
// locales (i18n-completeness test enforces it) → glyph mapping in ui/achievementArt.ts.
import type { Game } from './Game'
import type { TowerKind } from './towerTypes'
import { loadProgress, saveProgress } from './campaign'
import { starsEarned } from './metaUpgrades'
import type { ProfileStats } from './profileStats'
import { EMPTY_STATS } from './profileStats'

/** Everything a check may look at. `levelIndex` is null outside the campaign. */
export interface AchievementContext {
  game: Game
  tracker: AchievementTracker
  won: boolean
  levelIndex: number | null
  endless: boolean
  daily: boolean
  /** Wave reached this run (endless milestone checks). */
  endlessWave: number
  /** Lifetime dossier AFTER this run was recorded. */
  profile: ProfileStats
}

export type AchievementCategory = 'progress' | 'skill' | 'style' | 'slayer' | 'modes'

export interface AchievementDef {
  /** i18n keys: ach.<id>.name / ach.<id>.desc */
  id: string
  category: AchievementCategory
  check(ctx: AchievementContext): boolean
  /** Safe to evaluate mid-run: the check reads only live counters (tracker/game/current wave),
   * never `won` or the post-run lifetime profile. These pop a toast the instant they trigger. */
  live?: boolean
}

/** Per-run event counters. Create at run start, dispose at run end. Also drives the
 * "micro-moment" live achievements — call frame(dt) every rendered frame (after game.tick)
 * so time-based ones (quick sell, sustained slow) and per-tick bursts can be detected. */
export class AchievementTracker {
  builtKinds = new Map<TowerKind, number>()
  builds = 0
  upgrades = 0
  branches = 0
  sells = 0
  discharges = 0
  bossKills = 0
  killsByEnemy: Record<string, number> = {}

  // --- live micro-moment state ---
  private clock = 0 // sim seconds elapsed this run (advanced by frame())
  private buildAt = new Map<string, number>() // spot pos-key → clock at build (quick-sell window)
  private killsThisTick = 0
  private slowTime = new WeakMap<object, number>() // enemy → continuous seconds slowed
  /** biggest single-tick kill count (AOE wipe detector). */
  maxKillsInTick = 0
  /** killed a form on the last cell before the base. */
  lastStand = false
  /** killed a boss before it crossed the midpoint of its route. */
  bossEarlyKill = false
  /** sold a tower within 3 s of building it. */
  quickFlip = false
  /** held one form under slow for 10 s straight. */
  deepFreeze = false
  /** called the next wave within 1 s of it becoming available (set by the UI). */
  instantCall = false

  private readonly game: Game
  private unsub: () => void

  constructor(game: Game) {
    this.game = game
    const maxLinear = 3 // towerUpgraded with level ≥ 3 is the tier-4 branch pick
    const posKey = (p: { x: number; y: number }): string => `${Math.round(p.x)},${Math.round(p.y)}`
    this.unsub = game.events.on((e) => {
      if (e.type === 'towerBuilt') {
        this.builds += 1
        this.builtKinds.set(e.kind, (this.builtKinds.get(e.kind) ?? 0) + 1)
        this.buildAt.set(posKey(e.pos), this.clock)
      } else if (e.type === 'towerUpgraded') {
        if (e.level >= maxLinear) this.branches += 1
        else this.upgrades += 1
      } else if (e.type === 'towerSold') {
        this.sells += 1
        const built = this.buildAt.get(posKey(e.pos))
        if (built !== undefined && this.clock - built <= 3) this.quickFlip = true
      } else if (e.type === 'abilityUsed') this.discharges += 1
      else if (e.type === 'enemyDied') {
        this.killsByEnemy[e.kind] = (this.killsByEnemy[e.kind] ?? 0) + 1
        if (e.kind === 'boss') this.bossKills += 1
        this.killsThisTick += 1
        if (e.enemy.distToBase < this.game.pitch) this.lastStand = true
        if (e.kind === 'boss') {
          const total = e.enemy.traveled + e.enemy.distToBase
          if (total > 0 && e.enemy.traveled / total < 0.5) this.bossEarlyKill = true
        }
      }
    })
  }

  /** Advance the run clock, roll the per-tick kill burst, and accumulate sustained-slow time.
   * Call once per rendered frame from the game loop, after game.tick(). */
  frame(dt: number): void {
    this.clock += dt
    if (this.killsThisTick > this.maxKillsInTick) this.maxKillsInTick = this.killsThisTick
    this.killsThisTick = 0
    for (const enemy of this.game.enemies()) {
      if (enemy.isSlowed) {
        const t = (this.slowTime.get(enemy) ?? 0) + dt
        this.slowTime.set(enemy, t)
        if (t >= 10) this.deepFreeze = true
      } else {
        this.slowTime.set(enemy, 0)
      }
    }
  }

  dispose(): void { this.unsub() }
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Progress beats ─────────────────────────────────────────────
  { id: 'first_win', category: 'progress', check: (c) => c.won },
  { id: 'boss_down', category: 'progress', live: true, check: (c) => c.tracker.bossKills > 0 },
  { id: 'campaign_half', category: 'progress', check: (c) => c.won && c.levelIndex !== null && c.levelIndex >= 5 },
  { id: 'campaign_done', category: 'progress', check: (c) => c.won && c.levelIndex === 11 },
  { id: 'all_stars', category: 'progress', check: (c) => c.won && starsEarned(loadProgress().stars) >= 36 },
  { id: 'workshop_open', category: 'progress', check: () => starsEarned(loadProgress().stars) >= 3 },
  { id: 'full_firmware', category: 'progress', check: () => (loadProgress().metaUpgrades?.firmware ?? 0) >= 3 },

  // ── Skill ──────────────────────────────────────────────────────
  { id: 'flawless', category: 'skill', check: (c) => c.won && c.game.runStats.leaks === 0 },
  { id: 'untouchable', category: 'skill', check: (c) => c.won && c.game.runStats.leaks === 0 && c.game.state.waveCount >= 12 },
  { id: 'perfect_finale', category: 'skill', check: (c) => c.won && c.levelIndex === 11 && c.game.runStats.leaks === 0 },
  { id: 'comeback', category: 'skill', check: (c) => c.won && c.game.state.lives <= 3 },
  { id: 'hoarder', category: 'skill', check: (c) => c.won && c.game.state.gold >= 500 },
  { id: 'overclocker', category: 'skill', live: true, check: (c) => c.game.runStats.earlyCalls >= 8 },
  { id: 'no_upgrades', category: 'skill', check: (c) => c.won && c.tracker.builds > 0 && c.tracker.upgrades === 0 && c.tracker.branches === 0 },
  { id: 'discharge_ace', category: 'skill', live: true, check: (c) => c.game.runStats.dischargeKills >= 10 },

  // ── Style ──────────────────────────────────────────────────────
  { id: 'minimalist', category: 'style', check: (c) => c.won && c.tracker.builds > 0 && c.tracker.builds <= 4 },
  { id: 'monoculture', category: 'style', check: (c) => c.won && c.tracker.builtKinds.size === 1 && c.tracker.builds >= 3 },
  { id: 'diversity', category: 'style', check: (c) => c.won && c.tracker.builtKinds.size >= 5 },
  { id: 'branch_master', category: 'style', live: true, check: (c) => c.tracker.branches >= 5 },
  { id: 'recycler', category: 'style', live: true, check: (c) => c.tracker.sells >= 6 },
  { id: 'capacitor_hero', category: 'style', live: true, check: (c) => c.tracker.discharges >= 3 },
  { id: 'architect', category: 'style', live: true, check: (c) => c.tracker.builds >= 15 },

  // ── Slayer (lifetime dossier) ──────────────────────────────────
  { id: 'kills_100', category: 'slayer', check: (c) => c.profile.totalKills >= 100 },
  { id: 'kills_1000', category: 'slayer', check: (c) => c.profile.totalKills >= 1000 },
  { id: 'kills_5000', category: 'slayer', check: (c) => c.profile.totalKills >= 5000 },
  { id: 'boss_slayer', category: 'slayer', check: (c) => (c.profile.killsByEnemy['boss'] ?? 0) >= 5 },
  { id: 'carrier_hunter', category: 'slayer', check: (c) => (c.profile.killsByEnemy['carrier'] ?? 0) >= 50 },
  { id: 'wins_10', category: 'slayer', check: (c) => c.profile.totalWins >= 10 },

  // ── Modes ──────────────────────────────────────────────────────
  { id: 'daily_done', category: 'modes', check: (c) => c.daily && c.won },
  { id: 'daily_5', category: 'modes', check: (c) => c.profile.dailiesPlayed >= 5 },
  { id: 'endless_15', category: 'modes', live: true, check: (c) => c.endless && c.endlessWave >= 15 },
  { id: 'endless_25', category: 'modes', live: true, check: (c) => c.endless && c.endlessWave >= 25 },

  // ── Micro-moments (all live — the whole point is they pop mid-run) ──────────
  { id: 'last_stand', category: 'skill', live: true, check: (c) => c.tracker.lastStand },
  { id: 'instant_call', category: 'skill', live: true, check: (c) => c.tracker.instantCall },
  { id: 'chain_reaction', category: 'slayer', live: true, check: (c) => c.tracker.maxKillsInTick >= 5 },
  { id: 'quick_flip', category: 'style', live: true, check: (c) => c.tracker.quickFlip },
  { id: 'deep_freeze', category: 'skill', live: true, check: (c) => c.tracker.deepFreeze },
  { id: 'capitalist', category: 'style', live: true, check: (c) => c.game.state.gold >= 1000 },
  { id: 'interception', category: 'skill', live: true, check: (c) => c.tracker.bossEarlyKill },
  { id: 'first_blood', category: 'slayer', live: true, check: (c) => c.game.towers.some((t) => t.kills >= 100) },
]

export const ACHIEVEMENT_CATEGORIES: AchievementCategory[] = ['progress', 'skill', 'style', 'slayer', 'modes']

/** Evaluate defs, persist newly earned ids, return them (for toasts). With `liveOnly` only the
 * mid-run-safe defs run — call it on a throttle during the run so toasts pop the moment the
 * achievement triggers, then call it again unfiltered at run end for the won/lifetime ones. */
export function evaluateAchievements(ctx: AchievementContext, liveOnly = false): string[] {
  const progress = loadProgress()
  const have = new Set(progress.achievements ?? [])
  const fresh: string[] = []
  for (const def of ACHIEVEMENTS) {
    if (have.has(def.id)) continue
    if (liveOnly && !def.live) continue
    try {
      if (def.check(ctx)) fresh.push(def.id)
    } catch {
      // A broken check must never block the debrief.
    }
  }
  if (fresh.length > 0) {
    progress.achievements = [...have, ...fresh]
    saveProgress(progress)
  }
  return fresh
}

/** Convenience for tests/UI: a context with sane defaults. */
export function baseContext(game: Game, tracker: AchievementTracker): AchievementContext {
  return { game, tracker, won: false, levelIndex: null, endless: false, daily: false, endlessWave: 0, profile: EMPTY_STATS }
}
