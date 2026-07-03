// src/render/Renderer.ts
import { Application, Container, Graphics, Text } from 'pixi.js'
import type { Level } from '../model/level'
import { levelPaths } from '../model/level'
import { PALETTE, RENDER } from '../style/palette'
import { buildTraceStrokes, buildChevrons } from './traceBuilder'
import { buildDecorShapes, footprintCells, padAnchors } from './decorBuilder'
import { buildVintageShapes, VFOOT, type VintageKind } from './vintageDecor'
import { cellToPx } from '../geom/grid'
import { chamfer45, filletPixels, strokeCopper, teardrop, dirTo } from './copperStyle'
import type { Pt } from '../geom/types'

// map the generator's (SMD) decor kinds → vintage through-hole parts (top-down) for the game board
const VINTAGE_MAP: Record<string, VintageKind> = {
  soic: 'dipIC', qfp: 'dipIC', qfn: 'dipIC', dip: 'dipIC',
  res: 'resAxial', smdRes: 'resAxial', inductor: 'inductorAxial',
  smdCap: 'ceramicDisc', mlcc: 'ceramicDisc',
  electrolytic: 'electroRadial', elec: 'electroRadial', tant: 'tantalum', tantalum: 'tantalum',
  diode: 'diodeAxial', led: 'led5mm', sot23: 'to92', crystal: 'crystalHC49', xtal: 'crystalHC49',
  pwrind: 'to220', header: 'batteryClip',
}

// Decor (copper web + vintage parts) is drawn and cached as a texture (Task 10) — cheap after
// the first bake since copper/decor are static per level.
const SHOW_DECOR = true

// Layers that hold live gameplay state (owned by GameLayers or Task 8-10 view modules) — never
// cleared on level re-render, or a level re-render would destroy the running game's graphics.
const PERSISTENT_LAYERS = new Set(['game', 'decals', 'projectiles', 'particles', 'floatingText', 'tracePulse'])

export class Renderer {
  readonly world = new Container()
  // Screen-space overlay for vfx (Task 9): added to app.stage AFTER world, so it sits above
  // everything and is unaffected by camera pan/zoom/shake. Never cleared by render().
  readonly vfxOverlay = new Container()
  readonly layers = {
    board: new Container(), copper: new Container(), decor: new Container(), decals: new Container(),
    trace: new Container(), tracePulse: new Container(), spot: new Container(), game: new Container(),
    projectiles: new Container(), particles: new Container(), overlay: new Container(), floatingText: new Container(),
  }
  constructor(private app: Application) {
    this.world.addChild(
      this.layers.board, this.layers.copper, this.layers.decor, this.layers.decals,
      this.layers.trace, this.layers.tracePulse, this.layers.spot, this.layers.game, this.layers.projectiles,
      this.layers.particles, this.layers.overlay, this.layers.floatingText,
    )
    this.app.stage.addChild(this.world, this.vfxOverlay)
  }

  render(level: Level): void {
    // copper/decor are cached as a texture below (static per level, cheap to keep cached across
    // frames). Uncache BEFORE clearing children — destroying children of a cached render group is
    // unsafe in pixi v8; the correct order is uncache → clear → redraw → recache.
    this.layers.copper.cacheAsTexture(false)
    this.layers.decor.cacheAsTexture(false)
    for (const [name, c] of Object.entries(this.layers)) {
      if (PERSISTENT_LAYERS.has(name)) continue
      for (const child of c.removeChildren()) child.destroy()
    }
    this.drawBoard(level)
    if (SHOW_DECOR) {
      this.drawCopper(level)
      this.drawDecor(level)
      // Bake to a single texture each — copper/decor never change between renders of the same
      // level, so this trades one re-bake per level load for near-zero draw-call cost per frame.
      this.layers.copper.cacheAsTexture(true)
      this.layers.decor.cacheAsTexture(true)
      // Dim decor/copper relative to gameplay elements (trace/brackets/octagons) — decor is
      // background, not foreground. Container alpha applies on top of the cached texture in pixi v8.
      this.layers.copper.alpha = 0.8
      this.layers.decor.alpha = 0.8
    }
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
  }

  // Drop points that don't change direction — keeps chamfer45's corner detection working on real
  // corners only and avoids feeding filletPixels a long run of near-duplicate bezier arcs along
  // straight runs (the A* route emits one point per fine-grid step).
  private static simplifyCollinear(pts: Pt[]): Pt[] {
    return pts.filter((p, i) => i === 0 || i === pts.length - 1 ||
      Math.sign(p.x - pts[i - 1].x) !== Math.sign(pts[i + 1].x - p.x) ||
      Math.sign(p.y - pts[i - 1].y) !== Math.sign(pts[i + 1].y - p.y))
  }

  private drawCopper(level: Level): void {
    if (!level.copper || level.copper.length === 0) return
    const pitch = level.board.pitch
    // Decorative copper stroke: quieter/thinner/straighter than the bright PALETTE.copperTrace used
    // for gameplay elements — decor copper should read as background, not compete with the trace.
    const traceColor = 0x25573a
    const traceAlpha = 0.75
    const traceW = Math.max(1.5, pitch * 0.12)
    const viaOuterR = Math.max(2, pitch * 0.14)
    const viaInnerR = Math.max(1, pitch * 0.06)
    const padR = pitch * 0.14 // subtle teardrop — big flares read as solder blobs
    const chamferCut = pitch * 0.4
    // Barely-there rounding: reference boards read as straight runs with crisp 45° corners.
    const filletRadius = pitch * 0.04

    // Endpoints landing on a component pad already get pad art from drawVintageItem/drawDecor —
    // giving them a via dot too reads as a fake extra via. Only free-floating endpoints (test
    // points, mid-route vias) get the via dot; pad endpoints get a teardrop fillet instead.
    const padAnchorList: [number, number][] = []
    for (const item of level.decor) padAnchorList.push(...padAnchors(item))
    const isPadAnchor = (c: [number, number]): boolean =>
      padAnchorList.some(([ax, ay]) => Math.hypot(c[0] - ax, c[1] - ay) < 0.7)

    for (const copper of level.copper) {
      if (copper.points.length < 2) continue
      const g = new Graphics()
      const rawPts = copper.points.map(c => cellToPx(c, pitch))
      const pts = filletPixels(chamfer45(Renderer.simplifyCollinear(rawPts), chamferCut), filletRadius)
      // Dark recessed bed under the core (kit2 look): the run reads as etched copper with depth,
      // not a flat glowing line.
      strokeCopper(g, pts, { core: traceColor, width: traceW, alpha: traceAlpha, bed: PALETTE.copperBed, bedAlpha: 0.6, bedMul: 2.3 })

      const firstCell = copper.points[0], lastCell = copper.points[copper.points.length - 1]
      const first = pts[0], last = pts[pts.length - 1]
      if (isPadAnchor(firstCell)) {
        teardrop(g, first, dirTo(first, pts[1]), padR, traceW, traceColor, traceAlpha)
        this.addPinLabel(copper.labelA, first, pitch)
      } else {
        g.circle(first.x, first.y, viaOuterR).fill({ color: traceColor, alpha: traceAlpha + 0.05 })
        g.circle(first.x, first.y, viaInnerR).fill({ color: PALETTE.substrate, alpha: 1 })
      }
      if (isPadAnchor(lastCell)) {
        const n = pts.length - 1
        teardrop(g, last, dirTo(last, pts[n - 1]), padR, traceW, traceColor, traceAlpha)
        this.addPinLabel(copper.labelB, last, pitch)
      } else {
        g.circle(last.x, last.y, viaOuterR).fill({ color: traceColor, alpha: traceAlpha + 0.05 })
        g.circle(last.x, last.y, viaInnerR).fill({ color: PALETTE.substrate, alpha: 1 })
      }
      this.layers.copper.addChild(g)
    }
  }

  // kit2-style pin-function label ('anode', 'VCC', '+', …) next to a wired pad — tiny gold
  // silkscreen text, offset below the pad so it never sits on the trace run.
  private addPinLabel(label: string | undefined, at: { x: number; y: number }, pitch: number): void {
    if (!label) return
    const t = new Text({
      text: label,
      style: { fontFamily: 'monospace', fontSize: Math.max(7, pitch * 0.26), fill: 0xd8c060 },
    })
    t.anchor.set(0.5, 0)
    t.alpha = 0.6
    t.position.set(at.x, at.y + pitch * 0.3)
    this.layers.copper.addChild(t)
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
    // LEDs default to a bright red glow — keep decor muted with a dim green/amber pick by variant.
    // Silkscreen designators (R1, C4, U2…) come from the generator's ref allocator — printing
    // them is what makes the board read as a real engineering document (kit2 look).
    const opts: import('./vintageDecor').VintageOpts = v === 'led5mm' ? { color: item.variant === 1 ? 0x2f7a4a : 0x7d6a2f } : {}
    if (item.ref) opts.ref = item.ref
    const texts: Array<{ x: number; y: number; text: string; size: number; color: number; align?: string }> = []
    for (const s of buildVintageShapes(v, vp, opts)) {
      if (s.type === 'rect') g.rect(s.x + ox, s.y + oy, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
      else if (s.type === 'roundRect') g.roundRect(s.x + ox, s.y + oy, s.w, s.h, s.r).fill({ color: s.color, alpha: s.alpha })
      else if (s.type === 'circle') g.circle(s.x + ox, s.y + oy, s.r).fill({ color: s.color, alpha: s.alpha })
      else if (s.type === 'line') g.moveTo(s.x1 + ox, s.y1 + oy).lineTo(s.x2 + ox, s.y2 + oy).stroke({ color: s.color, width: s.width, alpha: s.alpha })
      else if (s.type === 'text') texts.push(s)
    }
    this.layers.decor.addChild(g)
    // Silkscreen designators / part markings (R1, C4, '+', '104'…) — drawVintageItem used to
    // silently drop text specs, which is why boards looked less "engineering-document" than kit2.
    for (const ts of texts) {
      const t = new Text({ text: ts.text, style: { fontFamily: 'monospace', fontSize: ts.size, fill: ts.color } })
      if (ts.align === 'center') t.anchor.set(0.5, 0)
      t.alpha = 0.85
      t.position.set(ts.x + ox, ts.y + oy)
      this.layers.decor.addChild(t)
    }
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
