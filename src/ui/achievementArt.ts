// Achievement badge art — code-drawn SVG (the project ships zero image assets).
// A badge is a hex "chip package" frame with corner pins + a per-achievement glyph.
// Earned badges glow in their category color; locked ones render as a dim silhouette.
import type { AchievementCategory } from '../game/achievements'
import { ACHIEVEMENTS } from '../game/achievements'

export const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  progress: '#2bd06a',
  skill: '#f0c43a',
  style: '#36e0e0',
  slayer: '#ff4d4d',
  modes: '#c23bff',
}

/** Inner glyphs, 24×24 viewBox, stroke/fill = currentColor. Composed from primitives so
 * every achievement stays visually distinct without hand-authoring huge path data. */
const G = {
  flag: '<path d="M8 20V4m0 1h8l-2.5 3L16 11H8" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  skull: '<circle cx="12" cy="10" r="5.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="9.4" r="1.2" fill="currentColor"/><circle cx="14" cy="9.4" r="1.2" fill="currentColor"/><path d="M9.5 15.5v3m2.5-3v3m2.5-3v3" stroke="currentColor" stroke-width="1.4"/>',
  halfbar: '<rect x="5" y="10" width="14" height="4" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="5" y="10" width="7" height="4" fill="currentColor"/>',
  trophy: '<path d="M8 5h8v5a4 4 0 0 1-8 0zM8 6H5.5a2.5 2.5 0 0 0 2.6 3M16 6h2.5a2.5 2.5 0 0 1-2.6 3M12 14v3m-3 2h6" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  stars3: '<path d="M7 13l.9 1.8 2 .3-1.4 1.4.3 2L7 17.6l-1.8.9.3-2-1.4-1.4 2-.3zM12 6l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3zM17 13l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="currentColor"/>',
  wrench: '<path d="M14.5 5a4 4 0 0 0-3.8 5.2L5 15.9V19h3.1l5.7-5.7A4 4 0 0 0 19 9.5l-2.6 1.2-2.1-2.1L15.5 6z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  chip: '<rect x="8" y="8" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 8V5m4 3V5m-4 14v-3m4 3v-3M8 10H5m3 4H5m14-4h-3m3 4h-3" stroke="currentColor" stroke-width="1.4"/>',
  shieldCheck: '<path d="M12 4l7 2.4V11c0 4.4-2.9 7.4-7 9-4.1-1.6-7-4.6-7-9V6.4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 11.5l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  shieldStar: '<path d="M12 4l7 2.4V11c0 4.4-2.9 7.4-7 9-4.1-1.6-7-4.6-7-9V6.4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 8.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z" fill="currentColor"/>',
  crown: '<path d="M6 16l-1-8 4 3 3-5 3 5 4-3-1 8zm-1 2h14" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  heartPulse: '<path d="M12 19c-4.5-3.2-7-5.8-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 3.2-2.5 5.8-7 9z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 11h3l1.3-2.5 1.8 4 1.4-2.5h3.5" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  boltCoin: '<circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M13 7.5l-4 5.5h2.6L11 16.5l4-5.5h-2.6z" fill="currentColor"/>',
  ffwd: '<path d="M5 7v10l6-5zm7 0v10l6-5z" fill="currentColor"/>',
  levelOne: '<rect x="7" y="7" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 9.5v5m-1.4-5h1.4" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  bolt: '<path d="M13.5 4L7 13h4l-1 7 6.5-9h-4z" fill="currentColor"/>',
  square1: '<rect x="9" y="9" width="6" height="6" fill="currentColor"/>',
  squares3: '<rect x="5" y="10" width="4" height="4" fill="currentColor"/><rect x="10" y="10" width="4" height="4" fill="currentColor"/><rect x="15" y="10" width="4" height="4" fill="currentColor"/>',
  shapes5: '<rect x="4" y="5" width="4" height="4" fill="currentColor"/><circle cx="16" cy="7" r="2.2" fill="currentColor"/><path d="M6 19l2-4 2 4z" fill="currentColor"/><path d="M16 13l2 2-2 2-2-2z" fill="currentColor"/><rect x="10.5" y="10.5" width="3" height="3" transform="rotate(45 12 12)" fill="none" stroke="currentColor" stroke-width="1.2"/>',
  branch: '<path d="M8 19V9m0 0a3 3 0 1 0-.1-6A3 3 0 0 0 8 9zm0 5c0-3 8-2 8-6m0 0a3 3 0 1 0-.1-6A3 3 0 0 0 16 8z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  recycle: '<path d="M9 7h6l-1.6-2.4M15 7l-3 5m3-5l3 5-2.6.1M6 12l3 5h4m-7-5l2.6-.1M13 17l-1.7 2.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  capacitor: '<path d="M4 12h5m6 0h5M9 6.5v11m6-11v11" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  gridSquares: '<path d="M5 5h4v4H5zm5 0h4v4h-4zm5 0h4v4h-4zM5 10h4v4H5zm5 0h4v4h-4zm5 0h4v4h-4zM5 15h4v4H5zm5 0h4v4h-4z" fill="none" stroke="currentColor" stroke-width="1.1"/>',
  tallyI: '<path d="M12 6v12" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="4.5" r="1.2" fill="currentColor"/>',
  tallyII: '<path d="M9.5 6v12M14.5 6v12" stroke="currentColor" stroke-width="2"/>',
  tallyIII: '<path d="M7.5 6v12M12 6v12M16.5 6v12" stroke="currentColor" stroke-width="2"/>',
  diamondX: '<path d="M12 4l7 8-7 8-7-8z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.6 9.6l4.8 4.8m0-4.8l-4.8 4.8" stroke="currentColor" stroke-width="1.5"/>',
  crate: '<rect x="6" y="7" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 11h12M12 7v10" stroke="currentColor" stroke-width="1.2"/>',
  laurel: '<circle cx="12" cy="11" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 18c2 1.4 10 1.4 12 0M7.5 15.5L5 18m11.5-2.5L19 18" fill="none" stroke="currentColor" stroke-width="1.3"/>',
  calCheck: '<rect x="5" y="6" width="14" height="13" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 10h14M9 4v4m6-4v4" stroke="currentColor" stroke-width="1.4"/><path d="M9 14.5l2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  cal5: '<rect x="5" y="6" width="14" height="13" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 10h14M9 4v4m6-4v4" stroke="currentColor" stroke-width="1.4"/><path d="M14 12.5h-3.5v2.2h2a1.6 1.6 0 0 1 0 3.2H10" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  inf15: '<path d="M8.2 12a2.3 2.3 0 1 1 3.8 1.8A2.3 2.3 0 1 1 15.8 12a2.3 2.3 0 1 1-3.8-1.8A2.3 2.3 0 1 1 8.2 12z" fill="none" stroke="currentColor" stroke-width="1.4" transform="translate(0,-3)"/><text x="12" y="19.5" text-anchor="middle" font-family="monospace" font-size="7.5" fill="currentColor">15</text>',
  inf25: '<path d="M8.2 12a2.3 2.3 0 1 1 3.8 1.8A2.3 2.3 0 1 1 15.8 12a2.3 2.3 0 1 1-3.8-1.8A2.3 2.3 0 1 1 8.2 12z" fill="none" stroke="currentColor" stroke-width="1.4" transform="translate(0,-3)"/><text x="12" y="19.5" text-anchor="middle" font-family="monospace" font-size="7.5" fill="currentColor">25</text>',
  lock: '<rect x="8" y="11" width="8" height="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 11V9a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  // micro-moments
  lastCell: '<rect x="14" y="8" width="6" height="8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M4 12h9m0 0l-2.5-2.5M13 12l-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  stopwatch: '<circle cx="12" cy="13" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 13V9.5M10 4h4M12 4v3" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  burst: '<path d="M12 4v4m0 8v4m8-8h-4M8 12H4m11.7-5.7l-2.8 2.8m-4.2 4.2l-2.8 2.8m11.6 0l-2.8-2.8m-4.2-4.2L6.3 6.3" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  swapClock: '<path d="M5 9h9l-2.5-2.5M14 15H5l2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17" cy="16" r="3.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M17 14.4V16l1.1 1" stroke="currentColor" stroke-width="1.2"/>',
  snowflake: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" stroke="currentColor" stroke-width="1.4"/><path d="M12 6l2-2m-2 2l-2-2m2 14l2 2m-2-2l-2 2" stroke="currentColor" stroke-width="1.3"/>',
  moneyStack: '<path d="M4 16c3 2 13 2 16 0M4 12c3 2 13 2 16 0" fill="none" stroke="currentColor" stroke-width="1.4"/><ellipse cx="12" cy="8" rx="8" ry="2.6" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  bossArrow: '<path d="M12 4l6 6-6 6-6-6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 19h12" stroke="currentColor" stroke-width="1.6"/><path d="M9.5 10l1.7 1.7 3-3.4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
  crosshair100: '<circle cx="12" cy="10" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 3v3m0 8v3m-9-6h3m12 0h3" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="10" r="1.4" fill="currentColor"/>',
}

const GLYPHS: Record<string, string> = {
  first_win: G.flag,
  boss_down: G.skull,
  campaign_half: G.halfbar,
  campaign_done: G.trophy,
  all_stars: G.stars3,
  workshop_open: G.wrench,
  full_firmware: G.chip,
  flawless: G.shieldCheck,
  untouchable: G.shieldStar,
  perfect_finale: G.crown,
  comeback: G.heartPulse,
  hoarder: G.boltCoin,
  overclocker: G.ffwd,
  no_upgrades: G.levelOne,
  discharge_ace: G.bolt,
  minimalist: G.square1,
  monoculture: G.squares3,
  diversity: G.shapes5,
  branch_master: G.branch,
  recycler: G.recycle,
  capacitor_hero: G.capacitor,
  architect: G.gridSquares,
  kills_100: G.tallyI,
  kills_1000: G.tallyII,
  kills_5000: G.tallyIII,
  boss_slayer: G.diamondX,
  carrier_hunter: G.crate,
  wins_10: G.laurel,
  daily_done: G.calCheck,
  daily_5: G.cal5,
  endless_15: G.inf15,
  endless_25: G.inf25,
  last_stand: G.lastCell,
  instant_call: G.stopwatch,
  chain_reaction: G.burst,
  quick_flip: G.swapClock,
  deep_freeze: G.snowflake,
  capitalist: G.moneyStack,
  interception: G.bossArrow,
  first_blood: G.crosshair100,
}

/** Hex chip-package outline used as the badge frame (48×48 viewBox coordinates). */
const HEX = 'M24 3 L42 13 V35 L24 45 L6 35 V13 Z'

export function achievementBadgeSvg(id: string, earned: boolean, size = 48): string {
  const def = ACHIEVEMENTS.find((a) => a.id === id)
  const color = earned && def ? CATEGORY_COLORS[def.category] : '#3a4f43'
  const glyph = earned ? (GLYPHS[id] ?? G.chip) : G.lock
  const glow = earned ? `<path d="${HEX}" fill="none" stroke="${color}" stroke-width="3" opacity="0.18"/>` : ''
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" role="img" style="color: ${color}">
      ${glow}
      <path d="${HEX}" fill="${earned ? 'rgba(10,22,17,0.9)' : 'rgba(10,22,17,0.6)'}" stroke="${color}" stroke-width="1.6"/>
      <path d="M15 3v-2.2M24 3v-2.2M33 3v-2.2M15 45v2.2M24 45v2.2M33 45v2.2" stroke="${color}" stroke-width="1.4" opacity="0.7"/>
      <g transform="translate(12,12)">${glyph}</g>
    </svg>`
}

/** True when every achievement has a dedicated glyph (test hook). */
export function missingGlyphs(): string[] {
  return ACHIEVEMENTS.filter((a) => !GLYPHS[a.id]).map((a) => a.id)
}
