// src/render/juice/ScreenShake.ts
// Trauma-based camera shake ("Math for Game Programmers: Juicing Your Cameras" pattern):
// events add trauma (clamped [0,1]), trauma decays linearly over time, and the actual shake
// magnitude is trauma^2 so small kicks stay subtle while trauma near 1 slams the camera.
// Offset comes from a fixed sum-of-sines noise (irrational-ish frequencies), never Math.random,
// so repeated frames at the same trauma/time are reproducible and never strobe.
// Framework-free: applyTo() only requires a structural {position:{x,y}, rotation} shape, so this
// is unit-testable without pixi and happens to match pixi's Container shape directly.
import { juice } from './motion'

const MAX_OFFSET = 10 // px, at trauma = 1
const MAX_ANGLE = 0.02 // rad, at trauma = 1 (Container.rotation is radians, unlike .angle)

export interface ShakeOffset {
  x: number
  y: number
  angle: number
}

export interface ShakeTarget {
  position: { x: number; y: number }
  rotation: number
}

export class ScreenShake {
  private trauma = 0
  private t = 0

  /** Adds trauma from an impactful event; clamped to [0,1]. No-op when reducedFx is set. */
  add(amount: number): void {
    if (juice.reducedFx) return
    this.trauma = Math.max(0, Math.min(1, this.trauma + amount))
  }

  /** Drops all pending trauma (e.g. on level reset) so shake never bleeds into the next run. */
  reset(): void {
    this.trauma = 0
  }

  /** Advances the shake clock and decays trauma linearly toward 0. Call once per frame. */
  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt)
    this.t += dt
  }

  get offset(): ShakeOffset {
    if (this.trauma === 0) return { x: 0, y: 0, angle: 0 } // avoid -0 noise from 0 * negative sine
    const shake = this.trauma * this.trauma
    const x = MAX_OFFSET * shake * (Math.sin(this.t * 13.7) + 0.5 * Math.sin(this.t * 27.1)) / 1.5
    const y = MAX_OFFSET * shake * (Math.sin(this.t * 11.3 + 4.7) + 0.5 * Math.sin(this.t * 23.9 + 2.1)) / 1.5
    const angle = MAX_ANGLE * shake * Math.sin(this.t * 17.9 + 1.3)
    return { x, y, angle }
  }

  /**
   * Adds the current offset on top of an already-set transform (e.g. after Camera.apply).
   * Rotation happens around `pivot` (the screen center in main.ts), not the target's local
   * origin — otherwise on large boards the far corner would swing several times past the
   * intended MAX_OFFSET envelope, worst exactly on the big boss-kill/base-hit shakes.
   */
  applyTo(target: ShakeTarget, pivot: { x: number; y: number }): void {
    const { x: ox, y: oy, angle } = this.offset
    target.rotation += angle
    const dx = target.position.x - pivot.x
    const dy = target.position.y - pivot.y
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    target.position.x = pivot.x + dx * cos - dy * sin + ox
    target.position.y = pivot.y + dx * sin + dy * cos + oy
  }
}
