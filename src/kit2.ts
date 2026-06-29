// /kit2 — vintage through-hole kit. Three sections:
//   1) component library  2) pairwise connections (what wires to what & why)  3) full schematic.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { ShapeSpec } from './render/decorBuilder'
import { buildVintageShapes, vintageLeadEnds, vintagePins, pin, VFOOT, type VintageKind, type VintageOpts } from './render/vintageDecor'
import { routeOctilinear } from './geom/router'
import { cellKey } from './geom/grid'
import type { Cell } from './geom/types'

const P = 18
const TILE = 172
const COLS = 7
type Pt = { x: number; y: number }

function drawShapes(shapes: ShapeSpec[], ox = 0, oy = 0): Container {
  const c = new Container(), g = new Graphics(), texts: ShapeSpec[] = []
  for (const s of shapes) {
    if (s.type === 'rect') g.rect(s.x + ox, s.y + oy, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'roundRect') g.roundRect(s.x + ox, s.y + oy, s.w, s.h, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'circle') g.circle(s.x + ox, s.y + oy, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'line') g.moveTo(s.x1 + ox, s.y1 + oy).lineTo(s.x2 + ox, s.y2 + oy).stroke({ color: s.color, width: s.width, alpha: s.alpha })
    else texts.push(s)
  }
  c.addChild(g)
  for (const s of texts) if (s.type === 'text') { const t = new Text({ text: s.text, style: { fontFamily: 'monospace', fontSize: s.size, fill: s.color } }); t.position.set(s.x + ox, s.y + oy); c.addChild(t) }
  return c
}
const leadsAt = (kind: VintageKind, gx: number, gy: number): Pt[] =>
  vintageLeadEnds(kind, P).map((l) => ({ x: gx + l.x, y: gy + l.y }))

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const world = new Container()
  app.stage.addChild(world)
  let scrollY = 0
  window.addEventListener('wheel', (e) => { scrollY = Math.min(0, scrollY - e.deltaY); world.y = scrollY })

  const text = (t: string, x: number, y: number, fill: number = PALETTE.textDim, size = 11, bold = false) =>
    world.addChild(new Text({ text: t, x, y, style: { fontFamily: 'monospace', fontSize: size, fill, ...(bold ? { fontWeight: 'bold' } : {}) } }))
  let y = 16
  const section = (t: string) => { text(t, 16, y, 0x9bffc8, 17, true); y += 30 }

  // centered component inside a TILE-sized cell
  function centerPart(kind: VintageKind, cellX: number, cellY: number, w: number, h: number, opts?: VintageOpts): void {
    const fp = VFOOT[kind]
    const ox = cellX + w / 2 - (fp.w * P) / 2, oy = cellY + h / 2 - (fp.h * P) / 2
    world.addChild(drawShapes(buildVintageShapes(kind, P, opts), ox, oy))
  }
  function cell(x: number, w: number, h: number, label: string): void {
    const g = new Graphics(); g.rect(x, y, w, h).fill({ color: 0x0d1f17, alpha: 0.7 }).stroke({ color: 0x1c3a2b, width: 1 }); world.addChild(g)
    text(label, x + 6, y + h - 18, PALETTE.textDim, 10)
  }

  // ── SECTION 1 — library ───────────────────────────────────────────────────
  section('1 · COMPONENT LIBRARY')
  const lib: { kind: VintageKind; label: string; opts?: VintageOpts }[] = [
    { kind: 'resAxial', label: 'resistor' }, { kind: 'diodeAxial', label: 'diode' }, { kind: 'inductorAxial', label: 'inductor' },
    { kind: 'ceramicDisc', label: 'ceramic disc' }, { kind: 'filmCap', label: 'film cap' }, { kind: 'electroRadial', label: 'electrolytic' },
    { kind: 'tantalum', label: 'tantalum' }, { kind: 'trimpot', label: 'trimpot' }, { kind: 'crystalHC49', label: 'crystal' },
    { kind: 'to92', label: 'TO-92' }, { kind: 'to220', label: 'TO-220' }, { kind: 'dipIC', label: 'DIP IC' },
    { kind: 'led5mm', label: 'LED red ON', opts: { color: 0xe23a3a, on: true } },
    { kind: 'led5mm', label: 'LED red OFF', opts: { color: 0xe23a3a, on: false } },
    { kind: 'led5mm', label: 'LED green ON', opts: { color: 0x3ad26a, on: true } },
    { kind: 'led5mm', label: 'LED green OFF', opts: { color: 0x3ad26a, on: false } },
    { kind: 'battery9v', label: '9V battery' }, { kind: 'batteryClip', label: 'battery clip (Krona)' }, { kind: 'powerJack', label: 'DC power jack' },
  ]
  lib.forEach((e, i) => {
    const col = i % COLS, x = 16 + col * TILE
    if (col === 0 && i > 0) y += TILE
    cell(x, TILE - 8, TILE - 8, e.label)
    centerPart(e.kind, x, y, TILE - 8, TILE - 8, e.opts)
  })
  y += TILE + 16

  // ── SECTION 2 — pairwise connections ──────────────────────────────────────
  section('2 · CONNECTIONS — which part wires to which, and why')
  const PW = 290, PH = 150, PCOLS = 4
  function copperSeg(g: Graphics, a: Pt, b: Pt): void {
    const my = (a.y + b.y) / 2
    g.moveTo(a.x, a.y).lineTo(a.x, my).lineTo(b.x, my).lineTo(b.x, b.y).stroke({ color: PALETTE.copperTrace, width: 3, cap: 'round', join: 'round' })
    g.circle(a.x, a.y, 3).fill({ color: PALETTE.copperTrace }); g.circle(b.x, b.y, 3).fill({ color: PALETTE.copperTrace })
  }
  // pair: two parts placed left/right, connected by FUNCTION pins (anode↔cathode, +↔−, …)
  type Spec = { kind: VintageKind; opts?: VintageOpts; dx: number; dy: number; pin: string }
  const pairs: { why: string; a: Spec; b: Spec }[] = [
    { why: 'battery + → clip + : snaps on (power)', a: { kind: 'battery9v', dx: 0.22, dy: 0.1, pin: '+' }, b: { kind: 'batteryClip', dx: 0.7, dy: 0.0, pin: '+' } },
    { why: 'clip + → jack tip+ : board power in', a: { kind: 'batteryClip', dx: 0.22, dy: 0.0, pin: '+' }, b: { kind: 'powerJack', dx: 0.68, dy: 0.3, pin: 'tip+' } },
    { why: 'R → LED anode : limits current', a: { kind: 'resAxial', dx: 0.05, dy: 0.4, pin: 'B' }, b: { kind: 'led5mm', opts: { on: true }, dx: 0.7, dy: 0.3, pin: 'anode' } },
    { why: 'diode cathode → cap + : rectify→smooth', a: { kind: 'diodeAxial', dx: 0.04, dy: 0.4, pin: 'cathode' }, b: { kind: 'electroRadial', dx: 0.62, dy: 0.0, pin: '+' } },
    { why: 'cap + → 7805 IN : smoothed DC in', a: { kind: 'electroRadial', dx: 0.1, dy: 0.0, pin: '+' }, b: { kind: 'to220', dx: 0.62, dy: 0.0, pin: 'IN' } },
    { why: '7805 OUT → ceramic : decoupling', a: { kind: 'to220', dx: 0.05, dy: 0.0, pin: 'OUT' }, b: { kind: 'ceramicDisc', dx: 0.7, dy: 0.3, pin: 't1' } },
    { why: 'crystal → IC OSC : clock', a: { kind: 'crystalHC49', dx: 0.08, dy: 0.1, pin: 'x1' }, b: { kind: 'dipIC', dx: 0.5, dy: 0.4, pin: 'OSC' } },
    { why: 'IC VCC → ceramic : decap on power', a: { kind: 'dipIC', dx: 0.04, dy: 0.4, pin: 'VCC' }, b: { kind: 'ceramicDisc', dx: 0.78, dy: 0.2, pin: 't1' } },
    { why: 'R + film cap : RC filter / timing', a: { kind: 'resAxial', dx: 0.05, dy: 0.4, pin: 'B' }, b: { kind: 'filmCap', dx: 0.66, dy: 0.3, pin: 't1' } },
    { why: 'R → TO-92 base : biases transistor', a: { kind: 'resAxial', dx: 0.04, dy: 0.4, pin: 'B' }, b: { kind: 'to92', dx: 0.66, dy: 0.2, pin: 'B' } },
    { why: 'trimpot → IC IO : adjustable input', a: { kind: 'trimpot', dx: 0.1, dy: 0.2, pin: 'end2' }, b: { kind: 'dipIC', dx: 0.55, dy: 0.4, pin: 'IO' } },
    { why: 'inductor → cap + : LC ripple filter', a: { kind: 'inductorAxial', dx: 0.02, dy: 0.4, pin: 'B' }, b: { kind: 'electroRadial', dx: 0.6, dy: 0.0, pin: '+' } },
  ]
  pairs.forEach((pr, i) => {
    const col = i % PCOLS, x = 16 + col * (PW + 10)
    if (col === 0 && i > 0) y += PH + 10
    const g = new Graphics(); g.rect(x, y, PW, PH).fill({ color: 0x0a1712, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 }); world.addChild(g)
    const ax = x + pr.a.dx * PW, ay = y + 24 + pr.a.dy * (PH - 40)
    const bx = x + pr.b.dx * PW, by = y + 24 + pr.b.dy * (PH - 40)
    const ia = Math.max(0, pin(pr.a.kind, pr.a.pin)), ib = Math.max(0, pin(pr.b.kind, pr.b.pin))
    const la = leadsAt(pr.a.kind, ax, ay)[ia], lb = leadsAt(pr.b.kind, bx, by)[ib]
    const cg = new Graphics(); copperSeg(cg, la, lb); world.addChild(cg)            // copper under
    world.addChild(drawShapes(buildVintageShapes(pr.a.kind, P, pr.a.opts), ax, ay)) // parts on top
    world.addChild(drawShapes(buildVintageShapes(pr.b.kind, P, pr.b.opts), bx, by))
    text(pr.a.pin, la.x - 6, la.y + 6, 0xd8c060, 9); text(pr.b.pin, lb.x - 6, lb.y + 6, 0xd8c060, 9) // pin labels
    text(pr.why, x + 8, y + 8, 0x8fb8a0, 10)
  })
  y += PH + 24

  // ── SECTION 3 — full schematic (obstacle-aware routing: no trace crosses a foreign pin/trace) ──
  section('3 · FULL SCHEMATIC — A* routes around pins/traces, GND pour + VCC rail, vias on cross')
  const BX = 16, BY = y + 4, BW = 1180, BH = 560
  const VCC = BY + 30, COP = PALETTE.copperTrace
  const sub = new Graphics(), copperG = new Graphics(), partsHolder = new Container(), topG = new Graphics()
  world.addChild(sub, copperG, partsHolder, topG)

  // ground POUR (whole board is GND plane) + hatch — GND pins thermal-via straight into it
  sub.rect(BX, BY, BW, BH).fill({ color: 0x0c2418, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 })
  for (let d = -BH; d < BW; d += 6) sub.moveTo(BX + d, BY).lineTo(BX + d + BH, BY + BH)
  sub.stroke({ color: PALETTE.hatch, width: 0.5, alpha: 0.22 })

  // routing grid: bodies + every pin + already-routed traces are blocked → no overlaps
  const CELL = 9
  const gcols = Math.floor(BW / CELL), grows = Math.floor(BH / CELL)
  const blocked = new Set<string>()
  const toC = (p: Pt): Cell => [Math.round((p.x - BX) / CELL), Math.round((p.y - BY) / CELL)]
  const toP = (c: Cell): Pt => ({ x: BX + c[0] * CELL, y: BY + c[1] * CELL })
  const blockCell = (c: Cell) => blocked.add(cellKey(c))
  const unblockRing = (c: Cell) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.delete(cellKey([c[0] + dx, c[1] + dy])) }
  function blockBox(px: number, py: number, w: number, h: number, pad = 1): void {
    const a = toC({ x: px, y: py }), b = toC({ x: px + w, y: py + h })
    for (let cx = a[0] - pad; cx <= b[0] + pad; cx++) for (let cy = a[1] - pad; cy <= b[1] + pad; cy++) blockCell([cx, cy])
  }

  // place parts, collect leads; block bodies + all pins
  const partsList: { kind: VintageKind; x: number; y: number; opts?: VintageOpts }[] = []
  const allLeads: Pt[] = []
  function part(kind: VintageKind, gx: number, gy: number, opts?: VintageOpts): Pt[] {
    partsList.push({ kind, x: gx, y: gy, opts })
    const fp = VFOOT[kind]; blockBox(gx, gy, fp.w * P, fp.h * P, 1)
    const leads = leadsAt(kind, gx, gy)
    for (const l of leads) { allLeads.push(l); const c = toC(l); blockCell(c) }
    return leads
  }
  const L = (kind: VintageKind, leads: Pt[], name: string): Pt => leads[Math.max(0, pin(kind, name))]

  const via = (p: Pt) => { topG.circle(p.x, p.y, 4.5).fill({ color: COP }); topG.circle(p.x, p.y, 2).fill({ color: 0x0c2418 }) }
  const thermal = (p: Pt) => { // GND pad into the pour: ring + 4 spokes
    topG.circle(p.x, p.y, 5).stroke({ color: COP, width: 1.5 })
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) topG.moveTo(p.x, p.y).lineTo(p.x + dx * 5, p.y + dy * 5).stroke({ color: COP, width: 2 })
  }
  const teardrop = (p: Pt) => topG.circle(p.x, p.y, 3).fill({ color: COP })
  // merge collinear px points
  function simplify(pts: Pt[]): Pt[] {
    if (pts.length < 3) return pts
    const out = [pts[0]]
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1], b = pts[i], c = pts[i + 1]
      if (Math.sign(b.x - a.x) !== Math.sign(c.x - b.x) || Math.sign(b.y - a.y) !== Math.sign(c.y - b.y)) out.push(b)
    }
    out.push(pts[pts.length - 1]); return out
  }
  // route a signal net A→B around obstacles; mark the path blocked so later nets can't overlap
  function net(a: Pt, b: Pt): void {
    const ca = toC(a), cb = toC(b)
    unblockRing(ca); unblockRing(cb)
    const path = routeOctilinear({ cols: gcols, rows: grows, start: ca, goal: cb, blocked, turnPenalty: 2 })
    if (!path) { // last resort: direct + via marking a layer cross
      copperG.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: COP, width: 2.5, cap: 'round' }); via({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      ;[ca, cb].forEach(blockCell); teardrop(a); teardrop(b); return
    }
    for (const c of path) blockCell(c)
    const px = simplify([a, ...path.map(toP), b])
    copperG.moveTo(px[0].x, px[0].y); for (let i = 1; i < px.length; i++) copperG.lineTo(px[i].x, px[i].y)
    copperG.stroke({ color: COP, width: 2.5, cap: 'round', join: 'round' })
    teardrop(a); teardrop(b)
  }
  const cap = (t: string, x: number, yy: number) => text(t, x, yy, PALETTE.textDim, 11)

  // VCC rail (top) — drawn, and its row blocked so signals don't run along it; taps reach up to it
  copperG.rect(BX + 16, VCC - 2.5, BW - 32, 5).fill({ color: COP })
  for (let cx = 0; cx < gcols; cx++) blockCell([cx, Math.round((VCC - BY) / CELL)])
  cap('VCC rail (top) · GND = ground pour (thermal vias)', BX + 20, VCC + 8)
  const tapVcc = (p: Pt) => { net(p, { x: p.x, y: VCC }); via({ x: p.x, y: VCC }) }
  const tapGnd = (p: Pt) => thermal(p) // straight into the pour — no crossing wire

  // place all parts first (so every pin is a known obstacle before routing)
  const jack = part('powerJack', BX + 60, VCC + 70), d = part('diodeAxial', BX + 170, VCC + 110)
  const el = part('electroRadial', BX + 330, VCC + 70), reg = part('to220', BX + 470, VCC + 70)
  const ic = part('dipIC', BX + 600, BY + BH / 2 + 20), dec = part('ceramicDisc', BX + 700, BY + BH / 2 - 40)
  const xtal = part('crystalHC49', BX + 770, BY + BH / 2 - 60), lc1 = part('ceramicDisc', BX + 760, BY + BH / 2 + 120), lc2 = part('ceramicDisc', BX + 850, BY + BH / 2 + 120)
  const r = part('resAxial', BX + 980, VCC + 80), led = part('led5mm', BX + 1110, VCC + 74, { on: true })
  const rb = part('resAxial', BX + 950, BY + BH - 120), q = part('to92', BX + 1090, BY + BH - 150), cc = part('filmCap', BX + 1140, BY + BH - 70)

  // nets (correct pins; GND→pour, VCC→rail, signals A* routed)
  net(L('powerJack', jack, 'tip+'), L('diodeAxial', d, 'anode'))
  net(L('diodeAxial', d, 'cathode'), L('electroRadial', el, '+'))
  net(L('electroRadial', el, '+'), L('to220', reg, 'IN'))
  tapVcc(L('to220', reg, 'OUT')); tapGnd(L('to220', reg, 'GND')); tapGnd(L('electroRadial', el, '-'))
  cap('A · jack → diode → cap+ → 7805 IN; OUT→VCC, GND→pour', BX + 50, VCC + 50)

  const oscPins = vintagePins('dipIC').map((p, idx) => (p === 'OSC' ? idx : -1)).filter((i) => i >= 0)
  tapVcc(L('dipIC', ic, 'VCC')); tapGnd(L('dipIC', ic, 'GND'))
  net(dec[0], L('dipIC', ic, 'VCC')); tapGnd(dec[1])
  net(xtal[0], ic[oscPins[0]]); net(xtal[1], ic[oscPins[1]]); net(lc1[0], ic[oscPins[0]]); tapGnd(lc1[1]); net(lc2[0], ic[oscPins[1]]); tapGnd(lc2[1])
  cap('B · IC + decap + crystal on OSC pins', BX + 600, BY + BH / 2 - 80)

  tapVcc(L('resAxial', r, 'A')); net(L('resAxial', r, 'B'), L('led5mm', led, 'anode')); tapGnd(L('led5mm', led, 'cathode'))
  cap('C · LED: VCC→R→anode, cathode→pour', BX + 970, VCC + 56)

  net(L('resAxial', rb, 'B'), L('to92', q, 'B')); tapVcc(L('to92', q, 'C')); tapGnd(L('to92', q, 'E')); net(L('to92', q, 'C'), cc[0]); tapGnd(cc[1])
  cap('D · R→base, C→VCC, E→pour, coupling cap', BX + 910, BY + BH - 150)

  for (const pt of partsList) partsHolder.addChild(drawShapes(buildVintageShapes(pt.kind, P, pt.opts), pt.x, pt.y))
}
boot()
