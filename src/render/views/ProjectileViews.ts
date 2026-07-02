// src/render/views/ProjectileViews.ts
// One pooled sprite per in-flight projectile: baked texture per kind, repositioned each frame.
// Mortar shells get a visual ballistic arc (position only — sim collision stays flat/2D).
import { Application, Container, Sprite } from 'pixi.js'
import type { Pt } from '../../geom/types'
import type { Projectile } from '../../game/Projectile'
import { bakeProjectileTexture, type ProjectileTexKind } from './textures'

function texKind(kind: string): ProjectileTexKind { return kind === 'mortar' ? 'mortar' : 'cannon' }

class ProjectileView {
  sprite: Sprite
  lastPos: Pt
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
  constructor(private app: Application, private layer: Container, private pitch: number) {}

  sync(projectiles: Projectile[]): void {
    const live = new Set<Projectile>()
    for (const p of projectiles) {
      live.add(p)
      let v = this.views.get(p)
      if (!v) {
        v = this.poolByKind.get(p.kind)?.pop() ?? new ProjectileView(this.app, p.kind)
        v.lastPos.x = p.pos.x; v.lastPos.y = p.pos.y
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
        v.sprite.position.set(p.pos.x, p.pos.y - arcH)
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
