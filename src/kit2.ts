// /kit2 — vintage through-hole component gallery. Iterate on vintageDecor render quality here.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { ShapeSpec } from './render/decorBuilder'
import { buildVintageShapes, vintageLeadEnds, VFOOT, type VintageKind } from './render/vintageDecor'
import { makeRng } from './pipeline/rng'

const PITCH = 22
const TILE = 180
const COLS = 6

function drawShapes(shapes: ShapeSpec[], ox = 0, oy = 0): Container {
  const c = new Container()
  const g = new Graphics()
  const texts: ShapeSpec[] = []
  for (const s of shapes) {
    if (s.type === 'rect') g.rect(s.x + ox, s.y + oy, s.w, s.h).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'roundRect') g.roundRect(s.x + ox, s.y + oy, s.w, s.h, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'circle') g.circle(s.x + ox, s.y + oy, s.r).fill({ color: s.color, alpha: s.alpha })
    else if (s.type === 'line') g.moveTo(s.x1 + ox, s.y1 + oy).lineTo(s.x2 + ox, s.y2 + oy).stroke({ color: s.color, width: s.width, alpha: s.alpha })
    else texts.push(s)
  }
  c.addChild(g)
  for (const s of texts) if (s.type === 'text') {
    const t = new Text({ text: s.text, style: { fontFamily: 'monospace', fontSize: s.size, fill: s.color } })
    t.position.set(s.x + ox, s.y + oy); c.addChild(t)
  }
  return c
}

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const world = new Container()
  app.stage.addChild(world)
  let scrollY = 0
  window.addEventListener('wheel', (e) => { scrollY = Math.min(0, scrollY - e.deltaY); world.y = scrollY })

  world.addChild(new Text({ text: 'VINTAGE THROUGH-HOLE SET  (/kit2)', x: 16, y: 14, style: { fontFamily: 'monospace', fontSize: 18, fill: 0x9bffc8, fontWeight: 'bold' } }))

  const kinds: [VintageKind, string][] = [
    ['resAxial', 'resistor (axial)'], ['diodeAxial', 'diode (axial)'], ['inductorAxial', 'inductor'],
    ['ceramicDisc', 'ceramic disc'], ['filmCap', 'film cap'], ['electroRadial', 'electrolytic'],
    ['tantalum', 'tantalum'], ['led5mm', 'LED 5mm'], ['trimpot', 'trimpot'],
    ['to92', 'TO-92'], ['to220', 'TO-220'], ['crystalHC49', 'crystal HC-49'], ['dipIC', 'DIP IC'],
  ]
  let y0 = 48
  kinds.forEach(([kind, name], i) => {
    const col = i % COLS, rowi = Math.floor(i / COLS)
    const x = 16 + col * TILE, y = y0 + rowi * TILE
    const cell = new Graphics()
    cell.rect(x, y, TILE - 8, TILE - 8).fill({ color: 0x0d1f17, alpha: 0.7 }).stroke({ color: 0x1c3a2b, width: 1 })
    world.addChild(cell)
    const fp = VFOOT[kind]
    const ox = x + (TILE - 8) / 2 - (fp.w * PITCH) / 2
    const oy = y + (TILE - 8) / 2 - (fp.h * PITCH) / 2
    world.addChild(drawShapes(buildVintageShapes(kind, PITCH), ox, oy))
    world.addChild(new Text({ text: name, x: x + 6, y: y + TILE - 22, style: { fontFamily: 'monospace', fontSize: 11, fill: PALETTE.textDim } }))
  })

  // ── Board fragment: a real PCB section (substrate + ground + routing under the parts) ──────
  const fy = 48 + Math.ceil(kinds.length / COLS) * TILE + 20
  world.addChild(new Text({ text: 'BOARD FRAGMENT — parts mounted ON a board, copper routed under them', x: 16, y: fy, style: { fontFamily: 'monospace', fontSize: 16, fill: 0x9bffc8, fontWeight: 'bold' } }))
  const P = 18
  const BX = 16, BY = fy + 28, BW = 1180, BH = 600
  const VCC = BY + 40, GND = BY + BH - 40   // power/ground rails (y)

  type Pt = { x: number; y: number }
  const COP = PALETTE.copperTrace
  // copper layer (UNDER parts) and parts layer (ON TOP) drawn in order
  const sub = new Graphics(), copperG = new Graphics(), partsHolder = new Container()
  world.addChild(sub, copperG, partsHolder)

  // 1) substrate: ground pour + 45° hatch + faint background routing web
  sub.rect(BX, BY, BW, BH).fill({ color: 0x0a1712, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 })
  for (let d = -BH; d < BW; d += 7) sub.moveTo(BX + d, BY).lineTo(BX + d + BH, BY + BH)
  sub.stroke({ color: PALETTE.hatch, width: 0.5, alpha: 0.18 })
  const rng = makeRng(42)
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]] as const
  for (let i = 0; i < 90; i++) {
    const x0 = BX + rng() * BW, y0 = BY + rng() * BH, [dx, dy] = dirs[Math.floor(rng() * 4)], len = (2 + rng() * 6) * P
    sub.moveTo(x0, y0).lineTo(x0 + dx * len, y0 + dy * len)
  }
  sub.stroke({ color: PALETTE.routing, width: 1.4, alpha: 0.5 })
  for (let i = 0; i < 60; i++) sub.circle(BX + rng() * BW, BY + rng() * BH, 1.6).fill({ color: PALETTE.routing, alpha: 0.6 })

  // helpers
  function leadsOf(kind: VintageKind, gx: number, gy: number): Pt[] {
    return vintageLeadEnds(kind, P).map((l) => ({ x: gx + l.x, y: gy + l.y }))
  }
  const parts: { kind: VintageKind; x: number; y: number }[] = []
  function part(kind: VintageKind, gx: number, gy: number): Pt[] { parts.push({ kind, x: gx, y: gy }); return leadsOf(kind, gx, gy) }
  function via(p: Pt): void { copperG.circle(p.x, p.y, 4).fill({ color: COP }); copperG.circle(p.x, p.y, 1.8).fill({ color: 0x0a1712 }) }
  // route through waypoints (orthogonal/45°), via at each bend
  function route(pts: Pt[], w = 3): void {
    copperG.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) copperG.lineTo(pts[i].x, pts[i].y)
    copperG.stroke({ color: COP, width: w, cap: 'round', join: 'round' })
    for (let i = 1; i < pts.length - 1; i++) via(pts[i])
  }
  const elbow = (a: Pt, b: Pt, atY: number): Pt[] => [a, { x: a.x, y: atY }, { x: b.x, y: atY }, b]
  function caption(text: string, x: number, y: number): void {
    world.addChild(new Text({ text, x, y, style: { fontFamily: 'monospace', fontSize: 11, fill: PALETTE.textDim } }))
  }

  // 2) power + ground rails spanning the board
  route([{ x: BX + 20, y: VCC }, { x: BX + BW - 20, y: VCC }], 5)
  route([{ x: BX + 20, y: GND }, { x: BX + BW - 20, y: GND }], 5)
  caption('VCC rail', BX + 24, VCC - 16); caption('GND rail', BX + 24, GND + 8)
  const tapVcc = (p: Pt) => { route([{ x: p.x, y: VCC }, p]); via({ x: p.x, y: VCC }) }
  const tapGnd = (p: Pt) => { route([p, { x: p.x, y: GND }]); via({ x: p.x, y: GND }) }

  // 3) functional blocks — parts tap the rails + wire to each other (copper UNDER, parts ON TOP)
  // A — power input: connector → diode → electrolytic → TO-220 regulator → feeds VCC
  {
    const j = part('crystalHC49', BX + 40, VCC + 50) // (stand-in connector body)
    const d = part('diodeAxial', BX + 130, VCC + 70)
    const el = part('electroRadial', BX + 300, VCC + 40)
    const reg = part('to220', BX + 440, VCC + 40)
    route(elbow(j[1], d[0], VCC + 64)); route([d[1], el[0]]); route([el[1], reg[0]])
    tapVcc(reg[2]); tapGnd(el[1])
    caption('A · power in → diode → smoothing electrolytic → 7805 → VCC', BX + 30, VCC + 30)
  }
  // B — decoupled DIP IC: VCC/GND + a ceramic decap right across its power pins
  {
    const ic = part('dipIC', BX + 600, BY + BH / 2 - 20)
    const dec = part('ceramicDisc', BX + 700, BY + BH / 2 - 70)
    tapVcc(ic[2]); tapGnd(ic[5])
    route([dec[0], ic[2]]); route([dec[1], ic[3]])
    caption('B · IC + decoupling cap across its VCC/GND pins (kills switching noise)', BX + 560, BY + BH / 2 - 100)
  }
  // C — crystal clock on the IC + 2 load caps to GND
  {
    const ic2 = part('dipIC', BX + 600, BY + BH / 2 - 20)
    const xtal = part('crystalHC49', BX + 760, BY + BH / 2 - 90)
    const lc1 = part('ceramicDisc', BX + 740, BY + BH / 2 + 60)
    const lc2 = part('ceramicDisc', BX + 820, BY + BH / 2 + 60)
    route([xtal[0], ic2[8]]); route([xtal[1], ic2[10]])
    route([lc1[0], ic2[8]]); tapGnd(lc1[1]); route([lc2[0], ic2[10]]); tapGnd(lc2[1])
    caption('C · crystal + 2 load caps on the oscillator pins (clock)', BX + 720, BY + BH / 2 - 120)
  }
  // D — LED indicator off VCC: VCC → R → LED → GND
  {
    const r = part('resAxial', BX + 940, VCC + 50)
    const led = part('led5mm', BX + 1080, VCC + 44)
    tapVcc(r[0]); route(elbow(r[1], led[0], VCC + 64)); tapGnd(led[1])
    caption('D · LED indicator: R limits current, LED to GND', BX + 930, VCC + 30)
  }
  // E — transistor stage: base R from a node, TO-92, collector R to VCC, coupling film cap out
  {
    const rb = part('resAxial', BX + 920, GND - 120)
    const q = part('to92', BX + 1060, GND - 150)
    const cc = part('filmCap', BX + 1110, GND - 60)
    route([rb[1], q[0]]); tapVcc(q[2]); route([q[1], cc[0]]); tapGnd(cc[1])
    caption('E · transistor: base R → TO-92, collector → VCC, coupling cap out', BX + 900, GND - 150)
  }
  // F — RC filter to GND
  {
    const rf = part('resAxial', BX + 120, GND - 90)
    const cf = part('filmCap', BX + 290, GND - 110)
    route([rf[1], cf[0]]); tapGnd(cf[1]); tapVcc(rf[0])
    caption('F · RC filter (smoothing / time constant)', BX + 110, GND - 120)
  }

  // 4) parts ON TOP of the copper
  for (const pt of parts) partsHolder.addChild(drawShapes(buildVintageShapes(pt.kind, P), pt.x, pt.y))
}
boot()
