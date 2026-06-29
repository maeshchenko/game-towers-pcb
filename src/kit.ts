// /kit — UI-kit gallery: every PCB component + variants + mounting + connection examples + path/
// spot/pad samples. A standalone harness for iterating on decor/path render quality.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { DecorItem } from './model/level'
import { buildDecorShapes, footprintCells, padAnchors, type ShapeSpec } from './render/decorBuilder'
import { buildTraceStrokes } from './render/traceBuilder'
import { stylePath } from './geom/pathStyle'
import { makeRng } from './pipeline/rng'

const PITCH = 16
const TILE = 150
const COLS = 7

function drawShapes(shapes: ShapeSpec[], ox = 0, oy = 0): Container {
  const c = new Container()
  const g = new Graphics()
  const texts: ShapeSpec[] = []
  for (const s of shapes) {
    if (s.type === 'rect') g.rect(s.x + ox, s.y + oy, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'circle') g.circle(s.x + ox, s.y + oy, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'line') g.moveTo(s.x1 + ox, s.y1 + oy).lineTo(s.x2 + ox, s.y2 + oy).stroke({ color: s.color, width: s.width, alpha: s.alpha })
    else texts.push(s)
  }
  c.addChild(g)
  for (const s of texts) if (s.type === 'text') {
    const t = new Text({ text: s.text, style: { fontFamily: 'monospace', fontSize: s.size, fill: s.color } })
    if (s.align === 'center') t.anchor.x = 0.5
    t.position.set(s.x + ox, s.y + oy)
    c.addChild(t)
  }
  return c
}

function label(text: string, x: number, y: number, color = 0x6cf2a0, size = 11): Text {
  return new Text({ text, x, y, style: { fontFamily: 'monospace', fontSize: size, fill: color } })
}

function sectionTitle(text: string, x: number, y: number): Text {
  return new Text({ text, x, y, style: { fontFamily: 'monospace', fontSize: 16, fill: 0x9bffc8, fontWeight: 'bold' } })
}

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const world = new Container()
  app.stage.addChild(world)
  // vertical scroll
  let scrollY = 0
  window.addEventListener('wheel', (e) => { scrollY = Math.min(0, scrollY - e.deltaY); world.y = scrollY })

  let y = 16

  // draws one labeled tile in the current grid; returns nothing, advances a shared cursor
  let col = 0
  function tile(name: string, render: (cx: number, cy: number) => Container): void {
    const x = 16 + col * TILE
    const cell = new Graphics()
    cell.rect(x, y, TILE - 8, TILE - 8).fill({ color: 0x0d1f17, alpha: 0.7 }).stroke({ color: 0x1c3a2b, width: 1 })
    world.addChild(cell)
    world.addChild(render(x + (TILE - 8) / 2, y + (TILE - 8) / 2 + 8))
    world.addChild(label(name, x + 6, y + TILE - 22, PALETTE.textDim, 10))
    col++
    if (col >= COLS) { col = 0; y += TILE }
  }
  function newRow(): void { if (col !== 0) { col = 0; y += TILE } }
  function header(text: string): void {
    newRow(); y += 8
    world.addChild(sectionTitle(text, 16, y)); y += 28
  }

  // render a decor item centered at (cx,cy)
  function decorTile(kind: string, variant: number, ref: string): (cx: number, cy: number) => Container {
    return (cx, cy) => {
      const item: DecorItem = { kind, variant, cell: [0, 0], rot: 0, scale: 1, ref }
      const fp = footprintCells(kind, variant, 0)
      const ox = cx - (fp.w * PITCH) / 2
      const oy = cy - (fp.h * PITCH) / 2
      return drawShapes(buildDecorShapes(item, PITCH), ox, oy)
    }
  }

  // ── ICs ─────────────────────────────────────────────────────────────────
  header('ICs / chips')
  for (const [k, v] of [['qfp', 64], ['qfp', 32], ['qfn', 32], ['qfn', 16], ['soic', 14], ['soic', 8], ['dip', 16]] as const)
    tile(`${k} ${v}p`, decorTile(k, v, 'U1'))

  // ── Passives ────────────────────────────────────────────────────────────
  header('Passives')
  for (const [k, label] of [['res', 'R'], ['smdCap', 'C'], ['mlcc', 'C'], ['tant', 'C'], ['inductor', 'L'], ['diode', 'D'], ['led', 'D']] as const)
    tile(k, decorTile(k, 1, label))

  // ── Power / discrete ──────────────────────────────────────────────────────
  header('Power / discrete')
  for (const k of ['electrolytic', 'pwrind', 'sot23', 'crystal'] as const)
    tile(k, decorTile(k, 1, 'Q1'))

  // ── Connectors / headers ──────────────────────────────────────────────────
  header('Connectors')
  for (const v of [2, 4, 8] as const) tile(`header ${v}p`, decorTile('header', v, 'J1'))

  // ── Markers / mounting ──────────────────────────────────────────────────
  header('Markers / mounting')
  for (const k of ['via', 'testpoint', 'mount'] as const) tile(k, decorTile(k, 1, k === 'testpoint' ? 'TP1' : k === 'mount' ? 'MH1' : ''))

  // ── Connections (copper between pads) ─────────────────────────────────────
  header('Connections — copper between pads')
  function connTile(make: (cx: number, cy: number) => Container): (cx: number, cy: number) => Container { return make }
  // two resistors in series with a copper trace + vias
  tile('R—R series', connTile((cx, cy) => {
    const c = new Container()
    const a: DecorItem = { kind: 'res', variant: 1, cell: [0, 0], rot: 0, scale: 1, ref: 'R1' }
    const b: DecorItem = { kind: 'res', variant: 1, cell: [4, 0], rot: 0, scale: 1, ref: 'R2' }
    const ox = cx - 3 * PITCH, oy = cy
    const copper = new Graphics()
    const pa = padAnchors(a).map(([px, py]) => ({ x: px * PITCH + ox + PITCH / 2, y: py * PITCH + oy + PITCH / 2 }))
    const pb = padAnchors(b).map(([px, py]) => ({ x: px * PITCH + ox + PITCH / 2, y: py * PITCH + oy + PITCH / 2 }))
    const p1 = pa[pa.length - 1], p2 = pb[0]
    copper.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).stroke({ color: PALETTE.copperTrace, width: 3, cap: 'round' })
    copper.circle(p1.x, p1.y, 3).fill({ color: PALETTE.copperTrace }); copper.circle(p2.x, p2.y, 3).fill({ color: PALETTE.copperTrace })
    c.addChild(copper)
    c.addChild(drawShapes(buildDecorShapes(a, PITCH), ox, oy))
    c.addChild(drawShapes(buildDecorShapes(b, PITCH), ox, oy))
    return c
  }))
  // IC + decoupling cap
  tile('IC + decap', connTile((cx, cy) => {
    const c = new Container()
    const u: DecorItem = { kind: 'qfn', variant: 16, cell: [0, 0], rot: 0, scale: 1, ref: 'U1' }
    const cap: DecorItem = { kind: 'mlcc', variant: 1, cell: [4, 1], rot: 0, scale: 1, ref: 'C1' }
    const ox = cx - 2.5 * PITCH, oy = cy - 1.5 * PITCH
    const copper = new Graphics()
    const up = padAnchors(u).map(([px, py]) => ({ x: px * PITCH + ox + PITCH / 2, y: py * PITCH + oy + PITCH / 2 }))
    const cp = padAnchors(cap).map(([px, py]) => ({ x: px * PITCH + ox + PITCH / 2, y: py * PITCH + oy + PITCH / 2 }))
    copper.moveTo(up[up.length - 1].x, up[up.length - 1].y).lineTo(cp[0].x, cp[0].y).stroke({ color: PALETTE.copperTrace, width: 3, cap: 'round' })
    c.addChild(copper)
    c.addChild(drawShapes(buildDecorShapes(u, PITCH), ox, oy))
    c.addChild(drawShapes(buildDecorShapes(cap, PITCH), ox, oy))
    return c
  }))

  // ── Path / spots / pads ───────────────────────────────────────────────────
  header('Path / spots / pads')
  // a short styled multi-lane trace sample
  tile('enemy path', (cx, cy) => {
    const wp = stylePath([[0, 0], [6, 0], [6, 4], [0, 4]], makeRng(3))
    const c = new Container()
    for (const st of buildTraceStrokes({ waypoints: wp, cornerRadius: 0.5 }, PITCH)) {
      const g = new Graphics()
      st.points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)))
      g.stroke({ color: st.color, width: st.width, alpha: st.alpha, cap: 'round', join: 'round' })
      c.addChild(g)
    }
    c.position.set(cx - 3 * PITCH, cy - 2 * PITCH)
    return c
  })
  // build spot (gold dashed bracket + crosshair)
  tile('build spot', (cx, cy) => {
    const g = new Graphics()
    const b = 12
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
      g.moveTo(cx + sx * b, cy + sy * b - sy * b / 2).lineTo(cx + sx * b, cy + sy * b).lineTo(cx + sx * b - sx * b / 2, cy + sy * b)
    g.stroke({ color: PALETTE.buildGold, width: 2 })
    g.moveTo(cx - 3, cy).lineTo(cx + 3, cy).moveTo(cx, cy - 3).lineTo(cx, cy + 3).stroke({ color: PALETTE.buildGold, width: 1 })
    const c = new Container(); c.addChild(g); return c
  })
  // special spot (cyan octagon)
  tile('special spot', (cx, cy) => {
    const g = new Graphics(); const r = 12
    for (let i = 0; i <= 8; i++) { const a = Math.PI / 4 * i + Math.PI / 8; const x = cx + Math.cos(a) * r, yy = cy + Math.sin(a) * r; i === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy) }
    g.stroke({ color: PALETTE.specialCyan, width: 2 }); g.circle(cx, cy, r * 0.45).fill({ color: PALETTE.specialCyan, alpha: 0.7 })
    const c = new Container(); c.addChild(g); return c
  })
  // start / finish pads
  for (const [name, color] of [['start', PALETTE.startGreen], ['finish', PALETTE.finishRed]] as const)
    tile(name, (cx, cy) => {
      const g = new Graphics()
      g.rect(cx - 14, cy - 14, 28, 28).stroke({ color, width: 3 })
      g.rect(cx - 7, cy - 7, 14, 14).fill({ color, alpha: 0.8 })
      const c = new Container(); c.addChild(g); return c
    })

  newRow()
  world.addChild(label('scroll to see more · edit decorBuilder/palette and reload to iterate', 16, y + 8, PALETTE.textDim, 11))
}
boot()
