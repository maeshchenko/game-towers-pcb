// src/render/GameLayers.ts
import { Container, Graphics } from 'pixi.js'
import type { Game } from '../game/Game'
import type { Tower } from '../game/Tower'
import { PALETTE } from '../style/palette'

const ENEMY_COLORS: Record<string, number> = {
  normal: 0xe0e0e0, fast: 0x6cf2a0, tank: 0xe8c84a, rogue: 0x3fb6d8,
  brute: 0xe8503a, healer: 0xff8ad0, boss: 0xffd24a,
}
export function enemyColor(kind: string): number { return ENEMY_COLORS[kind] ?? 0xffffff }

const ENEMY_RADIUS: Record<string, number> = { normal: 6, fast: 5, tank: 9, rogue: 4, brute: 11, healer: 7, boss: 16 }

export class GameLayers {
  private root = new Container()
  constructor(parent: Container) { parent.addChild(this.root) }
  clear(): void { for (const c of this.root.removeChildren()) c.destroy() }

  draw(game: Game, selected: Tower | null): void {
    this.clear()
    const g = new Graphics()
    // towers
    for (const t of game.towers) {
      g.rect(t.pos.x - 8, t.pos.y - 8, 16, 16).fill({ color: PALETTE.buildGold, alpha: 0.9 })
      g.circle(t.pos.x, t.pos.y, 4).fill({ color: PALETTE.substrate })
      if (t.stats.aura) g.circle(t.pos.x, t.pos.y, t.stats.range * game.pitch).stroke({ color: PALETTE.specialCyan, width: 1, alpha: 0.3 })
    }
    if (selected) g.circle(selected.pos.x, selected.pos.y, selected.stats.range * game.pitch).stroke({ color: PALETTE.traceCore, width: 1.5, alpha: 0.5 })
    // enemies + hp bars
    for (const e of game.enemies()) {
      if (!e.alive) continue
      const r = ENEMY_RADIUS[e.kind] ?? 6
      g.circle(e.pos.x, e.pos.y, r + 2).fill({ color: enemyColor(e.kind), alpha: 0.25 })
      g.circle(e.pos.x, e.pos.y, r).fill({ color: enemyColor(e.kind), alpha: 1 })
      const w = r * 2, hpFrac = e.hp / e.maxHp
      g.rect(e.pos.x - r, e.pos.y - r - 5, w, 2).fill({ color: 0x000000, alpha: 0.6 })
      g.rect(e.pos.x - r, e.pos.y - r - 5, w * hpFrac, 2).fill({ color: 0x6cf2a0, alpha: 1 })
    }
    this.root.addChild(g)
  }
}
