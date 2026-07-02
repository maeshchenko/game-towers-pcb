// src/render/views/BeamFx.ts
// Transient beam/impact FX driven by sim events, not sim state — sniper/tesla shots resolve
// instantly (no Projectile), so their whole visual lifetime is this fade. Mortar splash rings
// come from projectileImpact once the ballistic shell actually lands. Redrawn into one shared
// Graphics per frame (beam count is small, no need to pool).
import { Container, Graphics } from 'pixi.js'
import type { Pt } from '../../geom/types'
import type { EventBus, GameEvent } from '../../game/events'
import type { TowerKind } from '../../game/towerTypes'
import { TOWER_THEME } from '../theme'

const FX_TTL = 0.14 // seconds; matches Game.ts FX_TTL

interface BeamRecord { from: Pt; to: Pt; kind: TowerKind; ttl: number }
interface ImpactRecord { pos: Pt; kind: TowerKind; splashRadius?: number; ttl: number }

export class BeamFx {
  private beams: BeamRecord[] = []
  private impacts: ImpactRecord[] = []
  private g = new Graphics()
  private unsub: () => void

  constructor(layer: Container, events: EventBus) {
    layer.addChild(this.g)
    this.unsub = events.on((e) => this.onEvent(e))
  }

  private onEvent(e: GameEvent): void {
    if (e.type === 'shotFired') {
      if (e.kind !== 'sniper' && e.kind !== 'tesla') return // cannon/mortar are Projectiles, not beams
      this.beams.push({ from: e.from, to: e.to, kind: e.kind, ttl: FX_TTL })
    } else if (e.type === 'projectileImpact') {
      if (e.kind !== 'mortar' || !e.splashRadius) return // only mortar splash needs a visual here
      this.impacts.push({ pos: e.pos, kind: e.kind, splashRadius: e.splashRadius, ttl: FX_TTL })
    }
  }

  update(dt: number): void {
    this.beams = this.beams.filter((b) => (b.ttl -= dt) > 0)
    this.impacts = this.impacts.filter((i) => (i.ttl -= dt) > 0)
    const g = this.g
    g.clear()
    for (const b of this.beams) this.drawBeam(g, b)
    for (const i of this.impacts) this.drawImpact(g, i)
  }

  // Transplanted from GameLayers.ts drawFx (tesla jagged lightning / sniper thin beam / muzzle
  // flash / impact dot), minus the mortar splash-ring branch (moved to drawImpact below, driven
  // by projectileImpact instead of the fade-only Fx list).
  private drawBeam(g: Graphics, f: BeamRecord): void {
    const a = Math.min(1, f.ttl / FX_TTL)
    const col = TOWER_THEME[f.kind].color
    const { from, to } = f
    if (f.kind === 'tesla') {
      // jagged lightning between from and to
      const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1
      const px = -dy / len, py = dx / len, segs = 5
      g.moveTo(from.x, from.y)
      for (let i = 1; i < segs; i++) {
        const t = i / segs, off = (i % 2 ? 1 : -1) * 4
        g.lineTo(from.x + dx * t + px * off, from.y + dy * t + py * off)
      }
      g.lineTo(to.x, to.y).stroke({ color: col, width: 1.5, alpha: a })
    } else {
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color: col, width: 1.5, alpha: a })
    }
    g.circle(from.x, from.y, 3).fill({ color: 0xffffff, alpha: a * 0.8 }) // muzzle flash
    g.circle(to.x, to.y, 2.5).fill({ color: col, alpha: a })              // impact
  }

  private drawImpact(g: Graphics, f: ImpactRecord): void {
    const a = Math.min(1, f.ttl / FX_TTL)
    const col = TOWER_THEME[f.kind].color
    const pitch = 30 // world pitch px (see healer rangePx comment convention)
    const r = (f.splashRadius ?? 0) * pitch * (1 - a) // ring grows outward as the FX fades
    g.circle(f.pos.x, f.pos.y, r).stroke({ color: col, width: 2, alpha: a })
  }

  destroy(): void {
    this.unsub()
    this.g.destroy()
  }
}
