// src/render/views/TowerViews.ts
// One persistent Graphics per tower, redrawn only when its (level, special) state changes (or it's
// newly built). A shared overlayG carries slow-tower aura fills + the selected tower's range ring,
// redrawn only when `selected` or the tower set/levels change (aura radius grows on upgrade).
// Each tower's Graphics is drawn in LOCAL coordinates (centered at 0,0) and positioned via
// g.position — this lets built/upgraded/shot feedback drive g.scale as a juice tween without
// fighting the draw geometry (overlayG stays in world coordinates).
import { Container, Graphics } from 'pixi.js'
import { gsap } from 'gsap'
import type { Game } from '../../game/Game'
import type { Tower } from '../../game/Tower'
import type { EventBus } from '../../game/events'
import type { Pt } from '../../geom/types'
import { PALETTE } from '../../style/palette'
import { TOWER_THEME } from '../theme'
import { EASE, DUR } from '../juice/tweens'

// Minimum time between recoil tweens on the same tower (tesla fires ~2.6/s — throttle so rapid
// fire doesn't restart the recoil tween mid-flight and look jittery).
const RECOIL_THROTTLE = 0.1

function poly(g: Graphics, cx: number, cy: number, r: number, sides: number, rot = 0): void {
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
  }
}

// Tower = dark IC chip + gold pin rows + neon icon. Transplanted 1:1 from GameLayers.ts:23-48 —
// drawn centered at local (0,0); the Graphics is positioned at t.pos via g.position.set once,
// on creation (see sync()), so scale tweens pivot around the chip's own center.
function drawTower(g: Graphics, t: Tower, pitch: number): void {
  const x = 0, y = 0
  const th = TOWER_THEME[t.kind], c = th.color
  const s = Math.max(11, pitch * 0.55), ic = s * 0.5, pinW = Math.max(2, s * 0.18)
  g.roundRect(x - s - 3, y - s - 3, (s + 3) * 2, (s + 3) * 2, 4).fill({ color: PALETTE.substrate, alpha: 0.9 }) // small mask: hide the bracket under the chip (don't cover the path)
  g.circle(x, y, s + 5).fill({ color: c, alpha: 0.14 })                          // soft glow
  g.roundRect(x - s + 1, y - s + 2, s * 2, s * 2, 3).fill({ color: 0x000000, alpha: 0.5 }) // shadow
  g.roundRect(x - s, y - s, s * 2, s * 2, 3).fill({ color: 0x16202b })           // navy IC body
  g.roundRect(x - s, y - s, s * 2, s * 0.4, 3).fill({ color: 0xffffff, alpha: 0.06 })
  for (let i = 0; i < 4; i++) {                                                  // gold pin rows (top+bottom)
    const px = x - s + s * 0.4 + i * (s * 0.5)
    g.rect(px, y - s - pinW, pinW, pinW).fill({ color: PALETTE.padGold }); g.rect(px, y + s, pinW, pinW).fill({ color: PALETTE.padGold })
  }
  // neon function icon (sized to the chip)
  if (th.icon === 'rings') { g.circle(x, y, ic).stroke({ color: c, width: 2 }); g.circle(x, y, ic * 0.4).fill({ color: c }) }
  else if (th.icon === 'diamond') { poly(g, x, y, ic, 4, 0); g.fill({ color: c }) }
  else if (th.icon === 'targetRing') { g.circle(x, y, ic).stroke({ color: c, width: 2 }); g.moveTo(x - ic * 1.2, y).lineTo(x + ic * 1.2, y).moveTo(x, y - ic * 1.2).lineTo(x, y + ic * 1.2).stroke({ color: c, width: 1.5 }) }
  else if (th.icon === 'triangle') { poly(g, x, y, ic * 1.15, 3, -Math.PI / 2); g.fill({ color: c }) }
  else { const u = ic / 6; g.moveTo(x - 2 * u, y - 6 * u).lineTo(x + 3 * u, y - u).lineTo(x - u, y).lineTo(x + 2 * u, y + 6 * u).lineTo(x - 4 * u, y - u).lineTo(x, y).closePath().fill({ color: c }) } // bolt
  g.circle(x, y, Math.max(1.5, s * 0.13)).fill({ color: 0xffffff, alpha: 0.9 })  // hot core
  for (let i = 0; i <= t.level; i++) g.rect(x - s + 3 + i * (s * 0.35), y - s - pinW * 2.5, s * 0.22, 2).fill({ color: c }) // level pips
  if (t.special) {                                                              // special-spot boost → cyan octagon badge
    g.circle(x, y, s + 7).fill({ color: PALETTE.specialCyan, alpha: 0.1 })
    poly(g, x, y, s + 6, 8, Math.PI / 8); g.stroke({ color: PALETTE.specialCyan, width: 2, alpha: 0.9 })
  }
}

function towerKey(t: Tower): string { return `${t.level}:${t.special}` }

export class TowerViews {
  private views = new Map<Tower, Graphics>()
  private keys = new Map<Tower, string>()
  private overlayG = new Graphics()
  private lastSelected: Tower | null = null
  private lastTowersSig = ''
  // Internal clock advanced by sync()'s dt param, used only to throttle recoil tweens — avoids
  // depending on performance.now() so this stays deterministic/testable in principle.
  private clock = 0
  private lastRecoil = new WeakMap<Graphics, number>()
  private unsubs: (() => void)[] = []

  constructor(private layer: Container) { this.layer.addChild(this.overlayG) }

  // Wires build/upgrade/shot juice tweens to sim events. Call once, after construction. TowerViews
  // owns these subscriptions (unlike particles, which GameView wires separately) because they need
  // direct access to the per-tower Graphics map for pos-ref lookup.
  bind(events: EventBus): void {
    this.unsubs.push(events.on((e) => {
      if (e.type === 'towerBuilt') {
        const g = this.findGraphics(e.pos)
        if (g) gsap.fromTo(g.scale, { x: 1.3, y: 0.7 }, { x: 1, y: 1, duration: DUR.pop, ease: EASE.settle })
      } else if (e.type === 'towerUpgraded') {
        const g = this.findGraphics(e.pos)
        if (g) gsap.from(g.scale, { x: 1.25, y: 1.25, duration: 0.25, ease: EASE.pop })
      } else if (e.type === 'shotFired') {
        const g = this.findGraphics(e.from)
        if (!g) return
        const last = this.lastRecoil.get(g) ?? -Infinity
        if (this.clock - last < RECOIL_THROTTLE) return
        this.lastRecoil.set(g, this.clock)
        gsap.fromTo(g.scale, { x: 0.92, y: 1.06 }, { x: 1, y: 1, duration: 0.12, ease: EASE.ui })
      }
    }))
  }

  // Sim events carry t.pos by reference (see Game.ts emits), so a reference lookup identifies the
  // tower without needing an id on Tower itself.
  private findGraphics(pos: Pt): Graphics | undefined {
    for (const [t, g] of this.views) if (t.pos === pos) return g
    return undefined
  }

  sync(game: Game, selected: Tower | null, dt: number): void {
    this.clock += dt
    const live = new Set(game.towers)
    for (const t of game.towers) {
      let g = this.views.get(t)
      if (!g) {
        g = new Graphics()
        g.position.set(t.pos.x, t.pos.y)
        this.layer.addChild(g)
        this.views.set(t, g)
        this.keys.set(t, '')
      }
      const k = towerKey(t)
      if (this.keys.get(t) !== k) {
        this.keys.set(t, k)
        g.clear()
        drawTower(g, t, game.pitch)
      }
    }
    for (const [t, g] of this.views) {
      if (live.has(t)) continue
      this.views.delete(t)
      this.keys.delete(t)
      gsap.killTweensOf(g.scale)
      this.layer.removeChild(g)
      g.destroy()
    }

    // overlayG: slow-tower aura fills + selected tower's range ring — redraw only when the
    // selection or the tower set/levels changes (aura/range radius grows on upgrade).
    const sig = `${game.towers.length}:${game.towers.map((t) => t.level).join(',')}`
    if (selected !== this.lastSelected || sig !== this.lastTowersSig) {
      this.lastSelected = selected
      this.lastTowersSig = sig
      this.overlayG.clear()
      for (const t of game.towers) {
        if (t.stats.aura) {
          this.overlayG.circle(t.pos.x, t.pos.y, t.stats.range * game.pitch)
            .fill({ color: PALETTE.specialCyan, alpha: 0.06 })
            .stroke({ color: PALETTE.specialCyan, width: 1, alpha: 0.3 })
        }
      }
      if (selected) {
        this.overlayG.circle(selected.pos.x, selected.pos.y, selected.stats.range * game.pitch)
          .stroke({ color: PALETTE.traceCore, width: 1.5, alpha: 0.5 })
      }
    }
    // keep the overlay on top of all tower chips (selected ring must read above other towers)
    this.layer.addChild(this.overlayG)
  }

  destroy(): void {
    for (const off of this.unsubs) off()
    this.unsubs = []
    for (const g of this.views.values()) { gsap.killTweensOf(g.scale); this.layer.removeChild(g); g.destroy() }
    this.views.clear()
    this.keys.clear()
    this.layer.removeChild(this.overlayG)
    this.overlayG.destroy()
  }
}
