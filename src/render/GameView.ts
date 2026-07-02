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
import { ENEMY_RADIUS } from './views/textures'
import { enemyTheme } from './theme'

export class GameView {
  private enemies: EnemyViews
  private towers: TowerViews
  private projectiles: ProjectileViews
  private beams: BeamFx
  private time = 0
  // Public so later tasks (4/6/8) can subscribe sim events to bursts through GameView.
  readonly particles: ParticleSystem
  private decals: Decals
  private unsubs: (() => void)[] = []

  constructor(app: Application, layers: Renderer['layers'], private game: Game) {
    this.enemies = new EnemyViews(app, layers.game)
    this.towers = new TowerViews(layers.game)
    this.projectiles = new ProjectileViews(app, layers.projectiles, game.pitch)
    this.beams = new BeamFx(layers.projectiles, game.events, game.pitch)
    this.particles = new ParticleSystem(app, layers.particles)
    this.decals = new Decals(layers.decals)
    this.unsubs.push(game.events.on((e) => {
      if (e.type === 'enemyDamaged') this.enemies.onDamaged(e.enemy, e.from)
      else if (e.type === 'enemyDied') this.onEnemyDied(e.kind, e.pos)
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
    this.towers.sync(this.game, selected)
    this.enemies.sync(this.game.enemies(), this.time, dtSec)
    this.projectiles.sync(this.game.projectiles)
    this.beams.update(dtSec)
    this.particles.update(dtSec)
    this.decals.update(dtSec)
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
  }
}
