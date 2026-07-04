// src/render/juice/TracePulse.ts
// "Live board" ambient juice (Task 10): a couple of small additive dots crawl along each trace
// polyline, like data pulses on a PCB. Purely decorative — no gameplay coupling. Lives in
// GameView (constructed from Game.paths) so it also animates during the build phase, since Game
// (and its paths) already exist whenever a level is loaded for play.
import { Application, Container, Sprite } from 'pixi.js'
import type { Pt } from '../../geom/types'
import { bakeParticleTexture } from '../views/textures'

// 6 cells/s at the standard 30px pitch. Paths are already fillet-expanded to world px, so this is
// a flat px/s speed — no pitch plumbing needed here.
const PULSE_SPEED_PX = 180
const PULSES_PER_PATH = 2
const PULSE_TINT = 0x67ffb0 // trace neon green
const PULSE_SCALE = 0.5
const PULSE_ALPHA = 0.7
const RESPAWN_DELAY_MIN = 1
const RESPAWN_DELAY_MAX = 4

interface PathData {
  points: Pt[]
  cumLen: number[] // cumulative length up to and including point i; cumLen[0] === 0
  total: number
}

interface Pulse {
  sprite: Sprite
  pathIdx: number
  distance: number // px travelled along the path, 0..total
  waiting: number  // seconds left before respawn; 0 means "active, not waiting"
}

export class TracePulse {
  private paths: PathData[] = []
  private pulses: Pulse[] = []

  constructor(app: Application, layer: Container, paths: Pt[][]) {
    const texture = bakeParticleTexture(app, 'dot')
    for (const pts of paths) {
      if (pts.length < 2) continue
      // Precompute cumulative segment lengths once — positionAt() below then does a cheap binary
      // search instead of re-walking the polyline every frame.
      const cumLen: number[] = [0]
      for (let i = 1; i < pts.length; i++) {
        cumLen.push(cumLen[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
      }
      const total = cumLen[cumLen.length - 1]
      if (total <= 0) continue
      const pathIdx = this.paths.length
      this.paths.push({ points: pts, cumLen, total })

      for (let k = 0; k < PULSES_PER_PATH; k++) {
        const sprite = new Sprite(texture)
        sprite.anchor.set(0.5)
        sprite.tint = PULSE_TINT
        sprite.alpha = PULSE_ALPHA
        sprite.scale.set(PULSE_SCALE)
        sprite.blendMode = 'add'
        layer.addChild(sprite)
        // Stagger the two pulses evenly along the path so they don't spawn stacked.
        const distance = (k / PULSES_PER_PATH) * total
        const pos = this.positionAt(pathIdx, distance)
        sprite.position.set(pos.x, pos.y)
        this.pulses.push({ sprite, pathIdx, distance, waiting: 0 })
      }
    }
  }

  private positionAt(pathIdx: number, distance: number): Pt {
    const { points, cumLen, total } = this.paths[pathIdx]
    const d = distance < 0 ? 0 : distance > total ? total : distance
    // Binary search for the segment [lo, hi] whose cumulative length spans d.
    let lo = 0, hi = cumLen.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (cumLen[mid] <= d) lo = mid; else hi = mid
    }
    const segLen = cumLen[hi] - cumLen[lo]
    const t = segLen > 0 ? (d - cumLen[lo]) / segLen : 0
    const a = points[lo], b = points[hi]
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  }

  update(dt: number): void {
    for (const pulse of this.pulses) {
      if (pulse.waiting > 0) {
        pulse.waiting -= dt
        continue // stays invisible until the respawn delay elapses
      }
      const total = this.paths[pulse.pathIdx].total
      pulse.distance += PULSE_SPEED_PX * dt
      if (pulse.distance >= total) {
        // Reached the end — hide and schedule a respawn at the start after a random delay.
        pulse.distance = 0
        pulse.waiting = RESPAWN_DELAY_MIN + Math.random() * (RESPAWN_DELAY_MAX - RESPAWN_DELAY_MIN)
        pulse.sprite.visible = false
        continue
      }
      pulse.sprite.visible = true
      const pos = this.positionAt(pulse.pathIdx, pulse.distance)
      pulse.sprite.position.set(pos.x, pos.y)
    }
  }

  destroy(): void {
    for (const pulse of this.pulses) pulse.sprite.destroy()
    this.pulses = []
    this.paths = []
  }
}
