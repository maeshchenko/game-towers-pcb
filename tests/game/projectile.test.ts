import { describe, it, expect } from 'vitest'
import { Projectile } from '../../src/game/Projectile'
import { Game } from '../../src/game/Game'
import { Enemy } from '../../src/game/Enemy'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'
import type { Level } from '../../src/model/level'

const mkEnemy = (x: number, y: number) => ({
  pos: { x, y }, vel: { x: 0, y: 0 }, alive: true, hp: 50, maxHp: 50, kind: 'normal',
  taken: 0,
  takeDamage(n: number) { this.taken += n; this.hp = Math.max(0, this.hp - n) },
  applySlow() {},
}) as any

describe('Projectile', () => {
  it('homing pulse reaches a moving target and damages it on arrival', () => {
    const e = mkEnemy(100, 0)
    const p = new Projectile('cannon', { x: 0, y: 0 }, e, { from: { x: 0, y: 0 }, target: e, damage: 10 }, 540) // 18 кл/с * 30px
    let arrived = false
    for (let i = 0; i < 200 && !arrived; i++) {
      e.pos.x += 60 * 0.016 // цель уезжает 60px/с
      arrived = p.update(0.016)
    }
    expect(arrived).toBe(true)
    // урон применяет Game при долёте — тут проверяем только попадание в точку цели
    expect(Math.hypot(p.pos.x - e.pos.x, p.pos.y - e.pos.y)).toBeLessThan(15)
  })

  it('flies to last known position when target dies mid-flight', () => {
    const e = mkEnemy(200, 0)
    const p = new Projectile('cannon', { x: 0, y: 0 }, e, { from: { x: 0, y: 0 }, target: e, damage: 10 }, 540)
    p.update(0.016)
    e.hp = 0; e.alive = false
    let arrived = false
    for (let i = 0; i < 200 && !arrived; i++) arrived = p.update(0.016)
    expect(arrived).toBe(true)
    expect(Math.abs(p.pos.x - 200)).toBeLessThan(15)
  })

  it('mortar shell flies to the aim point without homing', () => {
    const e = mkEnemy(150, 0)
    const p = new Projectile('mortar', { x: 0, y: 0 }, null, { from: { x: 0, y: 0 }, damage: 30, splashRadius: 2.6 }, 210, { x: 150, y: 0 })
    e.pos.x = 400 // цель уехала — ракета всё равно летит в точку прицеливания
    let arrived = false
    for (let i = 0; i < 400 && !arrived; i++) arrived = p.update(0.016)
    expect(arrived).toBe(true)
    expect(Math.abs(p.pos.x - 150)).toBeLessThan(10)
  })

  it('exposes progress 0..1 by distance from start toward current aim', () => {
    const e = mkEnemy(100, 0)
    const p = new Projectile('cannon', { x: 0, y: 0 }, e, { from: { x: 0, y: 0 }, target: e, damage: 10 }, 540)
    expect(p.progress).toBeCloseTo(0, 1)
    p.update(0.016)
    expect(p.progress).toBeGreaterThan(0)
    expect(p.progress).toBeLessThanOrEqual(1)
  })
})

function miniLevel(): Level {
  // short straight path along row 5 from col 1..10 on a small board
  return {
    version: 1, board: { cols: 16, rows: 12, pitch: 24 }, seed: 1,
    trace: { waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 },
    paths: [{ waypoints: [[1, 5], [10, 5]], cornerRadius: 0.5 }],
    spots: [{ cell: [3, 4], score: 5, kind: 'build' }], specialSpots: [], decor: [],
    meta: { name: 'mini', difficulty: 0 },
  }
}

function makeTestGame(): Game {
  return new Game(miniLevel(), 1)
}

describe('Game projectile integration', () => {
  it('cannon damages over ticks with projectiles momentarily present', () => {
    const game = makeTestGame()
    game.build('cannon', 0)
    game.startWave()
    let sawProjectile = false
    let damagedTotal = 0
    game.events.on((e) => { if (e.type === 'enemyDamaged') damagedTotal += e.amount })
    let guard = 0
    while (guard++ < 625) { // ~10s of sim time at 0.016 step
      game.tick(0.016)
      if (game.projectiles.length > 0) sawProjectile = true
    }
    expect(sawProjectile).toBe(true)
    expect(damagedTotal).toBeGreaterThan(0) // projectiles landed and applied damage
  })

  it('sniper path keeps game.projectiles empty (instant weapon, no projectile)', () => {
    const game = makeTestGame()
    game.build('sniper', 0)
    game.startWave()
    let guard = 0
    while (game.state.phase === 'wave' && guard++ < 6000) {
      game.tick(0.016)
      expect(game.projectiles.length).toBe(0)
    }
  })
})

// --- binding-behavior pins: deterministic setups with injected enemies -------------------------
// Tower sits at spot [3,4] → (84, 108). pitch 24: cannon range 144px / speed 432px/s / dmg 10;
// mortar range 180px / speed 168px/s / dmg 30 / splash 62.4px; pulse retarget radius 36px.

/** Stationary enemy (speed 0) parked at (x, y). */
const still = (x: number, y: number, hpScale = 1) =>
  new Enemy(ENEMY_DEFS.normal, [{ x, y }, { x: x + 1, y }], hpScale, 0)

/** Inject a hand-built enemy set and enter wave phase (same pattern as enemy.test.ts). */
function inject(game: Game, enemies: Enemy[]): void {
  ;(game as any).wm._active = enemies
  game.state.startWave()
}

/** Zero the tower's initial cooldown so it fires on the very first tick. */
function primeCooldown(game: Game): void {
  ;(game.towers[0] as any).cooldown = 0
}

describe('Game projectile bindings', () => {
  it('mortar shell can be dodged: enemy turning off the led aim point takes no damage', () => {
    const game = makeTestGame()
    game.build('mortar', 0)
    // fast enemy runs +x (lead-aim extrapolates along +x), then turns sharply down right after
    // the shot — by shell arrival it is far outside splashRadius of the aim point
    const e = new Enemy(ENEMY_DEFS.normal, [{ x: 60, y: 132 }, { x: 90, y: 132 }, { x: 90, y: 3000 }], 1, 600)
    inject(game, [e])
    primeCooldown(game)
    let impacts = 0
    game.events.on((ev) => { if (ev.type === 'projectileImpact') impacts++ })
    let guard = 0
    while (impacts === 0 && guard++ < 100) game.tick(0.016)
    expect(impacts).toBe(1)
    expect(e.hp).toBe(e.maxHp) // dodged: zero damage
  })

  it('mortar splash damages every enemy near the impact point (bystanders included)', () => {
    const game = makeTestGame()
    game.build('mortar', 0)
    const a = still(84, 132)
    const b = still(124, 132) // 40px from a — inside the 62.4px splash around either aim point
    inject(game, [a, b])
    primeCooldown(game)
    for (let i = 0; i < 20; i++) game.tick(0.016) // one shell fired and landed; next shot ≫ 20 ticks away
    expect(a.hp).toBe(a.maxHp - 30)
    expect(b.hp).toBe(b.maxHp - 30)
  })

  it('pulse retargets the nearest live enemy within 1.5 cells when its target dies mid-flight', () => {
    const game = makeTestGame()
    game.build('cannon', 0)
    const target = still(84, 240)     // 132px from cannon — in range
    const bystander = still(114, 252) // 147px from cannon (out of range), 32px from target
    inject(game, [target, bystander])
    primeCooldown(game)
    game.tick(0.016) // fire: pulse spawned, homing on target
    expect(game.projectiles.length).toBe(1)
    target.takeDamage(9999) // dies mid-flight → bullet flies to last known position
    for (let i = 0; i < 40; i++) game.tick(0.016)
    expect(game.projectiles.length).toBe(0)
    expect(bystander.hp).toBe(bystander.maxHp - 10) // bystander absorbed the hit
  })

  it('pulse fizzles when nobody is near the impact: no damage, but projectileImpact is emitted', () => {
    const game = makeTestGame()
    game.build('cannon', 0)
    const target = still(84, 240)
    const bystander = still(150, 300) // out of cannon range AND out of the 36px retarget radius
    inject(game, [target, bystander])
    primeCooldown(game)
    game.tick(0.016) // fire
    target.takeDamage(9999)
    const types: string[] = []
    game.events.on((ev) => types.push(ev.type))
    for (let i = 0; i < 40; i++) game.tick(0.016)
    expect(types).toContain('projectileImpact')
    expect(types).not.toContain('enemyDamaged')
    expect(bystander.hp).toBe(bystander.maxHp)
  })

  it('projectile kill grants bounty and emits enemyDied in the same tick as the impact', () => {
    const game = makeTestGame()
    game.build('cannon', 0)
    const victim = new Enemy(ENEMY_DEFS.normal, [{ x: 84, y: 240 }, { x: 85, y: 240 }], 0.2, 0) // hp 9 < 10 dmg
    const keeper = still(500, 500) // far away: keeps the wave from clearing (no waveEnd gold noise)
    inject(game, [victim, keeper])
    primeCooldown(game)
    let diedOnImpactTick = false
    let goldDelta = -1
    let landed = false
    for (let i = 0; i < 60 && !landed; i++) {
      const goldBefore = game.state.gold
      const types: string[] = []
      const off = game.events.on((ev) => types.push(ev.type))
      game.tick(0.016)
      off()
      if (types.includes('projectileImpact')) {
        landed = true
        diedOnImpactTick = types.includes('enemyDied')
        goldDelta = game.state.gold - goldBefore
      }
    }
    expect(landed).toBe(true)
    expect(diedOnImpactTick).toBe(true)
    expect(goldDelta).toBe(victim.bounty)
  })

  it('projectile freezes (not dropped) when the wave ends mid-flight', () => {
    const game = makeTestGame()
    game.build('cannon', 0)
    const target = still(84, 240)
    inject(game, [target])
    primeCooldown(game)
    game.tick(0.016) // fire
    expect(game.projectiles.length).toBe(1)
    target.takeDamage(9999)
    game.tick(0.016) // last enemy removed → wave clears this tick
    expect(game.state.phase).toBe('build')
    expect(game.projectiles.length).toBe(1) // bullet still in flight, not dropped
    const p = game.projectiles[0]
    const frozen = { x: p.pos.x, y: p.pos.y }
    for (let i = 0; i < 10; i++) game.tick(0.016)
    expect(game.projectiles.length).toBe(1)
    expect(p.pos.x).toBe(frozen.x) // frozen between waves — thaws next wave
    expect(p.pos.y).toBe(frozen.y)
  })

  it('projectile advances proportionally to game.speed within a single tick', () => {
    // baseline: one step at speed 1, from an identical post-fire position
    const g1 = makeTestGame()
    g1.build('cannon', 0)
    const t1 = still(84, 240) // 132px from the tower — in cannon range, stays put
    inject(g1, [t1])
    primeCooldown(g1)
    g1.tick(0.016) // fires the pulse; it also takes its first step this same tick
    expect(g1.projectiles.length).toBe(1)
    const before1 = { ...g1.projectiles[0].pos }
    g1.tick(0.016) // one more step at speed 1
    const dist1 = Math.hypot(g1.projectiles[0].pos.x - before1.x, g1.projectiles[0].pos.y - before1.y)

    // speed 4: identical fresh setup, fire at the default speed 1, then switch to speed 4 for the measured tick
    const g4 = makeTestGame()
    g4.build('cannon', 0)
    const t4 = still(84, 240)
    inject(g4, [t4])
    primeCooldown(g4)
    g4.tick(0.016) // fires at default speed 1 — position matches g1's before1 by construction
    expect(g4.projectiles.length).toBe(1)
    const before4 = { ...g4.projectiles[0].pos }
    expect(before4).toEqual(before1)
    g4.speed = 4
    g4.tick(0.016) // one tick at 4x game speed
    const dist4 = Math.hypot(g4.projectiles[0].pos.x - before4.x, g4.projectiles[0].pos.y - before4.y)

    expect(dist4 / dist1).toBeCloseTo(4, 1) // ~4x displacement per tick vs speed 1

    // impact still lands and damages the target when flown out at 4x speed
    let guard = 0
    while (g4.projectiles.length > 0 && guard++ < 20) g4.tick(0.016)
    expect(g4.projectiles.length).toBe(0)
    expect(t4.hp).toBe(t4.maxHp - 10)
  })
  // Removed: 'cannon fire pushes no Fx beam while its projectile flies' pinned Fx-list exclusivity.
  // The Fx system (Game._fx/get fx) was deleted in Task 10 — instant weapons now emit `shotFired`
  // events consumed by BeamFx (render layer), and there is no fx list left to assert against.
})
