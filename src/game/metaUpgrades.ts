// Meta-progression: campaign stars buy permanent station upgrades ("Мастерская станции").
// Pure data + math — persistence lives in campaign.ts (PlayerProgress.metaUpgrades),
// application lives in Game (opts.meta). The reference bot calibrates WITHOUT meta, so
// levels stay winnable on a zero-upgrade save (Kingdom Rush model: meta is player slack,
// not a balance requirement).
//
// Star economy: 12 levels × 3★ = 36★ max; a full tree costs 33★ — near-full-clear players
// max out, everyone else picks a build. Respec is free (stars are a testament, not a trap).

export type MetaUpgradeId = 'reserve' | 'armor' | 'recycler' | 'capacitor' | 'firmware'

export interface MetaTier {
  /** Stars to buy this tier. */
  cost: number
  /** Tier effect value; semantics depend on the track (see effect builders below). */
  value: number
}

export interface MetaUpgradeDef {
  id: MetaUpgradeId
  /** i18n prefix: meta.<id>.name / meta.<id>.desc */
  tiers: MetaTier[]
}

export const META_UPGRADES: Record<MetaUpgradeId, MetaUpgradeDef> = {
  // Extra starting energy — earlier second tower, smoother openings.
  reserve: { id: 'reserve', tiers: [{ cost: 1, value: 20 }, { cost: 2, value: 45 }, { cost: 3, value: 80 }] },
  // Extra core lives — forgiveness for leaks.
  armor: { id: 'armor', tiers: [{ cost: 1, value: 2 }, { cost: 2, value: 4 }, { cost: 3, value: 6 }] },
  // Better sell refund (base 60%).
  recycler: { id: 'recycler', tiers: [{ cost: 1, value: 0.68 }, { cost: 2, value: 0.75 }, { cost: 3, value: 0.85 }] },
  // Shorter discharge cooldown (base 45 s).
  capacitor: { id: 'capacitor', tiers: [{ cost: 1, value: 6 }, { cost: 2, value: 12 }, { cost: 3, value: 20 }] },
  // Global tower damage.
  firmware: { id: 'firmware', tiers: [{ cost: 2, value: 0.04 }, { cost: 3, value: 0.08 }, { cost: 4, value: 0.12 }] },
}

export const META_UPGRADE_IDS = Object.keys(META_UPGRADES) as MetaUpgradeId[]

/** Purchased tier count per track (0 = not bought). Sparse: absent key = 0. */
export type MetaLevels = Partial<Record<MetaUpgradeId, number>>

/** Aggregate effects a Game applies. All-zero/identity for an empty tree. */
export interface MetaEffects {
  startGold: number
  lives: number
  /** Sell refund fraction (base 0.6 without meta). */
  sellRefund: number
  /** Seconds shaved off the discharge cooldown. */
  dischargeCdReduction: number
  /** Global tower damage multiplier (1 = unchanged). */
  damageMul: number
}

export const NO_META: MetaEffects = { startGold: 0, lives: 0, sellRefund: 0.6, dischargeCdReduction: 0, damageMul: 1 }

function tierValue(id: MetaUpgradeId, levels: MetaLevels): number | null {
  const lvl = clampLevel(id, levels[id] ?? 0)
  return lvl > 0 ? META_UPGRADES[id].tiers[lvl - 1].value : null
}

function clampLevel(id: MetaUpgradeId, lvl: number): number {
  return Number.isInteger(lvl) ? Math.max(0, Math.min(META_UPGRADES[id].tiers.length, lvl)) : 0
}

export function metaEffects(levels: MetaLevels | undefined): MetaEffects {
  if (!levels) return NO_META
  return {
    startGold: tierValue('reserve', levels) ?? 0,
    lives: tierValue('armor', levels) ?? 0,
    sellRefund: tierValue('recycler', levels) ?? 0.6,
    dischargeCdReduction: tierValue('capacitor', levels) ?? 0,
    damageMul: 1 + (tierValue('firmware', levels) ?? 0),
  }
}

/** Stars sunk into the tree (cumulative tier costs). */
export function starsSpent(levels: MetaLevels | undefined): number {
  if (!levels) return 0
  let spent = 0
  for (const id of META_UPGRADE_IDS) {
    const lvl = clampLevel(id, levels[id] ?? 0)
    for (let i = 0; i < lvl; i++) spent += META_UPGRADES[id].tiers[i].cost
  }
  return spent
}

/** Total stars earned across the campaign (the meta currency). */
export function starsEarned(stars: Record<number, number>): number {
  return Object.values(stars).reduce((s, n) => s + (Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0), 0)
}

/** Cost of the NEXT tier of a track, or null when maxed. */
export function nextTierCost(id: MetaUpgradeId, levels: MetaLevels | undefined): number | null {
  const lvl = clampLevel(id, levels?.[id] ?? 0)
  return lvl < META_UPGRADES[id].tiers.length ? META_UPGRADES[id].tiers[lvl].cost : null
}

/** Pure purchase step: returns the new levels, or null when maxed/unaffordable. */
export function buyTier(id: MetaUpgradeId, levels: MetaLevels | undefined, starsAvailable: number): MetaLevels | null {
  const cost = nextTierCost(id, levels)
  if (cost === null || cost > starsAvailable) return null
  return { ...levels, [id]: clampLevel(id, levels?.[id] ?? 0) + 1 }
}
