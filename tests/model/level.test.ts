import { describe, it, expect } from 'vitest'
import { serializeLevel, parseLevel, type Level } from '../../src/model/level'

const sample: Level = {
  version: 1,
  board: { cols: 64, rows: 48, pitch: 24 },
  seed: 12345,
  trace: { waypoints: [[2, 4], [2, 20], [30, 20]], cornerRadius: 0.5 },
  spots: [{ cell: [9, 8], score: 12, kind: 'build' }],
  specialSpots: [{ cell: [20, 15], score: 0, kind: 'special' }],
  decor: [{ kind: 'soic', variant: 8, cell: [5, 30], rot: 90, scale: 1 }],
  meta: { name: 'Level 05', difficulty: 5 },
}

describe('level serialization', () => {
  it('round-trips losslessly', () => {
    expect(parseLevel(serializeLevel(sample))).toEqual(sample)
  })
  it('rejects wrong version', () => {
    const bad = serializeLevel(sample).replace('"version":1', '"version":2')
    expect(() => parseLevel(bad)).toThrow(/version/i)
  })
  it('rejects malformed json', () => {
    expect(() => parseLevel('{not json')).toThrow()
  })
})
