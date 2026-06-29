// src/render/GameLayers.ts
import { Container, Graphics } from 'pixi.js'
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import type { Enemy } from '../game/Enemy'
import type { TowerKind } from '../game/towerTypes'
import { PALETTE } from '../style/palette'

const ENEMY_COLORS: Record<string, number> = {
  normal: 0xe0e0e0, fast: 0x6cf2a0, tank: 0xe8c84a, rogue: 0x3fb6d8,
  brute: 0xe8503a, healer: 0xff8ad0, boss: 0xffd24a,
}
export function enemyColor(kind: string): number { return ENEMY_COLORS[kind] ?? 0xffffff }

const ENEMY_RADIUS: Record<string, number> = { normal: 6, fast: 5, tank: 9, rogue: 4, brute: 11, healer: 7, boss: 16 }

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
  const s = 9 // half-size
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

function drawEnemy(g: Graphics, e: Enemy): void {
  const { x, y } = e.pos
  const r = ENEMY_RADIUS[e.kind] ?? 6
  const c = enemyColor(e.kind)
  g.circle(x, y, r + 2).fill({ color: c, alpha: 0.22 }) // glow halo
  switch (e.kind) {
    case 'normal': g.roundRect(x - r, y - r, r * 2, r * 2, 1).fill({ color: c }); break
    case 'fast': poly(g, x, y, r + 1, 3, -Math.PI / 2); g.fill({ color: c }); break // triangle
    case 'rogue': poly(g, x, y, r + 1, 4, 0); g.fill({ color: c }); break // diamond
    case 'tank': poly(g, x, y, r, 6, 0); g.fill({ color: c }); g.stroke({ color: 0x000000, width: 1, alpha: 0.4 }); break // hex
    case 'brute': g.roundRect(x - r, y - r, r * 2, r * 2, 2).fill({ color: c }); g.stroke({ color: 0x000000, width: 1, alpha: 0.4 }); break
    case 'healer': g.circle(x, y, r).fill({ color: c }); g.rect(x - 1, y - r + 2, 2, r * 2 - 4).fill({ color: 0xffffff }); g.rect(x - r + 2, y - 1, r * 2 - 4, 2).fill({ color: 0xffffff }); break // + cross
    case 'boss': poly(g, x, y, r, 8, Math.PI / 8); g.fill({ color: c }); g.circle(x, y, r * 0.5).stroke({ color: 0x000000, width: 1.5, alpha: 0.5 }); break // octagon
    default: g.circle(x, y, r).fill({ color: c })
  }
  // HP bar
  const w = r * 2, hpFrac = e.hp / e.maxHp
  g.rect(x - r, y - r - 5, w, 2).fill({ color: 0x000000, alpha: 0.6 })
  g.rect(x - r, y - r - 5, w * hpFrac, 2).fill({ color: hpFrac > 0.4 ? 0x6cf2a0 : 0xe8503a })
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
    for (const e of game.enemies()) { if (e.alive) drawEnemy(g, e) }
    this.root.addChild(g)
  }
}
