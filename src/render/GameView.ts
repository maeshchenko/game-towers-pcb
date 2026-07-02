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

export class GameView {
  private enemies: EnemyViews
  private towers: TowerViews
  private projectiles: ProjectileViews
  private beams: BeamFx
  private time = 0

  constructor(app: Application, layers: Renderer['layers'], private game: Game) {
    this.enemies = new EnemyViews(app, layers.game)
    this.towers = new TowerViews(layers.game)
    this.projectiles = new ProjectileViews(app, layers.projectiles)
    this.beams = new BeamFx(layers.projectiles, game.events)
  }

  update(dtSec: number, selected: Tower | null): void {
    this.time += dtSec
    this.towers.sync(this.game, selected)
    this.enemies.sync(this.game.enemies(), this.time)
    this.projectiles.sync(this.game.projectiles)
    this.beams.update(dtSec)
  }

  destroy(): void {
    this.enemies.destroy()
    this.towers.destroy()
    this.projectiles.destroy()
    this.beams.destroy()
  }
}
