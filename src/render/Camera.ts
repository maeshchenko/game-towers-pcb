// src/render/Camera.ts
import type { Container } from 'pixi.js'

export class Camera {
  x = 0; y = 0; zoom = 1
  // Zoom-out is capped near the level's start framing (set per level via frameLevel);
  // zoom-in cap keeps the board from degenerating into a handful of giant cells.
  minZoom = 0.1
  maxZoom = 4

  // Glide targets for PROGRAMMATIC moves (level framing, resize): the camera eases there in
  // update(). Direct user input (drag/pinch/wheel) must stay 1:1 under the finger, so panBy/
  // zoomAt write immediately and cancel any glide in flight.
  private tx: number | null = null
  private ty = 0
  private tzoom = 1

  panBy(dx: number, dy: number): void { this.cancelGlide(); this.x += dx; this.y += dy }
  zoomAt(px: number, py: number, factor: number): void {
    this.cancelGlide()
    const worldX = (px - this.x) / this.zoom
    const worldY = (py - this.y) / this.zoom
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor))
    this.x = px - worldX * this.zoom
    this.y = py - worldY * this.zoom
  }

  /** Ease toward a pose over ~0.3-0.5s (exponential). Expensive-feeling, cheap to run. */
  glideTo(x: number, y: number, zoom: number): void { this.tx = x; this.ty = y; this.tzoom = zoom }
  snapTo(x: number, y: number, zoom: number): void { this.cancelGlide(); this.x = x; this.y = y; this.zoom = zoom }
  cancelGlide(): void { this.tx = null }

  /** Advance the glide; call once per frame BEFORE apply(). No-op when idle. */
  update(dt: number): void {
    if (this.tx === null) return
    const k = 1 - Math.exp(-8 * dt)
    this.x += (this.tx - this.x) * k
    this.y += (this.ty - this.y) * k
    this.zoom += (this.tzoom - this.zoom) * k
    if (Math.abs(this.tx - this.x) < 0.5 && Math.abs(this.ty - this.y) < 0.5 && Math.abs(this.tzoom - this.zoom) < 0.001) {
      this.x = this.tx; this.y = this.ty; this.zoom = this.tzoom
      this.tx = null
    }
  }

  /** Frame a world-space bounding box centered in the viewport, filling `fill` of it. */
  frameBounds(minX: number, minY: number, maxX: number, maxY: number, viewW: number, viewH: number, fill = 0.78): void {
    const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY)
    this.zoom = Math.max(0.1, Math.min(4, Math.min((viewW * fill) / w, (viewH * fill) / h)))
    this.x = viewW / 2 - ((minX + maxX) / 2) * this.zoom
    this.y = viewH / 2 - ((minY + maxY) / 2) * this.zoom
  }

  apply(stage: Container): void {
    stage.position.set(this.x, this.y)
    stage.scale.set(this.zoom)
  }
}
