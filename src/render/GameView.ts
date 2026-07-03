// src/render/GameView.ts
// Facade that owns and drives the per-frame view classes (Task 7-9): towers, enemies,
// projectiles, and instant-weapon beam fx. Replaces the old GameLayers full-redraw approach.
import type { Application } from 'pixi.js'
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import type { Renderer } from './Renderer'
import { EnemyViews } from './views/EnemyViews'
import { TowerViews } from './views/TowerViews'
import { ProjectileViews } from './views/ProjectileViews'
import { BeamFx } from './views/BeamFx'
import { ParticleSystem } from './juice/Particles'
import { Decals } from './juice/Decals'
import { FloatingText } from './juice/FloatingText'
import { Vfx } from './juice/Vfx'
import { TracePulse } from './juice/TracePulse'
import { DamageAggregator } from './juice/floatingLogic'
import { ENEMY_RADIUS } from './views/textures'
import { enemyTheme } from './theme'
import { PALETTE } from '../style/palette'

// Damage numbers below this many px above the enemy read cleanly without overlapping the sprite.
const FLOAT_TEXT_OFFSET_Y = 12
// Batched damage totals at/above this amount render slightly larger to read as a "big hit".
const BIG_HIT_AMOUNT = 100

export class GameView {
  private enemies: EnemyViews
  private towers: TowerViews
  private projectiles: ProjectileViews
  private beams: BeamFx
  private time = 0
  // Public so later tasks (4/6/8) can subscribe sim events to bursts through GameView.
  readonly particles: ParticleSystem
  private decals: Decals
  private floating: FloatingText
  private vfx: Vfx
  private tracePulse: TracePulse
  private damageAgg = new DamageAggregator()
  private unsubs: (() => void)[] = []

  constructor(app: Application, renderer: Renderer, private game: Game) {
    const layers = renderer.layers
    this.enemies = new EnemyViews(app, layers.game)
    this.towers = new TowerViews(layers.game)
    this.particles = new ParticleSystem(app, layers.particles)
    this.projectiles = new ProjectileViews(app, layers.projectiles, game.pitch, this.particles)
    this.beams = new BeamFx(layers.projectiles, game.events, game.pitch, this.particles)
    this.decals = new Decals(layers.decals)
    this.floating = new FloatingText(layers.floatingText)
    this.vfx = new Vfx(app, renderer.world, renderer.vfxOverlay, [layers.projectiles, layers.particles])
    // Dedicated persistent layer: `trace` is cleared+destroyed on every Renderer.render(),
    // which would leave TracePulse updating destroyed sprites (crash in the ticker).
    this.tracePulse = new TracePulse(app, layers.tracePulse, game.paths)
    this.towers.bind(game.events) // build/upgrade/recoil scale tweens — owned by TowerViews itself
    this.unsubs.push(game.events.on((e) => {
      if (e.type === 'enemyDamaged') {
        this.enemies.onDamaged(e.enemy, e.from)
        this.damageAgg.add(e.enemy, e.amount, e.pos.x, e.pos.y, this.time)
      } else if (e.type === 'enemyDied') {
        this.onEnemyDied(e.kind, e.pos)
        this.floating.spawn('+' + e.bounty, e.pos.x, e.pos.y - FLOAT_TEXT_OFFSET_Y, PALETTE.padGold)
        if (e.kind === 'boss') this.vfx.rgbSplitPulse()
      } else if (e.type === 'baseHit') {
        this.vfx.flashVignette()
        this.vfx.rgbSplitPulse()
      } else if (e.type === 'towerBuilt') {
        this.particles.burst({
          x: e.pos.x, y: e.pos.y, count: 10,
          speed: [40, 90], life: [0.25, 0.5], color: PALETTE.padGold, size: [1.5, 3], shape: 'dot',
        })
      } else if (e.type === 'towerUpgraded') {
        this.particles.burst({ // transient white flash — simpler than a bespoke Graphics overlay
          x: e.pos.x, y: e.pos.y, count: 8,
          speed: [30, 60], life: [0.15, 0.3], color: 0xffffff, size: [2, 3], shape: 'dot',
        })
      } else if (e.type === 'towerSold') {
        this.particles.burst({
          x: e.pos.x, y: e.pos.y, count: 6,
          speed: [80, 160], life: [0.2, 0.4], color: PALETTE.padGold, size: [1, 2], shape: 'spark',
        })
      }
    }))
  }

  private onEnemyDied(kind: string, pos: { x: number; y: number }): void {
    const isBoss = kind === 'boss'
    const color = enemyTheme(kind).color
    this.particles.burst({
      x: pos.x, y: pos.y, count: isBoss ? 15 : 5,
      speed: [60, 180], life: [0.3, 0.7], color, size: [2, 4],
      gravity: 300, drag: 0.6, shape: 'shard',
    })
    this.particles.burst({
      x: pos.x, y: pos.y, count: isBoss ? 20 : 6,
      speed: [120, 300], life: [0.15, 0.35], color: 0xffffff, size: [1, 2],
      shape: 'spark',
    })
    const radius = (ENEMY_RADIUS[kind] ?? 6) * (isBoss ? 2 : 1) * 1.2
    this.decals.addScorch(pos.x, pos.y, radius)
  }

  update(dtSec: number, selected: Tower | null): void {
    this.time += dtSec
    this.towers.sync(this.game, selected, dtSec)
    this.enemies.sync(this.game.enemies(), this.time, dtSec)
    this.projectiles.sync(this.game.projectiles, dtSec)
    this.beams.update(dtSec)
    this.particles.update(dtSec)
    this.decals.update(dtSec)
    for (const b of this.damageAgg.flush(this.time)) {
      const scale = b.amount >= BIG_HIT_AMOUNT ? 1.3 : 1
      this.floating.spawn(String(Math.round(b.amount)), b.x, b.y - FLOAT_TEXT_OFFSET_Y, 0xffffff, scale)
    }
    this.floating.update(dtSec)
    this.vfx.update(dtSec)
    this.tracePulse.update(dtSec)
  }

  destroy(): void {
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.enemies.destroy()
    this.towers.destroy()
    this.projectiles.destroy()
    this.beams.destroy()
    this.particles.destroy()
    this.decals.destroy()
    this.vfx.destroy()
    this.floating.destroy()
    this.tracePulse.destroy()
  }
}
