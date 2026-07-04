// src/render/views/BeamFx.ts
// Transient beam/impact FX driven by sim events, not sim state — sniper/tesla shots resolve
// instantly (no Projectile), so their whole visual lifetime is this fade. Mortar splash rings
// come from projectileImpact once the ballistic shell actually lands. Redrawn into one shared
// Graphics per frame (beam count is small, no need to pool).
import { Container, Graphics } from 'pixi.js'
import type { Pt } from '../../geom/types'
import type { EventBus, GameEvent } from '../../game/events'
import type { TowerKind } from '../../game/towerTypes'
import type { ParticleSystem } from '../juice/Particles'
import { TOWER_THEME } from '../theme'

const FX_TTL = 0.14 // seconds; matches Game.ts FX_TTL

// Tesla arc shape (midpoint-displacement lightning): segment/branch counts and wobble amounts.
const TESLA_SEGS = 8          // main line segments (9 points incl. endpoints)
const TESLA_WOBBLE = 6        // px, max perpendicular offset for any wobbled point
const TESLA_REFRESH = 0.05    // seconds between offset re-rolls (flicker)
const TESLA_BRANCH_ANGLE = 0.52 // radians (~30deg), max branch angle off the main direction
const TESLA_WIDE_WIDTH = 4
const TESLA_WIDE_ALPHA = 0.25
const TESLA_NARROW_WIDTH = 1.5

// A branch fork off the main tesla line: fixed geometry (t/angle/length) seeded once at record
// creation, only `offset` re-rolls on TESLA_REFRESH for the flicker.
interface TeslaBranch { t: number; angle: number; length: number; offset: number }

interface BeamRecord {
  from: Pt; to: Pt; kind: TowerKind; ttl: number
  // Tesla-only fields (midpoint-displacement lightning); undefined for sniper beams.
  offsets?: number[]
  branches?: TeslaBranch[]
  sinceRefresh?: number
}
interface ImpactRecord { pos: Pt; kind: TowerKind; splashRadius?: number; ttl: number }

export class BeamFx {
  private beams: BeamRecord[] = []
  private impacts: ImpactRecord[] = []
  private g = new Graphics()
  private unsub: () => void

  constructor(layer: Container, events: EventBus, private pitch: number, private particles?: ParticleSystem) {
    layer.addChild(this.g)
    this.unsub = events.on((e) => this.onEvent(e))
  }

  private onEvent(e: GameEvent): void {
    if (e.type === 'shotFired') {
      if (e.kind !== 'sniper' && e.kind !== 'tesla') return // cannon/mortar are Projectiles, not beams
      const rec: BeamRecord = { from: e.from, to: e.to, kind: e.kind, ttl: FX_TTL }
      if (e.kind === 'tesla') {
        rec.offsets = randomOffsets()
        rec.branches = randomBranches(e.from, e.to)
        rec.sinceRefresh = 0
      }
      this.beams.push(rec)
    } else if (e.type === 'projectileImpact') {
      // NOTE: for mortar, shotFired.to is the live target position at fire time (not the led
      // aim point) — never use it for visuals. projectileImpact.pos is the true landing spot,
      // which is why both the mortar splash ring and the cannon impact flash key off it here.
      if (e.kind === 'mortar' && e.splashRadius) {
        this.impacts.push({ pos: e.pos, kind: e.kind, splashRadius: e.splashRadius, ttl: FX_TTL })
      } else if (e.kind === 'cannon') {
        this.impacts.push({ pos: e.pos, kind: e.kind, ttl: FX_TTL })
        this.particles?.burst({
          x: e.pos.x, y: e.pos.y, count: 3,
          speed: [50, 120], life: [0.1, 0.25], color: TOWER_THEME.cannon.color, size: [1, 2], shape: 'spark',
        })
      }
    }
  }

  update(dt: number): void {
    // In-place swap-remove instead of .filter — no new arrays every frame.
    for (let k = this.beams.length - 1; k >= 0; k--) {
      if ((this.beams[k].ttl -= dt) <= 0) { this.beams[k] = this.beams[this.beams.length - 1]; this.beams.pop() }
    }
    for (let k = this.impacts.length - 1; k >= 0; k--) {
      if ((this.impacts[k].ttl -= dt) <= 0) { this.impacts[k] = this.impacts[this.impacts.length - 1]; this.impacts.pop() }
    }
    for (const b of this.beams) {
      if (b.kind !== 'tesla' || b.sinceRefresh === undefined) continue
      b.sinceRefresh += dt
      if (b.sinceRefresh >= TESLA_REFRESH) {
        b.sinceRefresh -= TESLA_REFRESH
        b.offsets = randomOffsets()
        for (const branch of b.branches ?? []) branch.offset = randomOffset()
      }
    }
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
      // Two-pass draw: wide soft glow underneath, narrow bright core on top.
      this.strokeTesla(g, f, col, TESLA_WIDE_WIDTH, TESLA_WIDE_ALPHA * a)
      this.strokeTesla(g, f, col, TESLA_NARROW_WIDTH, a)
    } else {
      g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color: col, width: 1.5, alpha: a })
    }
    g.circle(from.x, from.y, 3).fill({ color: 0xffffff, alpha: a * 0.8 }) // muzzle flash
    g.circle(to.x, to.y, 2.5).fill({ color: col, alpha: a })              // impact
  }

  // Builds the main jagged line plus any branch forks, then strokes them as one pass. Called
  // twice per frame (wide glow + narrow core) since Graphics.stroke() consumes the active path.
  private strokeTesla(g: Graphics, f: BeamRecord, col: number, width: number, alpha: number): void {
    const { from, to } = f
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1
    const px = -dy / len, py = dx / len
    const offsets = f.offsets ?? []
    g.moveTo(from.x, from.y)
    for (let i = 1; i < TESLA_SEGS; i++) {
      const t = i / TESLA_SEGS
      const off = offsets[i - 1] ?? 0
      g.lineTo(from.x + dx * t + px * off, from.y + dy * t + py * off)
    }
    g.lineTo(to.x, to.y)
    const mainAngle = Math.atan2(dy, dx)
    for (const branch of f.branches ?? []) {
      const p0 = { x: from.x + dx * branch.t, y: from.y + dy * branch.t }
      const dirAngle = mainAngle + branch.angle
      const bux = Math.cos(dirAngle), buy = Math.sin(dirAngle)
      const bpx = -buy, bpy = bux
      const p2 = { x: p0.x + bux * branch.length, y: p0.y + buy * branch.length }
      const p1 = { x: (p0.x + p2.x) / 2 + bpx * branch.offset, y: (p0.y + p2.y) / 2 + bpy * branch.offset }
      g.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y)
    }
    g.stroke({ color: col, width, alpha })
  }

  private drawImpact(g: Graphics, f: ImpactRecord): void {
    const a = Math.min(1, f.ttl / FX_TTL)
    const col = TOWER_THEME[f.kind].color
    if (f.splashRadius !== undefined) {
      const r = f.splashRadius * this.pitch * (1 - a) // ring grows outward as the FX fades
      g.circle(f.pos.x, f.pos.y, r).stroke({ color: col, width: 2, alpha: a })
    } else {
      g.circle(f.pos.x, f.pos.y, 3).fill({ color: col, alpha: a }) // pulse (cannon) impact flash
    }
  }

  destroy(): void {
    this.unsub()
    this.g.destroy()
  }
}

// Pure visual randomness (Math.random is fine here — never used in sim logic).
function randomOffset(): number { return (Math.random() * 2 - 1) * TESLA_WOBBLE }
function randomOffsets(): number[] { return Array.from({ length: TESLA_SEGS - 1 }, randomOffset) }

function randomBranches(from: Pt, to: Pt): TeslaBranch[] {
  const len = Math.hypot(to.x - from.x, to.y - from.y)
  const count = Math.random() < 0.5 ? 1 : 2
  const positions = count === 2 ? [0.4, 0.7] : [Math.random() < 0.5 ? 0.4 : 0.7]
  return positions.map((t) => ({
    t,
    angle: (Math.random() * 2 - 1) * TESLA_BRANCH_ANGLE,
    length: (1 - t) * len * 0.3,
    offset: randomOffset(),
  }))
}
