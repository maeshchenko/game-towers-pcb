// src/render/GameLayers.ts
import { Container, Graphics } from 'pixi.js'
import type { Game, Fx } from '../game/Game'
import type { Tower } from '../game/Tower'
import type { Enemy } from '../game/Enemy'
import { PALETTE } from '../style/palette'
import { enemyTheme, TOWER_THEME } from './theme'

export function enemyColor(kind: string): number { return enemyTheme(kind).color }

const ENEMY_RADIUS: Record<string, number> = { normal: 8, fast: 6, tank: 12, rogue: 5, brute: 14, healer: 9, boss: 20 }

function poly(g: Graphics, cx: number, cy: number, r: number, sides: number, rot = 0): void {
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
  }
}

// Tower = dark IC chip + gold pin rows + neon icon. Size LINKED to the build-spot bracket via pitch
// (the chip fills the bracket). Build spot bracket half-size = pitch*0.62, so the chip uses ~pitch*0.55.
function drawTower(g: Graphics, t: Tower, pitch: number): void {
  const { x, y } = t.pos
  const th = TOWER_THEME[t.kind], c = th.color
  const s = Math.max(11, pitch * 0.55), ic = s * 0.5, pinW = Math.max(2, s * 0.18)
  g.roundRect(x - s - 3, y - s - 3, (s + 3) * 2, (s + 3) * 2, 4).fill({ color: PALETTE.substrate, alpha: 0.9 }) // small mask: hide the bracket under the chip (don't cover the path)
  g.circle(x, y, s + 5).fill({ color: c, alpha: 0.14 })                          // soft glow
  g.roundRect(x - s + 1, y - s + 2, s * 2, s * 2, 3).fill({ color: 0x000000, alpha: 0.5 }) // shadow
  g.roundRect(x - s, y - s, s * 2, s * 2, 3).fill({ color: 0x16202b })           // navy IC body
  g.roundRect(x - s, y - s, s * 2, s * 0.4, 3).fill({ color: 0xffffff, alpha: 0.06 })
  for (let i = 0; i < 4; i++) {                                                  // gold pin rows (top+bottom)
    const px = x - s + s * 0.4 + i * (s * 0.5)
    g.rect(px, y - s - pinW, pinW, pinW).fill({ color: PALETTE.padGold }); g.rect(px, y + s, pinW, pinW).fill({ color: PALETTE.padGold })
  }
  // neon function icon (sized to the chip)
  if (th.icon === 'rings') { g.circle(x, y, ic).stroke({ color: c, width: 2 }); g.circle(x, y, ic * 0.4).fill({ color: c }) }
  else if (th.icon === 'diamond') { poly(g, x, y, ic, 4, 0); g.fill({ color: c }) }
  else if (th.icon === 'targetRing') { g.circle(x, y, ic).stroke({ color: c, width: 2 }); g.moveTo(x - ic * 1.2, y).lineTo(x + ic * 1.2, y).moveTo(x, y - ic * 1.2).lineTo(x, y + ic * 1.2).stroke({ color: c, width: 1.5 }) }
  else if (th.icon === 'triangle') { poly(g, x, y, ic * 1.15, 3, -Math.PI / 2); g.fill({ color: c }) }
  else { const u = ic / 6; g.moveTo(x - 2 * u, y - 6 * u).lineTo(x + 3 * u, y - u).lineTo(x - u, y).lineTo(x + 2 * u, y + 6 * u).lineTo(x - 4 * u, y - u).lineTo(x, y).closePath().fill({ color: c }) } // bolt
  g.circle(x, y, Math.max(1.5, s * 0.13)).fill({ color: 0xffffff, alpha: 0.9 })  // hot core
  for (let i = 0; i <= t.level; i++) g.rect(x - s + 3 + i * (s * 0.35), y - s - pinW * 2.5, s * 0.22, 2).fill({ color: c }) // level pips
  if (t.special) {                                                              // special-spot boost → cyan octagon badge
    g.circle(x, y, s + 7).fill({ color: PALETTE.specialCyan, alpha: 0.1 })
    poly(g, x, y, s + 6, 8, Math.PI / 8); g.stroke({ color: PALETTE.specialCyan, width: 2, alpha: 0.9 })
  }
}

// Enemies ride ON the path as bright neon tokens (concept Ref-B): soft glow halo + bright glyph
// by themed type + a white-hot core + thin HP bar.
function drawEnemy(g: Graphics, e: Enemy): void {
  const { x, y } = e.pos
  const r = ENEMY_RADIUS[e.kind] ?? 6
  const { color: c, glyph } = enemyTheme(e.kind)
  // two-layer neon glow
  g.circle(x, y, r + 5).fill({ color: c, alpha: 0.16 })
  g.circle(x, y, r + 2).fill({ color: c, alpha: 0.30 })

  if (e.kind === 'healer') {
    const timeCycle = (Date.now() / 1500) % 1.0 // 1.5 second loop
    const rangePx = 75 // 2.5 * 30 pitch
    g.circle(x, y, rangePx * (0.3 + 0.7 * timeCycle))
     .stroke({ color: PALETTE.neonGreen, width: 1.5, alpha: 0.3 * (1 - timeCycle) })
  }
  switch (glyph) {
    case 'circle': g.circle(x, y, r).fill({ color: c }); break
    case 'square': g.roundRect(x - r, y - r, r * 2, r * 2, 1).fill({ color: c }); break
    case 'triangle': poly(g, x, y, r + 1, 3, -Math.PI / 2); g.fill({ color: c }); break
    case 'diamond': poly(g, x, y, r + 1, 4, 0); g.fill({ color: c }); break
    case 'hex': poly(g, x, y, r, 6, 0); g.fill({ color: c }); break
    case 'capsule': // twin-dot burst
      g.circle(x - r * 0.5, y, r * 0.7).fill({ color: c }); g.circle(x + r * 0.5, y, r * 0.7).fill({ color: c }); break
    case 'bossDiamond':
      poly(g, x, y, r, 4, 0); g.fill({ color: c })
      poly(g, x, y, r + 4, 4, 0); g.stroke({ color: c, width: 2, alpha: 0.7 }); break
  }
  // white-hot core highlight
  g.circle(x, y, Math.max(1.5, r * 0.32)).fill({ color: 0xffffff, alpha: 0.85 })
  // HP bar
  const w = r * 2, hpFrac = e.hp / e.maxHp
  g.rect(x - r, y - r - 6, w, 2).fill({ color: 0x000000, alpha: 0.6 })
  g.rect(x - r, y - r - 6, w * hpFrac, 2).fill({ color: hpFrac > 0.4 ? PALETTE.neonGreen : PALETTE.neonRed })
}

function drawFx(g: Graphics, f: Fx): void {
  const a = Math.min(1, f.ttl / 0.14)
  const col = TOWER_THEME[f.kind].color
  const { from, to } = f
  if (f.kind === 'tesla') {
    // jagged lightning between from and to
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1
    const px = -dy / len, py = dx / len, segs = 5
    g.moveTo(from.x, from.y)
    for (let i = 1; i < segs; i++) {
      const t = i / segs, off = (i % 2 ? 1 : -1) * 4
      g.lineTo(from.x + dx * t + px * off, from.y + dy * t + py * off)
    }
    g.lineTo(to.x, to.y).stroke({ color: col, width: 1.5, alpha: a })
  } else {
    g.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ color: col, width: f.kind === 'sniper' ? 1.5 : 2.5, alpha: a })
  }
  g.circle(from.x, from.y, 3).fill({ color: 0xffffff, alpha: a * 0.8 }) // muzzle flash
  if (f.kind === 'mortar') g.circle(to.x, to.y, 7 * a).stroke({ color: col, width: 2, alpha: a }) // splash ring
  else g.circle(to.x, to.y, 2.5).fill({ color: col, alpha: a })          // impact
}

export class GameLayers {
  private root = new Container()
  constructor(parent: Container) { parent.addChild(this.root) }
  clear(): void { for (const c of this.root.removeChildren()) c.destroy() }

  draw(game: Game, selected: Tower | null): void {
    this.clear()
    const g = new Graphics()
    for (const t of game.towers) {
      if (t.stats.aura) g.circle(t.pos.x, t.pos.y, t.stats.range * game.pitch).fill({ color: PALETTE.specialCyan, alpha: 0.06 }).stroke({ color: PALETTE.specialCyan, width: 1, alpha: 0.3 })
      drawTower(g, t, game.pitch)
    }
    if (selected) g.circle(selected.pos.x, selected.pos.y, selected.stats.range * game.pitch).stroke({ color: PALETTE.traceCore, width: 1.5, alpha: 0.5 })
    for (const f of game.fx) drawFx(g, f)
    for (const e of game.enemies()) { if (e.alive) drawEnemy(g, e) }
    this.root.addChild(g)
  }
}
