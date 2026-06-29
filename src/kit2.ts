// /kit2 — vintage through-hole component gallery. Iterate on vintageDecor render quality here.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { ShapeSpec } from './render/decorBuilder'
import { buildVintageShapes, vintageLeadEnds, VFOOT, type VintageKind } from './render/vintageDecor'

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

  // ── Board fragment: connected functional blocks ───────────────────────────
  const fy = 48 + Math.ceil(kinds.length / COLS) * TILE + 20
  world.addChild(new Text({ text: 'BOARD FRAGMENT — connected blocks (what wires to what & why)', x: 16, y: fy, style: { fontFamily: 'monospace', fontSize: 16, fill: 0x9bffc8, fontWeight: 'bold' } }))
  const panel = new Graphics()
  panel.rect(16, fy + 28, 1180, 560).fill({ color: 0x0a1712, alpha: 1 }).stroke({ color: 0x1c3a2b, width: 1 })
  world.addChild(panel)
  const P = 18

  type Pt = { x: number; y: number }
  function place(kind: VintageKind, gx: number, gy: number): Pt[] {
    world.addChild(drawShapes(buildVintageShapes(kind, P), gx, gy))
    return vintageLeadEnds(kind, P).map((l) => ({ x: gx + l.x, y: gy + l.y }))
  }
  function copper(a: Pt, b: Pt): void {
    const g = new Graphics()
    const midY = (a.y + b.y) / 2
    g.moveTo(a.x, a.y).lineTo(a.x, midY).lineTo(b.x, midY).lineTo(b.x, b.y)
      .stroke({ color: PALETTE.copperTrace, width: 3, cap: 'round', join: 'round' })
    g.circle(a.x, a.y, 3).fill({ color: PALETTE.copperTrace })
    g.circle(b.x, b.y, 3).fill({ color: PALETTE.copperTrace })
    world.addChild(g)
  }
  function caption(text: string, x: number, y: number): void {
    world.addChild(new Text({ text, x, y, style: { fontFamily: 'monospace', fontSize: 11, fill: PALETTE.textDim } }))
  }

  const top = fy + 60
  // Block A — LED indicator: rail → R (limit) → LED
  {
    const r = place('resAxial', 60, top)
    const led = place('led5mm', 230, top - 6)
    copper(r[1], led[0])
    caption('A · LED indicator: R limits LED current', 60, top - 30)
  }
  // Block B — linear supply: diode → diode → big electrolytic → TO-220 reg → ceramic decap
  {
    const d1 = place('diodeAxial', 60, top + 150)
    const d2 = place('diodeAxial', 60, top + 210)
    const el = place('electroRadial', 250, top + 120)
    const reg = place('to220', 420, top + 120)
    const cer = place('ceramicDisc', 600, top + 150)
    copper(d1[1], el[0]); copper(d2[1], el[0])
    copper(el[1], reg[0]); copper(reg[2], cer[0])
    caption('B · supply: bridge → smoothing electrolytic → 7805 regulator → ceramic decap', 60, top + 96)
  }
  // Block C — crystal oscillator: DIP IC + crystal + 2 load caps
  {
    const ic = place('dipIC', 760, top + 150)
    const xtal = place('crystalHC49', 770, top + 40)
    const c1 = place('ceramicDisc', 730, top + 290)
    const c2 = place('ceramicDisc', 860, top + 290)
    copper(xtal[0], ic[2]); copper(xtal[1], ic[4])
    copper(c1[0], ic[2]); copper(c2[0], ic[4])
    caption('C · clock: crystal + 2 load caps on the IC oscillator pins', 720, top + 16)
  }
  // Block D — transistor stage: base R + collector R + TO-92 + film cap
  {
    const rb = place('resAxial', 60, top + 330)
    const q = place('to92', 250, top + 300)
    const cc = place('filmCap', 400, top + 320)
    copper(rb[1], q[0]); copper(q[2], cc[0])
    caption('D · transistor stage: base resistor → TO-92 → coupling film cap', 60, top + 300)
  }
}
boot()
