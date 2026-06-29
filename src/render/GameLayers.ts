// src/render/GameLayers.ts
import { Container, Graphics } from 'pixi.js'
import type { Game, Fx } from '../game/Game'
import type { Tower } from '../game/Tower'
import type { Enemy } from '../game/Enemy'
import type { TowerKind } from '../game/towerTypes'
import { PALETTE } from '../style/palette'
import { enemyTheme } from './theme'

export function enemyColor(kind: string): number { return enemyTheme(kind).color }

const ENEMY_RADIUS: Record<string, number> = { normal: 8, fast: 6, tank: 12, rogue: 5, brute: 14, healer: 9, boss: 20 }

// PCB-styled accent colour per tower kind (body is a dark IC; this is the function marker).
const TOWER_ACCENT: Record<TowerKind, number> = {
  cannon: 0xe8c84a, slow: 0x3fb6d8, sniper: 0xe8503a, mortar: 0xc8843a, tesla: 0xb060e0,
}

function poly(g: Graphics, cx: number, cy: number, r: number, sides: number, rot = 0): void {
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
  }
}

function drawTower(g: Graphics, t: Tower): void {
  const { x, y } = t.pos
  const accent = TOWER_ACCENT[t.kind]
  const s = 12 // half-size
  g.circle(x, y, s + 4).fill({ color: accent, alpha: 0.12 }) // soft glow by kind
  // drop shadow + dark IC body (chip) with corner pads
  g.rect(x - s + 1, y - s + 2, s * 2, s * 2).fill({ color: 0x000000, alpha: 0.45 })
  g.roundRect(x - s, y - s, s * 2, s * 2, 2).fill({ color: PALETTE.icBody })
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
    g.rect(x + dx * s - 2, y + dy * s - 2, 4, 4).fill({ color: PALETTE.padGold, alpha: 0.9 })
  // per-kind function marker on the chip
  if (t.kind === 'cannon') {
    g.circle(x, y, 4).fill({ color: accent }); g.rect(x - 1.5, y - s - 2, 3, 6).fill({ color: accent }) // barrel up
  } else if (t.kind === 'slow') {
    g.circle(x, y, 5).stroke({ color: accent, width: 2 }); g.circle(x, y, 2).fill({ color: accent })
  } else if (t.kind === 'sniper') {
    g.rect(x - 1, y - s - 4, 2, s + 4).fill({ color: accent }); g.circle(x, y, 3).fill({ color: accent }) // long barrel
  } else if (t.kind === 'mortar') {
    g.circle(x, y, 5).fill({ color: accent }); g.circle(x, y, 2.2).fill({ color: PALETTE.icBody }) // muzzle ring
  } else { // tesla
    g.circle(x, y, 5).stroke({ color: accent, width: 1.5 }); g.circle(x, y, 3).stroke({ color: accent, width: 1.5 })
    g.circle(x, y, 1.5).fill({ color: 0xffffff })
  }
  // level pips (top edge): level+1 small accent ticks
  for (let i = 0; i <= t.level; i++) g.rect(x - s + 2 + i * 4, y - s - 3, 2.5, 2).fill({ color: accent })
  // specular
  g.rect(x - s + 1, y - s + 1, s * 0.9, 2).fill({ color: 0xffffff, alpha: 0.12 })
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
  const col = TOWER_ACCENT[f.kind]
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
      drawTower(g, t)
    }
    if (selected) g.circle(selected.pos.x, selected.pos.y, selected.stats.range * game.pitch).stroke({ color: PALETTE.traceCore, width: 1.5, alpha: 0.5 })
    for (const f of game.fx) drawFx(g, f)
    for (const e of game.enemies()) { if (e.alive) drawEnemy(g, e) }
    this.root.addChild(g)
  }
}
