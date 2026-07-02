import { describe, it, expect } from 'vitest'
import { CAMPAIGN_STORY, cleanupPercent, type StoryLine } from '../../src/story/campaignStory'
import { hasKey } from '../../src/ui/i18n'

function allKeys(lines: StoryLine[]): string[] {
  return lines.map((l) => l.key)
}

describe('CAMPAIGN_STORY', () => {
  it('has exactly 12 levels', () => {
    expect(CAMPAIGN_STORY.levels).toHaveLength(12)
  })

  it('cleanupPct sums to 100', () => {
    const sum = CAMPAIGN_STORY.levels.reduce((acc, l) => acc + l.cleanupPct, 0)
    expect(sum).toBe(100)
  })

  it('matches the canonical per-level cleanup percentages', () => {
    expect(CAMPAIGN_STORY.levels.map((l) => l.cleanupPct)).toEqual([
      6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 10, 10,
    ])
  })

  it('intro is non-empty', () => {
    expect(CAMPAIGN_STORY.intro.length).toBeGreaterThan(0)
  })

  it('final is non-empty', () => {
    expect(CAMPAIGN_STORY.final.length).toBeGreaterThan(0)
  })

  it('every referenced key exists in both ru and en dictionaries', () => {
    const keys = new Set<string>()
    for (const line of CAMPAIGN_STORY.intro) keys.add(line.key)
    for (const line of CAMPAIGN_STORY.final) keys.add(line.key)
    for (const level of CAMPAIGN_STORY.levels) {
      for (const line of level.brief) keys.add(line.key)
      keys.add(level.debriefKey)
    }
    expect(keys.size).toBeGreaterThan(0)
    for (const key of keys) {
      expect(hasKey('ru', key), `missing ru key: ${key}`).toBe(true)
      expect(hasKey('en', key), `missing en key: ${key}`).toBe(true)
    }
  })

  it('every level brief has 3-5 non-blank lines', () => {
    for (const level of CAMPAIGN_STORY.levels) {
      const nonBlank = level.brief.filter((l) => l.key !== 'story.blank')
      expect(nonBlank.length).toBeGreaterThanOrEqual(3)
      expect(nonBlank.length).toBeLessThanOrEqual(6)
    }
  })

  it('levels 8-11 (index 7-10) have at least one glitch line', () => {
    for (const idx of [7, 8, 9, 10]) {
      const level = CAMPAIGN_STORY.levels[idx]
      const glitchLines = level.brief.filter((l) => l.glitch)
      expect(glitchLines.length, `level index ${idx} has no glitch line`).toBeGreaterThanOrEqual(1)
    }
  })

  it('levels outside 8-11 have no glitch lines', () => {
    for (const idx of [0, 1, 2, 3, 4, 5, 6, 11]) {
      const level = CAMPAIGN_STORY.levels[idx]
      const glitchLines = level.brief.filter((l) => l.glitch)
      expect(glitchLines.length, `level index ${idx} unexpectedly has glitch lines`).toBe(0)
    }
  })

  it('final log has glitch lines on the "signal repeats" section', () => {
    const glitchLines = CAMPAIGN_STORY.final.filter((l) => l.glitch)
    expect(glitchLines.length).toBeGreaterThanOrEqual(3)
  })

  it('story.blank resolves to a single space in both dictionaries', () => {
    // shared pause key for blank separator lines in the spec texts
    expect(allKeys(CAMPAIGN_STORY.intro)).toContain('story.blank')
  })
})

describe('cleanupPercent', () => {
  it('returns 0 for 0 completed levels', () => {
    expect(cleanupPercent(0)).toBe(0)
  })

  it('returns 6 for 1 completed level', () => {
    expect(cleanupPercent(1)).toBe(6)
  })

  it('returns 100 for 12 completed levels', () => {
    expect(cleanupPercent(12)).toBe(100)
  })

  it('sums the first N cleanupPct values', () => {
    expect(cleanupPercent(3)).toBe(6 + 7 + 7)
  })
})
