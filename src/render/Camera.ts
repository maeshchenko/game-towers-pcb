// src/render/Camera.ts
import type { Container } from 'pixi.js'

export class Camera {
  x = 0; y = 0; zoom = 1
  panBy(dx: number, dy: number): void { this.x += dx; this.y += dy }
  zoomAt(px: number, py: number, factor: number): void {
    const worldX = (px - this.x) / this.zoom
    const worldY = (py - this.y) / this.zoom
    this.zoom = Math.max(0.25, Math.min(4, this.zoom * factor))
    this.x = px - worldX * this.zoom
    this.y = py - worldY * this.zoom
  }
  apply(stage: Container): void {
    stage.position.set(this.x, this.y)
    stage.scale.set(this.zoom)
  }
}
