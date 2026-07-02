// src/render/Camera.ts
import type { Container } from 'pixi.js'

export class Camera {
  x = 0; y = 0; zoom = 1
  // Zoom-out is capped near the level's start framing (set per level via frameLevel);
  // zoom-in cap keeps the board from degenerating into a handful of giant cells.
  minZoom = 0.1
  maxZoom = 4
  panBy(dx: number, dy: number): void { this.x += dx; this.y += dy }
  zoomAt(px: number, py: number, factor: number): void {
    const worldX = (px - this.x) / this.zoom
    const worldY = (py - this.y) / this.zoom
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor))
    this.x = px - worldX * this.zoom
    this.y = py - worldY * this.zoom
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
