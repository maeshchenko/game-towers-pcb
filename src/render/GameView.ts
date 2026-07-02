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

export class GameView {
  private enemies: EnemyViews
  private towers: TowerViews
  private projectiles: ProjectileViews
  private beams: BeamFx
  private time = 0
  // Public so later tasks (4/6/8) can subscribe sim events to bursts through GameView.
  readonly particles: ParticleSystem
  private unsubs: (() => void)[] = []

  constructor(app: Application, layers: Renderer['layers'], private game: Game) {
    this.enemies = new EnemyViews(app, layers.game)
    this.towers = new TowerViews(layers.game)
    this.projectiles = new ProjectileViews(app, layers.projectiles, game.pitch)
    this.beams = new BeamFx(layers.projectiles, game.events, game.pitch)
    this.particles = new ParticleSystem(app, layers.particles)
    this.unsubs.push(game.events.on((e) => {
      if (e.type === 'enemyDamaged') this.enemies.onDamaged(e.enemy, e.from)
    }))
  }

  update(dtSec: number, selected: Tower | null): void {
    this.time += dtSec
    this.towers.sync(this.game, selected)
    this.enemies.sync(this.game.enemies(), this.time, dtSec)
    this.projectiles.sync(this.game.projectiles)
    this.beams.update(dtSec)
    this.particles.update(dtSec)
  }

  destroy(): void {
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.enemies.destroy()
    this.towers.destroy()
    this.projectiles.destroy()
    this.beams.destroy()
    this.particles.destroy()
  }
}
