// src/render/views/EnemyViews.ts
// One pooled view per live enemy: baked sprite + tiny HP bar redrawn only when hp changes.
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import type { Enemy } from '../../game/Enemy'
import type { Pt } from '../../geom/types'
import { PALETTE } from '../../style/palette'
import { bakeEnemyTexture, ENEMY_RADIUS } from './textures'

const FLASH_DECAY_PER_SEC = 18 // 0.9 -> 0 in 50ms
const KICK_DECAY_PER_SEC = 10 // -> 0 in ~100ms
const KICK_PX = 4

class EnemyView {
  root = new Container()
  sprite: Sprite
  flash: Sprite // additive hit flash, same baked texture, faded in/out over sprite
  hpBar = new Graphics()
  pulse = new Graphics() // healer aura ring; empty for others
  lastHp = -1
  kick = { x: 0, y: 0 } // decaying visual-only knockback offset
  constructor(app: Application, kind: string) {
    const tex = bakeEnemyTexture(app, kind)
    this.sprite = new Sprite(tex)
    this.sprite.anchor.set(0.5)
    this.flash = new Sprite(tex)
    this.flash.anchor.set(0.5)
    this.flash.blendMode = 'add'
    this.flash.tint = 0xffffff
    this.flash.alpha = 0
    this.root.addChild(this.pulse, this.sprite, this.flash, this.hpBar)
  }
}

export class EnemyViews {
  private views = new Map<Enemy, EnemyView>()
  // Pooled per kind: a pooled view holds a kind-specific baked texture that is never
  // reassigned, so views must only be reused for an enemy of the same kind.
  private poolByKind = new Map<string, EnemyView[]>()
  constructor(private app: Application, private layer: Container) {}

  /** Hit feedback: additive flash + a small knockback kick away from the damage source. Called
   * from the enemyDamaged event subscription (GameView), not from sync — sync only decays. */
  onDamaged(enemy: Enemy, from?: Pt): void {
    const v = this.views.get(enemy)
    if (!v) return
    v.flash.alpha = 0.9
    if (from) {
      const dx = enemy.pos.x - from.x, dy = enemy.pos.y - from.y
      const d = Math.hypot(dx, dy)
      if (d > 0) { v.kick.x = (dx / d) * KICK_PX; v.kick.y = (dy / d) * KICK_PX }
    } else {
      v.kick.x = 0; v.kick.y = 0
    }
  }

  sync(enemies: Enemy[], timeSec: number, dt: number): void {
    const live = new Set<Enemy>()
    for (const e of enemies) {
      if (!e.alive) continue
      live.add(e)
      let v = this.views.get(e)
      if (!v) {
        v = this.poolByKind.get(e.kind)?.pop() ?? new EnemyView(this.app, e.kind)
        v.lastHp = -1
        v.flash.alpha = 0
        v.kick.x = 0; v.kick.y = 0
        v.root.visible = true
        this.layer.addChild(v.root)
        this.views.set(e, v)
      }
      v.flash.alpha = Math.max(0, v.flash.alpha - dt * FLASH_DECAY_PER_SEC)
      const kickDecay = Math.max(0, 1 - dt * KICK_DECAY_PER_SEC)
      v.kick.x *= kickDecay; v.kick.y *= kickDecay
      v.root.position.set(e.pos.x + v.kick.x, e.pos.y + v.kick.y)
      if (e.hp !== v.lastHp) {
        v.lastHp = e.hp
        const r = ENEMY_RADIUS[e.kind] ?? 6
        const w = r * 2, frac = e.hp / e.maxHp
        v.hpBar.clear()
        v.hpBar.rect(-r, -r - 6, w, 2).fill({ color: 0x000000, alpha: 0.6 })
        v.hpBar.rect(-r, -r - 6, w * frac, 2).fill({ color: frac > 0.4 ? PALETTE.neonGreen : PALETTE.neonRed })
      }
      if (e.kind === 'healer') {
        const t = (timeSec / 1.5) % 1
        const rangePx = 75 // 2.5 * 30 pitch
        v.pulse.clear()
        v.pulse.circle(0, 0, rangePx * (0.3 + 0.7 * t)).stroke({ color: PALETTE.neonGreen, width: 1.5, alpha: 0.3 * (1 - t) })
      }
    }
    for (const [e, v] of this.views) {
      if (live.has(e)) continue
      this.views.delete(e)
      this.layer.removeChild(v.root)
      v.root.visible = false
      const p = this.poolByKind.get(e.kind) ?? []
      p.push(v); this.poolByKind.set(e.kind, p)
    }
  }

  destroy(): void {
    for (const v of this.views.values()) v.root.destroy({ children: true })
    for (const arr of this.poolByKind.values()) for (const v of arr) v.root.destroy({ children: true })
    this.views.clear(); this.poolByKind.clear()
  }
}
