// /kit2 — vintage through-hole component gallery. Iterate on vintageDecor render quality here.
import './ui/styles.css'
import { Container, Graphics, Text } from 'pixi.js'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import type { ShapeSpec } from './render/decorBuilder'
import { buildVintageShapes, VFOOT, type VintageKind } from './render/vintageDecor'

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
}
boot()
