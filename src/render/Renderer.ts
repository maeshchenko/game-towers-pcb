// src/render/Renderer.ts
import { Application, Container, Graphics, Text } from 'pixi.js'
import type { Level } from '../model/level'
import { levelPaths } from '../model/level'
import { PALETTE, RENDER } from '../style/palette'
import { buildTraceStrokes, buildChevrons } from './traceBuilder'
import { buildDecorShapes, footprintCells } from './decorBuilder'
import { buildVintageShapes, VFOOT, type VintageKind } from './vintageDecor'
import { cellToPx } from '../geom/grid'
import { makeRng } from '../pipeline/rng'

// map the generator's (SMD) decor kinds → vintage through-hole parts (top-down) for the game board
const VINTAGE_MAP: Record<string, VintageKind> = {
  soic: 'dipIC', qfp: 'dipIC', qfn: 'dipIC', dip: 'dipIC',
  res: 'resAxial', smdRes: 'resAxial', inductor: 'inductorAxial',
  smdCap: 'ceramicDisc', mlcc: 'ceramicDisc',
  electrolytic: 'electroRadial', elec: 'electroRadial', tant: 'tantalum', tantalum: 'tantalum',
  diode: 'diodeAxial', led: 'led5mm', sot23: 'to92', crystal: 'crystalHC49', xtal: 'crystalHC49',
  pwrind: 'to220', header: 'batteryClip',
}

// Decor is hidden for now — focus is on the trace + tower spots (primary). Flip to re-enable parts.
const SHOW_DECOR = false

// Layers that hold live gameplay state (owned by GameLayers or Task 8-10 view modules) — never
// cleared on level re-render, or a level re-render would destroy the running game's graphics.
const PERSISTENT_LAYERS = new Set(['game', 'decals', 'projectiles', 'particles', 'floatingText'])

export class Renderer {
  readonly world = new Container()
  // Screen-space overlay for vfx (Task 9): added to app.stage AFTER world, so it sits above
  // everything and is unaffected by camera pan/zoom/shake. Never cleared by render().
  readonly vfxOverlay = new Container()
  readonly layers = {
    board: new Container(), copper: new Container(), decor: new Container(), decals: new Container(),
    trace: new Container(), spot: new Container(), game: new Container(), projectiles: new Container(),
    particles: new Container(), overlay: new Container(), floatingText: new Container(),
  }
  constructor(private app: Application) {
    this.world.addChild(
      this.layers.board, this.layers.copper, this.layers.decor, this.layers.decals,
      this.layers.trace, this.layers.spot, this.layers.game, this.layers.projectiles,
      this.layers.particles, this.layers.overlay, this.layers.floatingText,
    )
    this.app.stage.addChild(this.world, this.vfxOverlay)
  }

  render(level: Level): void {
    for (const [name, c] of Object.entries(this.layers)) {
      if (PERSISTENT_LAYERS.has(name)) continue
      for (const child of c.removeChildren()) child.destroy()
    }
    this.drawBoard(level)
    if (SHOW_DECOR) { this.drawCopper(level); this.drawDecor(level) }
    this.drawTrace(level)
    this.drawSpots(level)
  }

  private drawBoard(level: Level): void {
    const g = new Graphics()
    const bw = level.board.cols * level.board.pitch
    const bh = level.board.rows * level.board.pitch
    // Substrate fill
    g.rect(0, 0, bw, bh).fill(PALETTE.substrate)
    // Ground-plane crosshatch: 45° lines at ~6px spacing, low alpha
    for (let d = -bh; d <= bw; d += 6) g.moveTo(d, 0).lineTo(d + bh, bh)
    g.stroke({ color: PALETTE.hatch, width: 0.5, alpha: 0.25 })
    // Silk cell grid
    for (let x = 0; x <= level.board.cols; x++)
      g.moveTo(x * level.board.pitch, 0).lineTo(x * level.board.pitch, bh)
    for (let y = 0; y <= level.board.rows; y++)
      g.moveTo(0, y * level.board.pitch).lineTo(bw, y * level.board.pitch)
    g.stroke({ color: PALETTE.silk, width: 1, alpha: 0.4 })
    this.layers.board.addChild(g)
    this.drawRoutingWeb(level)
  }

  // Faint background copper-routing web (thin teal stubs + sparse via field) for authentic PCB
  // texture. Seeded by the level so it stays stable across re-renders; sits under copper/decor/path.
  private drawRoutingWeb(level: Level): void {
    const { cols, rows, pitch } = level.board
    const rng = makeRng((level.seed ?? 1) ^ 0x5eed)
    const g = new Graphics()
    const stubs = Math.floor((cols * rows) / 22)
    const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]] as const
    for (let i = 0; i < stubs; i++) {
      const cx = Math.floor(rng() * cols), cy = Math.floor(rng() * rows)
      const [dx, dy] = dirs[Math.floor(rng() * dirs.length)]
      const len = 2 + Math.floor(rng() * 5)
      const x0 = cx * pitch + pitch / 2, y0 = cy * pitch + pitch / 2
      g.moveTo(x0, y0).lineTo(x0 + dx * len * pitch, y0 + dy * len * pitch)
    }
    g.stroke({ color: PALETTE.routing, width: Math.max(1, pitch * 0.08), alpha: 0.5 })
    const vias = Math.floor((cols * rows) / 30)
    for (let i = 0; i < vias; i++) {
      const x = (Math.floor(rng() * cols) + 0.5) * pitch, y = (Math.floor(rng() * rows) + 0.5) * pitch
      g.circle(x, y, Math.max(1, pitch * 0.1)).fill({ color: PALETTE.routing, alpha: 0.6 })
    }
    this.layers.board.addChild(g)
  }

  private drawCopper(level: Level): void {
    if (!level.copper || level.copper.length === 0) return
    const pitch = level.board.pitch
    const traceW = Math.max(2, pitch * 0.18)
    const viaR = Math.max(2, pitch * 0.12)

    for (const copper of level.copper) {
      if (copper.points.length < 2) continue
      const g = new Graphics()
      const pts = copper.points.map(c => cellToPx(c, pitch))
      g.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y)
      g.stroke({ color: PALETTE.copperTrace, width: traceW, alpha: 0.85, cap: 'round', join: 'round' })
      // Tiny via dot at each endpoint
      const first = pts[0], last = pts[pts.length - 1]
      g.circle(first.x, first.y, viaR).fill({ color: PALETTE.copperTrace, alpha: 0.9 })
      g.circle(last.x, last.y, viaR).fill({ color: PALETTE.copperTrace, alpha: 0.9 })
      this.layers.copper.addChild(g)
    }
  }

  private drawDecor(level: Level): void {
    const pitch = level.board.pitch
    for (const item of level.decor) {
      const v = VINTAGE_MAP[item.kind]
      if (v) { this.drawVintageItem(item, v, pitch); continue }
      const g = new Graphics()
      const pendingText: Array<{ x: number; y: number; text: string; size: number; color: number; align?: 'left' | 'center' }> = []
      for (const s of buildDecorShapes(item, level.board.pitch)) {
        if (s.type === 'rect') {
          g.rect(s.x, s.y, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
        } else if (s.type === 'roundRect') {
          g.roundRect(s.x, s.y, s.w, s.h, s.r).fill({ color: s.color, alpha: s.alpha })
        } else if (s.type === 'circle') {
          g.circle(s.x, s.y, s.r).fill({ color: s.color, alpha: s.alpha })
        } else if (s.type === 'line') {
          g.moveTo(s.x1, s.y1).lineTo(s.x2, s.y2).stroke({ color: s.color, width: s.width, alpha: s.alpha })
        } else if (s.type === 'text') {
          pendingText.push(s)
        }
      }
      this.layers.decor.addChild(g)
      // Text objects rendered after graphics so they appear on top
      for (const s of pendingText) {
        const t = new Text({ text: s.text, style: { fontFamily: 'monospace', fontSize: s.size, fill: s.color } })
        if (s.align === 'center') t.anchor.x = 0.5
        t.position.set(s.x, s.y)
        this.layers.decor.addChild(t)
      }
    }
  }

  // render a vintage through-hole part fit (uniform scale, centered) into the item's footprint box
  private drawVintageItem(item: import('../model/level').DecorItem, v: VintageKind, pitch: number): void {
    const fp = footprintCells(item.kind, item.variant, item.rot)
    const boxW = fp.w * pitch, boxH = fp.h * pitch
    const vf = VFOOT[v]
    const vp = Math.min(boxW / vf.w, boxH / vf.h)               // pitch that fits the part in the box
    const ox = item.cell[0] * pitch + (boxW - vf.w * vp) / 2
    const oy = item.cell[1] * pitch + (boxH - vf.h * vp) / 2
    const g = new Graphics()
    for (const s of buildVintageShapes(v, vp)) {
      if (s.type === 'rect') g.rect(s.x + ox, s.y + oy, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
      else if (s.type === 'roundRect') g.roundRect(s.x + ox, s.y + oy, s.w, s.h, s.r).fill({ color: s.color, alpha: s.alpha })
      else if (s.type === 'circle') g.circle(s.x + ox, s.y + oy, s.r).fill({ color: s.color, alpha: s.alpha })
      else if (s.type === 'line') g.moveTo(s.x1 + ox, s.y1 + oy).lineTo(s.x2 + ox, s.y2 + oy).stroke({ color: s.color, width: s.width, alpha: s.alpha })
    }
    this.layers.decor.addChild(g)
  }

  private drawTrace(level: Level): void {
    const paths = levelPaths(level)
    for (const trace of paths) {
      if (trace.waypoints.length < 2) continue
      for (const stroke of buildTraceStrokes(trace, level.board.pitch)) {
        const g = new Graphics()
        stroke.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
        g.stroke({ color: stroke.color, width: stroke.width, alpha: stroke.alpha, cap: 'round', join: 'round' })
        this.layers.trace.addChild(g)
      }
      for (const ch of buildChevrons(trace, level.board.pitch, RENDER.chevronSpacing)) {
        const g = new Graphics()
        g.moveTo(-4, -4).lineTo(2, 0).lineTo(-4, 4).stroke({ color: PALETTE.chevron, width: 2, alpha: 0.8 })
        g.position.set(ch.x, ch.y); g.rotation = ch.angle
        this.layers.trace.addChild(g)
      }
      this.drawPad(trace.waypoints[0], PALETTE.startGreen, level.board.pitch)
      this.drawPad(trace.waypoints[trace.waypoints.length - 1], PALETTE.finishRed, level.board.pitch)
    }
  }

  private drawPad(cell: [number, number], color: number, pitch: number): void {
    const p = cellToPx(cell, pitch)
    const g = new Graphics()
    g.rect(p.x - pitch * 0.7, p.y - pitch * 0.7, pitch * 1.4, pitch * 1.4).stroke({ color, width: 3 })
    g.rect(p.x - pitch * 0.35, p.y - pitch * 0.35, pitch * 0.7, pitch * 0.7).fill({ color, alpha: 0.8 })
    this.layers.trace.addChild(g)
  }

  private drawSpots(level: Level): void {
    const pitch = level.board.pitch
    const b = Math.max(11, pitch * 0.62)   // bracket half-size scales with the (now larger) pitch
    const lw = Math.max(2.5, pitch * 0.1)
    for (const s of level.spots) {
      const p = cellToPx(s.cell, pitch)
      const g = new Graphics()
      g.roundRect(p.x - b, p.y - b, b * 2, b * 2, 3).fill({ color: PALETTE.buildGold, alpha: 0.13 }) // glow plate
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {                        // corner brackets
        g.moveTo(p.x + sx * b, p.y + sy * b - sy * b * 0.55).lineTo(p.x + sx * b, p.y + sy * b)
          .lineTo(p.x + sx * b - sx * b * 0.55, p.y + sy * b)
      }
      g.stroke({ color: PALETTE.buildGold, width: lw })
      g.moveTo(p.x - b * 0.4, p.y).lineTo(p.x + b * 0.4, p.y).moveTo(p.x, p.y - b * 0.4).lineTo(p.x, p.y + b * 0.4)
        .stroke({ color: PALETTE.buildGold, width: lw * 0.7 })                                        // crosshair
      g.circle(p.x, p.y, Math.max(2, pitch * 0.12)).fill({ color: PALETTE.buildGold, alpha: 0.55 })   // centre dot
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
      const p = cellToPx(s.cell, pitch)
      const g = new Graphics()
      g.circle(p.x, p.y, b).fill({ color: PALETTE.specialCyan, alpha: 0.12 })
      oct(p.x, p.y, b, g)
      g.stroke({ color: PALETTE.specialCyan, width: lw })
      g.circle(p.x, p.y, b * 0.4).fill({ color: PALETTE.specialCyan, alpha: 0.85 })
      this.layers.spot.addChild(g)
    }
  }
}
