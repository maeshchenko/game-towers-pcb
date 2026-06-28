// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readLevelFile } from '../../src/ui/Toolbar'
import { serializeLevel, type Level } from '../../src/model/level'

const sample: Level = {
  version: 1, board: { cols: 64, rows: 48, pitch: 24 }, seed: 1,
  trace: { waypoints: [[1, 1], [1, 9]], cornerRadius: 0.5 },
  spots: [], specialSpots: [], decor: [], meta: { name: 'T', difficulty: 1 },
}

describe('level file IO', () => {
  it('readLevelFile parses a serialized level back', async () => {
    const file = new File([serializeLevel(sample)], 'level.json', { type: 'application/json' })
    const parsed = await readLevelFile(file)
    expect(parsed).toEqual(sample)
  })
  it('readLevelFile rejects bad json', async () => {
    const file = new File(['{bad'], 'x.json', { type: 'application/json' })
    await expect(readLevelFile(file)).rejects.toThrow()
  })
})
