// Inline SVG icons in the neon-terminal style. Emoji glyphs (⏸ 📖 ⚙️ 👾) render as colored
// system sprites — different on every OS and jarring inside the monochrome HUD. All icons
// use currentColor so they follow the button's text color on hover/active.

function svg(inner: string, size: number, viewBox = '0 0 16 16'): string {
  return `<svg width="${size}" height="${size}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:-2px">${inner}</svg>`
}

export type IconName = 'pause' | 'book' | 'gear' | 'bolt'

export function icon(name: IconName, size = 13): string {
  switch (name) {
    case 'pause':
      return svg('<rect x="3.5" y="2.5" width="3.2" height="11" fill="currentColor"/><rect x="9.3" y="2.5" width="3.2" height="11" fill="currentColor"/>', size)
    case 'book':
      return svg('<path d="M2.5 3h4.2c.7 0 1.3.5 1.3 1.2V13c0-.6-.6-1-1.3-1H2.5V3z" stroke="currentColor" stroke-width="1.2"/><path d="M13.5 3H9.3C8.6 3 8 3.5 8 4.2V13c0-.6.6-1 1.3-1h4.2V3z" stroke="currentColor" stroke-width="1.2"/>', size)
    case 'gear':
      return svg('<circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.8v2.1M8 12.1v2.1M1.8 8h2.1M12.1 8h2.1M3.6 3.6l1.5 1.5M10.9 10.9l1.5 1.5M12.4 3.6l-1.5 1.5M5.1 10.9l-1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>', size)
    case 'bolt':
      return svg('<path d="M9.2 1.5 3.8 9h3.4l-1 5.5L11.8 7H8.4l.8-5.5z" fill="currentColor"/>', size)
  }
}

/** Enemy portrait for intro cards/bestiary: the REAL glyph shape + color from the display
 * theme, instead of one 👾 for every kind. */
export function enemyGlyphSvg(glyph: string, colorHex: string, size = 44): string {
  const c = colorHex
  const shape = (() => {
    switch (glyph) {
      case 'square': return `<rect x="7" y="7" width="18" height="18" rx="3" fill="${c}"/>`
      case 'capsule': return `<rect x="6" y="10" width="20" height="12" rx="6" fill="${c}"/>`
      case 'diamond': return `<path d="M16 4 28 16 16 28 4 16Z" fill="${c}"/>`
      case 'hex': return `<path d="M16 4l10 6v12l-10 6-10-6V10z" fill="${c}"/>`
      case 'triangle': return `<path d="M16 5 28 27H4Z" fill="${c}"/>`
      case 'bossDiamond': return `<path d="M16 2 30 16 16 30 2 16Z" fill="${c}"/><path d="M16 8 24 16 16 24 8 16Z" fill="#0a1611"/>`
      default: return `<circle cx="16" cy="16" r="11" fill="${c}"/>`
    }
  })()
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 0 6px ${c})">${shape}<circle cx="16" cy="16" r="3" fill="rgba(10,22,17,0.85)"/></svg>`
}
