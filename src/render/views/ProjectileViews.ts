// src/render/views/ProjectileViews.ts
// One pooled sprite per in-flight projectile: baked texture per kind, repositioned each frame.
// Mortar shells get a visual ballistic arc (position only — sim collision stays flat/2D).
import { Application, Container, Sprite } from 'pixi.js'
import type { Pt } from '../../geom/types'
import type { Projectile } from '../../game/Projectile'
import type { ParticleSystem } from '../juice/Particles'
import { bakeProjectileTexture, type ProjectileTexKind } from './textures'

function texKind(kind: string): ProjectileTexKind { return kind === 'mortar' ? 'mortar' : 'cannon' }

const MORTAR_SMOKE_INTERVAL = 0.04 // seconds between smoke puffs along a missile's flight

class ProjectileView {
  sprite: Sprite
  lastPos: Pt
  sinceSmoke = 0 // mortar-only trail accumulator
  constructor(app: Application, kind: string) {
    this.sprite = new Sprite(bakeProjectileTexture(app, texKind(kind)))
    this.sprite.anchor.set(0.5)
    this.lastPos = { x: 0, y: 0 }
  }
}

export class ProjectileViews {
  private views = new Map<Projectile, ProjectileView>()
  // Pooled per kind: a pooled view holds a kind-specific baked texture that is never
  // reassigned, so views must only be reused for a projectile of the same kind.
  private poolByKind = new Map<string, ProjectileView[]>()
  constructor(private app: Application, private layer: Container, private pitch: number, private particles?: ParticleSystem) {}

  sync(projectiles: Projectile[], dt: number): void {
    const live = new Set<Projectile>()
    for (const p of projectiles) {
      live.add(p)
      let v = this.views.get(p)
      if (!v) {
        v = this.poolByKind.get(p.kind)?.pop() ?? new ProjectileView(this.app, p.kind)
        v.lastPos.x = p.pos.x; v.lastPos.y = p.pos.y
        v.sinceSmoke = 0
        v.sprite.visible = true
        this.layer.addChild(v.sprite)
        this.views.set(p, v)
      }
      const dx = p.pos.x - v.lastPos.x, dy = p.pos.y - v.lastPos.y
      if (dx !== 0 || dy !== 0) v.sprite.rotation = Math.atan2(dy, dx) // point along flight path
      v.lastPos.x = p.pos.x; v.lastPos.y = p.pos.y
      if (p.kind === 'mortar') {
        const t = p.progress
        const arcH = 0.35 * this.pitch * 4 * t * (1 - t) // arc visual only, sim stays flat/2D
        const vx = p.pos.x, vy = p.pos.y - arcH
        v.sprite.position.set(vx, vy)
        v.sinceSmoke += dt
        if (v.sinceSmoke >= MORTAR_SMOKE_INTERVAL) {
          v.sinceSmoke -= MORTAR_SMOKE_INTERVAL
          this.particles?.burst({
            x: vx, y: vy, count: 1,
            speed: [5, 20], life: [0.4, 0.8], color: 0x9aa0a6, size: [1.5, 2.5], shape: 'dot',
          })
        }
      } else {
        v.sprite.position.set(p.pos.x, p.pos.y)
      }
    }
    for (const [p, v] of this.views) {
      if (live.has(p)) continue
      this.views.delete(p)
      this.layer.removeChild(v.sprite)
      v.sprite.visible = false
      const arr = this.poolByKind.get(p.kind) ?? []
      arr.push(v); this.poolByKind.set(p.kind, arr)
    }
  }

  destroy(): void {
    for (const v of this.views.values()) v.sprite.destroy()
    for (const arr of this.poolByKind.values()) for (const v of arr) v.sprite.destroy()
    this.views.clear(); this.poolByKind.clear()
  }
}
