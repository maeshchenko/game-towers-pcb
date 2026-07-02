import { describe, it, expect } from 'vitest'
import { Projectile } from '../../src/game/Projectile'
import { Game } from '../../src/game/Game'
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
