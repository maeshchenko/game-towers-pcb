// src/render/juice/Decals.ts
// Pixi wrapper around decalLogic's pure pool/fade math: pooled Graphics scorch marks left behind
// by dying enemies, persisted in the world-space decals layer (under the trace, above the board).
import { Container, Graphics } from 'pixi.js'
import { DecalPool } from './decalLogic'

const CAP = 40
const SCORCH_FILL = 0x080c0a
const SCORCH_STROKE = 0x1a1008

export class Decals {
  private pool = new DecalPool(CAP)
  // Pooled Graphics, index-aligned with pool slots — created lazily on first use of a slot and
  // reused (redrawn) thereafter, never destroyed until Decals.destroy().
  private graphics: Graphics[] = []
  private time = 0

  constructor(private layer: Container) {}

  /** Draws (or redraws, if reusing a pooled slot) a scorch mark centered at (x, y). */
  addScorch(x: number, y: number, radius: number): void {
    const slot = this.pool.acquire(this.time)
    let g = this.graphics[slot]
    if (!g) {
      g = new Graphics()
      this.graphics[slot] = g
      this.layer.addChild(g)
    }
    g.clear()
    const rx = radius, ry = radius * 0.6
    g.ellipse(0, 0, rx, ry).fill({ color: SCORCH_FILL, alpha: 1 })
    g.ellipse(0, 0, rx, ry).stroke({ width: Math.max(1, radius * 0.15), color: SCORCH_STROKE, alpha: 0.8 })
    g.position.set(x, y)
    g.alpha = this.pool.alphaAt(slot, this.time)
    g.visible = true
  }

  update(dt: number): void {
    this.time += dt
    for (let slot = 0; slot < this.graphics.length; slot++) {
      const g = this.graphics[slot]
      if (!g) continue
      const alpha = this.pool.alphaAt(slot, this.time)
      g.alpha = alpha
      g.visible = alpha > 0
    }
  }

  destroy(): void {
    for (const g of this.graphics) g?.destroy()
    this.graphics.length = 0
  }
}
