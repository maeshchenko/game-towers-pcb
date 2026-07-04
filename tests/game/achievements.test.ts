// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { Game } from '../../src/game/Game'
import type { Level } from '../../src/model/level'
import { AchievementTracker, evaluateAchievements, ACHIEVEMENTS, type AchievementContext } from '../../src/game/achievements'
import { loadProgress, saveProgress } from '../../src/game/campaign'
import { EMPTY_STATS, recordRun, loadStats, favoriteTower } from '../../src/game/profileStats'

let store: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { store = {} },
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })

function miniLevel(): Level {
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

function ctxFor(game: Game, tracker: AchievementTracker, won = true): AchievementContext {
  return { game, tracker, won, levelIndex: 0, endless: false, daily: false, endlessWave: 0, profile: EMPTY_STATS }
}

beforeEach(() => {
  localStorage.clear()
})

describe('achievements', () => {
  it('tracker counts builds/sells per kind from the event bus', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    g.state.add(1000)
    g.build('cannon', 0)
    g.sell(g.towers[0])
    g.build('tesla', 0)
    expect(t.builds).toBe(2)
    expect(t.sells).toBe(1)
    expect(t.builtKinds.get('cannon')).toBe(1)
    expect(t.builtKinds.get('tesla')).toBe(1)
    t.dispose()
    g.build('cannon', 99 as number) // invalid — but also post-dispose: no counting either way
    expect(t.builds).toBe(2)
  })

  it('awards new achievements once and persists them', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    g.build('cannon', 0)
    const fresh = evaluateAchievements(ctxFor(g, t))
    expect(fresh).toContain('first_win')
    expect(fresh).toContain('flawless')    // 0 leaks
    expect(fresh).toContain('minimalist')  // 1 tower
    expect(loadProgress().achievements).toEqual(expect.arrayContaining(fresh))
    // Second evaluation: nothing new.
    expect(evaluateAchievements(ctxFor(g, t))).toEqual([])
  })

  it('loss withholds win-gated achievements but not run-based ones', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    for (let i = 0; i < 6; i++) { g.state.add(100); g.build('cannon', 0); g.sell(g.towers[0]) }
    const fresh = evaluateAchievements(ctxFor(g, t, false))
    expect(fresh).not.toContain('first_win')
    expect(fresh).toContain('recycler') // 6 sells counts even on defeat
  })

  it('endless wave milestone', () => {
    const g = new Game(miniLevel(), 1, { endless: true })
    const t = new AchievementTracker(g)
    const fresh = evaluateAchievements({ game: g, tracker: t, won: false, levelIndex: null, endless: true, daily: false, endlessWave: 15, profile: EMPTY_STATS })
    expect(fresh).toContain('endless_15')
    expect(fresh).not.toContain('endless_25')
  })

  it('lifetime dossier achievements read the profile', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    const profile = { ...EMPTY_STATS, totalKills: 1200, killsByEnemy: { boss: 5 }, totalWins: 10, dailiesPlayed: 5 }
    const fresh = evaluateAchievements({ ...ctxFor(g, t, false), profile })
    expect(fresh).toEqual(expect.arrayContaining(['kills_100', 'kills_1000', 'boss_slayer', 'wins_10', 'daily_5']))
    expect(fresh).not.toContain('kills_5000')
  })

  it('profileStats: recordRun accumulates and favoriteTower picks the most built', () => {
    recordRun({ won: true, kills: 30, leaks: 2, goldEarned: 500, builds: { cannon: 3, tesla: 1 }, killsByEnemy: { normal: 25, boss: 1 }, discharges: 2, branches: 1, endlessWave: 0, daily: false })
    recordRun({ won: false, kills: 10, leaks: 20, goldEarned: 100, builds: { cannon: 1 }, killsByEnemy: { normal: 10 }, discharges: 0, branches: 0, endlessWave: 12, daily: true })
    const s = loadStats()
    expect(s.totalKills).toBe(40)
    expect(s.totalWins).toBe(1)
    expect(s.totalLosses).toBe(1)
    expect(s.buildsByKind.cannon).toBe(4)
    expect(s.killsByEnemy.boss).toBe(1)
    expect(s.bestEndlessWave).toBe(12)
    expect(s.dailiesPlayed).toBe(1)
    expect(favoriteTower(s)).toBe('cannon')
  })

  it('liveOnly evaluates mid-run defs but withholds win/lifetime ones', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    for (let i = 0; i < 6; i++) { g.state.add(100); g.build('cannon', 0); g.sell(g.towers[0]) }
    // won=true context, but liveOnly must ignore won-gated defs entirely.
    const fresh = evaluateAchievements(ctxFor(g, t, true), true)
    expect(fresh).toContain('recycler')     // live: 6 sells
    expect(fresh).not.toContain('first_win') // won-gated, not live
    expect(fresh).not.toContain('minimalist')
  })

  it('live-flagged defs never read the post-run profile', () => {
    // Guard: a def marked live must be safe to run with EMPTY_STATS mid-run.
    const live = ACHIEVEMENTS.filter((a) => a.live).map((a) => a.id)
    expect(live).toEqual(expect.arrayContaining(['boss_down', 'discharge_ace', 'branch_master', 'recycler', 'architect', 'endless_15']))
    // None of the lifetime/slayer ids should be live.
    for (const id of ['kills_100', 'kills_1000', 'wins_10', 'first_win']) expect(live).not.toContain(id)
  })

  it('quick-flip: selling within 3 s of building flags the tracker', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    g.state.add(1000)
    g.build('cannon', 0)
    t.frame(1) // 1 s elapsed
    g.sell(g.towers[0])
    expect(t.quickFlip).toBe(true)
  })

  it('quick-flip: selling after the window does NOT flag', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    g.state.add(1000)
    g.build('cannon', 0)
    for (let i = 0; i < 5; i++) t.frame(1) // 5 s elapsed
    g.sell(g.towers[0])
    expect(t.quickFlip).toBe(false)
  })

  it('chain-reaction: maxKillsInTick captures the biggest single-tick burst', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    for (let i = 0; i < 6; i++) g.events.emit({ type: 'enemyDied', kind: 'normal', pos: { x: 0, y: 0 }, bounty: 1, enemy: { distToBase: 999, traveled: 1 } as never })
    t.frame(0.016) // roll the tick
    expect(t.maxKillsInTick).toBe(6)
    expect(evaluateAchievements(ctxFor(g, t, false), true)).toContain('chain_reaction')
  })

  it('interception vs last_stand read the dying enemy geometry', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    // boss killed early on its route (traveled fraction < 0.5)
    g.events.emit({ type: 'enemyDied', kind: 'boss', pos: { x: 0, y: 0 }, bounty: 1, enemy: { distToBase: 800, traveled: 200 } as never })
    expect(t.bossEarlyKill).toBe(true)
    // form killed on the last cell before the base (distToBase < pitch = 24)
    g.events.emit({ type: 'enemyDied', kind: 'normal', pos: { x: 0, y: 0 }, bounty: 1, enemy: { distToBase: 5, traveled: 999 } as never })
    expect(t.lastStand).toBe(true)
  })

  it('deep-freeze: a form slowed for 10 s straight flags', () => {
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    const slowed = { isSlowed: true }
    g.enemies = (() => [slowed]) as never
    for (let i = 0; i < 11; i++) t.frame(1)
    expect(t.deepFreeze).toBe(true)
  })

  it('every achievement id is unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every achievement has a dedicated badge glyph', async () => {
    const { missingGlyphs } = await import('../../src/ui/achievementArt')
    expect(missingGlyphs()).toEqual([])
  })

  it('does not clobber existing achievements in the save', () => {
    saveProgress({ ...loadProgress(), achievements: ['boss_down'] })
    const g = new Game(miniLevel(), 1)
    const t = new AchievementTracker(g)
    evaluateAchievements(ctxFor(g, t))
    const all = loadProgress().achievements!
    expect(all).toContain('boss_down')
    expect(all).toContain('first_win')
  })
})
