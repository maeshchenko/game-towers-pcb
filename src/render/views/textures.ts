// src/render/views/textures.ts
// Bake each enemy/projectile kind's visual into a texture once; sprites batch, Graphics don't.
import { Application, Graphics, Texture } from 'pixi.js'
import { enemyTheme, TOWER_THEME } from '../theme'

// NOTE: duplicated from GameLayers.ts (ENEMY_RADIUS / poly) on purpose — GameLayers dies in
// Task 10, at which point this becomes the sole owner instead of a copy.
export const ENEMY_RADIUS: Record<string, number> = { normal: 8, fast: 6, tank: 12, rogue: 5, brute: 14, healer: 9, boss: 20 }

function poly(g: Graphics, cx: number, cy: number, r: number, sides: number, rot = 0): void {
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
  }
}

const cache = new Map<string, Texture>()
export function clearTextureCache(): void { for (const t of cache.values()) t.destroy(true); cache.clear() }

export function bakeEnemyTexture(app: Application, kind: string): Texture {
  const hit = cache.get(kind)
  if (hit) return hit
  const r = ENEMY_RADIUS[kind] ?? 6
  const { color: c, glyph } = enemyTheme(kind)
  const g = new Graphics()
  const cx = r + 6, cy = r + 6 // padding for the glow halo
  g.circle(cx, cy, r + 5).fill({ color: c, alpha: 0.16 })
  g.circle(cx, cy, r + 2).fill({ color: c, alpha: 0.30 })
  // glyph — transplanted 1-to-1 from drawEnemy (GameLayers.ts), x,y → cx,cy.
  // Healer pulse ring and HP bar are NOT baked: pulse is dynamic (Task 8), HP bar is per-frame.
  switch (glyph) {
    case 'circle': g.circle(cx, cy, r).fill({ color: c }); break
    case 'square': g.roundRect(cx - r, cy - r, r * 2, r * 2, 1).fill({ color: c }); break
    case 'triangle': poly(g, cx, cy, r + 1, 3, -Math.PI / 2); g.fill({ color: c }); break
    case 'diamond': poly(g, cx, cy, r + 1, 4, 0); g.fill({ color: c }); break
    case 'hex': poly(g, cx, cy, r, 6, 0); g.fill({ color: c }); break
    case 'capsule': // twin-dot burst
      g.circle(cx - r * 0.5, cy, r * 0.7).fill({ color: c }); g.circle(cx + r * 0.5, cy, r * 0.7).fill({ color: c }); break
    case 'bossDiamond':
      poly(g, cx, cy, r, 4, 0); g.fill({ color: c })
      poly(g, cx, cy, r + 4, 4, 0); g.stroke({ color: c, width: 2, alpha: 0.7 }); break
  }
  // core:
  g.circle(cx, cy, Math.max(1.5, r * 0.32)).fill({ color: 0xffffff, alpha: 0.85 })
  const tex = app.renderer.generateTexture({ target: g, resolution: 2 })
  g.destroy()
  cache.set(kind, tex)
  return tex
}

export type ProjectileTexKind = 'cannon' | 'mortar'
const projectileCache = new Map<ProjectileTexKind, Texture>()
export function clearProjectileTextureCache(): void { for (const t of projectileCache.values()) t.destroy(true); projectileCache.clear() }

/** Bake a projectile sprite once per kind. Drawn at a positive-offset center (cx,cy) so a
 * Sprite with anchor(0.5) lands exactly on the drawn center — same convention as bakeEnemyTexture. */
export function bakeProjectileTexture(app: Application, kind: ProjectileTexKind): Texture {
  const hit = projectileCache.get(kind)
  if (hit) return hit
  const g = new Graphics()
  if (kind === 'mortar') {
    const c = TOWER_THEME.mortar.color, w = 8, h = 4, pad = 2
    const cx = w / 2 + pad, cy = h / 2 + pad
    g.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2).fill({ color: c }) // 8x4 capsule, points along +x
  } else {
    const c = TOWER_THEME.cannon.color, r = 4, pad = 2
    const cx = r + pad, cy = r + pad
    g.circle(cx, cy, r).fill({ color: c })
    g.circle(cx, cy, 1.5).fill({ color: 0xffffff, alpha: 0.9 }) // white core
  }
  const tex = app.renderer.generateTexture({ target: g, resolution: 2 })
  g.destroy()
  projectileCache.set(kind, tex)
  return tex
}
