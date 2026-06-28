// src/render/Renderer.ts
import { Application, Container, Graphics } from 'pixi.js'
import type { Level } from '../model/level'
import { PALETTE, RENDER } from '../style/palette'
import { buildTraceStrokes, buildChevrons } from './traceBuilder'
import { buildDecorShapes } from './decorBuilder'
import { cellToPx } from '../geom/grid'

export class Renderer {
  readonly world = new Container()
  readonly layers = {
    board: new Container(), decor: new Container(), trace: new Container(),
    spot: new Container(), overlay: new Container(),
  }
  constructor(private app: Application) {
    this.world.addChild(this.layers.board, this.layers.decor, this.layers.trace, this.layers.spot, this.layers.overlay)
    this.app.stage.addChild(this.world)
  }

  render(level: Level): void {
    for (const c of Object.values(this.layers)) {
      for (const child of c.removeChildren()) child.destroy()
    }
    this.drawBoard(level)
    this.drawDecor(level)
    this.drawTrace(level)
    this.drawSpots(level)
  }

  private drawBoard(level: Level): void {
    const g = new Graphics()
    g.rect(0, 0, level.board.cols * level.board.pitch, level.board.rows * level.board.pitch).fill(PALETTE.substrate)
    for (let x = 0; x <= level.board.cols; x++)
      g.moveTo(x * level.board.pitch, 0).lineTo(x * level.board.pitch, level.board.rows * level.board.pitch)
    for (let y = 0; y <= level.board.rows; y++)
      g.moveTo(0, y * level.board.pitch).lineTo(level.board.cols * level.board.pitch, y * level.board.pitch)
    g.stroke({ color: PALETTE.silk, width: 1, alpha: 0.4 })
    this.layers.board.addChild(g)
  }

  private drawDecor(level: Level): void {
    for (const item of level.decor) {
      const g = new Graphics()
      for (const s of buildDecorShapes(item, level.board.pitch)) {
        if (s.type === 'rect') g.rect(s.x, s.y, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
        else g.circle(s.x, s.y, s.w).fill({ color: s.color, alpha: s.alpha })
      }
      this.layers.decor.addChild(g)
    }
  }

  private drawTrace(level: Level): void {
    if (level.trace.waypoints.length < 2) return  // nothing to draw (e.g. after "New")
    for (const stroke of buildTraceStrokes(level.trace, level.board.pitch)) {
      const g = new Graphics()
      stroke.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
      g.stroke({ color: stroke.color, width: stroke.width, alpha: stroke.alpha, cap: 'round', join: 'round' })
      this.layers.trace.addChild(g)
    }
    for (const ch of buildChevrons(level.trace, level.board.pitch, RENDER.chevronSpacing)) {
      const g = new Graphics()
      g.moveTo(-4, -4).lineTo(2, 0).lineTo(-4, 4).stroke({ color: PALETTE.chevron, width: 2, alpha: 0.8 })
      g.position.set(ch.x, ch.y); g.rotation = ch.angle
      this.layers.trace.addChild(g)
    }
    this.drawPad(level.trace.waypoints[0], PALETTE.startGreen, level.board.pitch)
    this.drawPad(level.trace.waypoints[level.trace.waypoints.length - 1], PALETTE.finishRed, level.board.pitch)
  }

  private drawPad(cell: [number, number], color: number, pitch: number): void {
    const p = cellToPx(cell, pitch)
    const g = new Graphics()
    g.rect(p.x - pitch * 0.7, p.y - pitch * 0.7, pitch * 1.4, pitch * 1.4).stroke({ color, width: 3 })
    g.rect(p.x - pitch * 0.35, p.y - pitch * 0.35, pitch * 0.7, pitch * 0.7).fill({ color, alpha: 0.8 })
    this.layers.trace.addChild(g)
  }

  private drawSpots(level: Level): void {
    const b = RENDER.spotBracket
    for (const s of level.spots) {
      const p = cellToPx(s.cell, level.board.pitch)
      const g = new Graphics()
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
        g.moveTo(p.x + sx * b, p.y + sy * b - sy * (b / 2)).lineTo(p.x + sx * b, p.y + sy * b)
          .lineTo(p.x + sx * b - sx * (b / 2), p.y + sy * b)
      }
      g.stroke({ color: PALETTE.buildGold, width: 2 })
      g.moveTo(p.x - 3, p.y).lineTo(p.x + 3, p.y).moveTo(p.x, p.y - 3).lineTo(p.x, p.y + 3)
        .stroke({ color: PALETTE.buildGold, width: 1, alpha: 0.8 })
      this.layers.spot.addChild(g)
    }
    const oct = (cx: number, cy: number, r: number, g: Graphics) => {
      for (let i = 0; i <= 8; i++) {
        const a = (Math.PI / 4) * i + Math.PI / 8
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
      }
    }
    for (const s of level.specialSpots) {
      const p = cellToPx(s.cell, level.board.pitch)
      const g = new Graphics()
      oct(p.x, p.y, b, g)
      g.stroke({ color: PALETTE.specialCyan, width: 2 })
      g.circle(p.x, p.y, b * 0.45).fill({ color: PALETTE.specialCyan, alpha: 0.7 })
      this.layers.spot.addChild(g)
    }
  }
}
