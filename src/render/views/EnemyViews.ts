// src/render/views/EnemyViews.ts
// One pooled view per live enemy: baked sprite + tiny HP bar redrawn only when hp changes.
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import { gsap } from 'gsap'
import type { Enemy } from '../../game/Enemy'
import type { Pt } from '../../geom/types'
import { PALETTE } from '../../style/palette'
import { bakeEnemyTexture, ENEMY_RADIUS } from './textures'
import { EASE } from '../juice/tweens'

const FLASH_DECAY_PER_SEC = 18 // 0.9 -> 0 in 50ms
const KICK_DECAY_PER_SEC = 10 // -> 0 in ~100ms
const KICK_PX = 4
const SLOW_TINT = 0x7db8ff // icy tint while slowed — the SLOW field's effect must be READABLE
const HEAL_FLASH_THROTTLE = 0.35 // enemyHealed fires every sim substep; flash at most this often

class EnemyView {
  root = new Container()
  /** Inner container for orientation/bob — root carries position+kick, body carries rotation. */
  body = new Container()
  sprite: Sprite
  flash: Sprite // additive hit flash, same baked texture, faded in/out over sprite
  hpBar = new Graphics()
  pulse = new Graphics() // healer aura ring; empty for others
  lastHp = -1
  kick = { x: 0, y: 0 } // decaying visual-only knockback offset
  bobPhase = Math.random() * Math.PI * 2 // visual-only desync so a column doesn't bob in unison
  lastHealFlash = -Infinity
  constructor(app: Application, kind: string) {
    const tex = bakeEnemyTexture(app, kind)
    this.sprite = new Sprite(tex)
    this.sprite.anchor.set(0.5)
    this.flash = new Sprite(tex)
    this.flash.anchor.set(0.5)
    this.flash.blendMode = 'add'
    this.flash.tint = 0xffffff
    this.flash.alpha = 0
    this.body.addChild(this.sprite, this.flash)
    this.root.addChild(this.pulse, this.body, this.hpBar)
  }
}

export class EnemyViews {
  private views = new Map<Enemy, EnemyView>()
  // Pooled per kind: a pooled view holds a kind-specific baked texture that is never
  // reassigned, so views must only be reused for an enemy of the same kind.
  private poolByKind = new Map<string, EnemyView[]>()
  private clock = 0
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

  /** Green heal blink — throttled, the sim emits enemyHealed every substep while healing. */
  onHealed(enemy: Enemy): void {
    const v = this.views.get(enemy)
    if (!v || this.clock - v.lastHealFlash < HEAL_FLASH_THROTTLE) return
    v.lastHealFlash = this.clock
    v.flash.tint = PALETTE.neonGreen
    v.flash.alpha = 0.55
  }

  /** Death send-off: the body pops and dissolves instead of blinking out of existence.
   * The view is detached from the pool cycle for the tween's lifetime, then destroyed —
   * pooling a mid-tween view would teleport the corpse onto a fresh spawn. */
  onDied(enemy: Enemy): void {
    const v = this.views.get(enemy)
    if (!v) return
    this.views.delete(enemy)
    v.hpBar.visible = false
    v.pulse.visible = false
    gsap.to(v.body.scale, { x: 1.45, y: 1.45, duration: 0.16, ease: EASE.ui })
    gsap.to(v.root, {
      alpha: 0, duration: 0.16, ease: EASE.ui,
      onComplete: () => { this.layer.removeChild(v.root); v.root.destroy({ children: true }) },
    })
  }

  sync(enemies: Enemy[], timeSec: number, dt: number): void {
    this.clock += dt
    const live = new Set<Enemy>()
    for (const e of enemies) {
      if (!e.alive) continue
      live.add(e)
      let v = this.views.get(e)
      if (!v) {
        v = this.poolByKind.get(e.kind)?.pop() ?? new EnemyView(this.app, e.kind)
        v.lastHp = -1
        v.flash.alpha = 0
        v.flash.tint = 0xffffff
        v.kick.x = 0; v.kick.y = 0
        v.root.visible = true
        v.root.alpha = 1
        v.hpBar.visible = true
        v.pulse.visible = true
        v.body.scale.set(1)
        this.layer.addChild(v.root)
        this.views.set(e, v)
        // spawn pop: scale-in so enemies ENTER the board instead of appearing mid-frame
        gsap.from(v.body.scale, { x: 0.2, y: 0.2, duration: 0.22, ease: EASE.pop })
      }
      v.flash.alpha = Math.max(0, v.flash.alpha - dt * FLASH_DECAY_PER_SEC)
      if (v.flash.alpha <= 0 && v.flash.tint !== 0xffffff) v.flash.tint = 0xffffff // heal blink over → back to hit-white
      const kickDecay = Math.max(0, 1 - dt * KICK_DECAY_PER_SEC)
      v.kick.x *= kickDecay; v.kick.y *= kickDecay
      // orientation + a light bob: face the walk direction, breathe a little
      if (Math.abs(e.vel.x) + Math.abs(e.vel.y) > 1) v.body.rotation = Math.atan2(e.vel.y, e.vel.x)
      const bob = Math.sin(timeSec * 7 + v.bobPhase) * 1.2
      v.root.position.set(e.pos.x + v.kick.x, e.pos.y + v.kick.y + bob)
      // slowed enemies freeze visually — icy tint is the SLOW tower's whole feedback loop
      const tint = e.isSlowed ? SLOW_TINT : 0xffffff
      if (v.sprite.tint !== tint) v.sprite.tint = tint
      if (e.hp !== v.lastHp) {
        v.lastHp = e.hp
        const r = ENEMY_RADIUS[e.kind] ?? 6
        const w = r * 2, frac = e.hp / e.maxHp
        v.hpBar.clear()
        v.hpBar.rect(-r, -r - 6, w, 2).fill({ color: 0x000000, alpha: 0.6 })
        v.hpBar.rect(-r, -r - 6, w * frac, 2).fill({ color: frac > 0.4 ? PALETTE.neonGreen : PALETTE.neonRed })
        // shield pips above the hp bar: readable "hits left to strip"
        if (e.shieldHits > 0) {
          for (let i = 0; i < e.shieldHits; i++) {
            v.hpBar.rect(-r + i * 4, -r - 10, 3, 2).fill({ color: 0x7db8ff })
          }
        }
      }
      if (e.abilities.heal) {
        const t = (timeSec / 1.5) % 1
        const rangePx = e.abilities.heal.radius * 30 // pitch-agnostic enough for the ring visual
        v.pulse.clear()
        v.pulse.circle(0, 0, rangePx * (0.3 + 0.7 * t)).stroke({ color: PALETTE.neonGreen, width: 1.5, alpha: 0.3 * (1 - t) })
      }
    }
    for (const [e, v] of this.views) {
      if (live.has(e)) continue
      // leaks / silent removals (deaths detach through onDied before reaching here)
      this.views.delete(e)
      gsap.killTweensOf(v.body.scale)
      gsap.killTweensOf(v.root)
      this.layer.removeChild(v.root)
      v.root.visible = false
      v.body.rotation = 0
      const p = this.poolByKind.get(e.kind) ?? []
      p.push(v); this.poolByKind.set(e.kind, p)
    }
  }

  destroy(): void {
    for (const v of this.views.values()) { gsap.killTweensOf(v.body.scale); gsap.killTweensOf(v.root); v.root.destroy({ children: true }) }
    for (const arr of this.poolByKind.values()) for (const v of arr) v.root.destroy({ children: true })
    this.views.clear(); this.poolByKind.clear()
  }
}
