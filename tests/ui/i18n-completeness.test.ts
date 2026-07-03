// Gate: every dynamically-referenced i18n key must exist in BOTH locales — a missed key
// renders as a raw 'story.l07.brief.3' right inside the most atmospheric screen of the game.
import { describe, it, expect } from 'vitest'
import { hasKey } from '../../src/ui/i18n'
import { CAMPAIGN_STORY } from '../../src/story/campaignStory'
import { CAMPAIGN_LEVELS } from '../../src/game/campaign'
import { TOWER_BRANCHES } from '../../src/game/towerTypes'
import { ENEMY_DEFS } from '../../src/game/enemyTypes'

function expectKey(key: string): void {
  for (const lang of ['ru', 'en'] as const) {
    expect(hasKey(lang, key), `missing [${lang}] ${key}`).toBe(true)
  }
}

describe('i18n completeness', () => {
  it('story keys exist in both locales', () => {
    for (const l of CAMPAIGN_STORY.intro) expectKey(l.key)
    for (const l of CAMPAIGN_STORY.final) expectKey(l.key)
    for (const lvl of CAMPAIGN_STORY.levels) {
      for (const l of lvl.brief) expectKey(l.key)
      if (lvl.debriefKey) expectKey(lvl.debriefKey)
    }
  })

  it('campaign level names exist in both locales', () => {
    for (const def of CAMPAIGN_LEVELS) expectKey(def.nameKey)
  })

  it('tower branch names/descriptions exist in both locales', () => {
    for (const branches of Object.values(TOWER_BRANCHES)) {
      for (const b of branches) {
        expectKey(`branch.${b.id}.name`)
        expectKey(`branch.${b.id}.desc`)
      }
    }
  })

  it('enemy names + intro cards exist in both locales', () => {
    for (const kind of Object.keys(ENEMY_DEFS)) {
      expectKey(`enemy.${kind}`)
      expectKey(`enemy.${kind}.desc`)
      expectKey(`enemy.${kind}.strat`)
    }
  })
})
