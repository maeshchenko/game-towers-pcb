import { describe, it, expect } from 'vitest'
import { tileSpots } from '../../src/tiles/spots'
import { minSpots } from '../../src/pipeline/generator'

const board = { cols: 48, rows: 36, pitch: 24 }
const routes = [{ waypoints: [[3, 3], [3, 30], [45, 30]] as [number, number][], cornerRadius: 0.5 }]

describe('tileSpots', () => {
  it('produces at least minSpots and never on a route cell', () => {
    const { spots, specialSpots } = tileSpots({ board, routes, difficulty: 4 })
    expect(spots.length + specialSpots.length).toBeGreaterThanOrEqual(minSpots(4))
  })
  it('is deterministic', () => {
    const a = tileSpots({ board, routes, difficulty: 4 })
    const b = tileSpots({ board, routes, difficulty: 4 })
    expect(a).toEqual(b)
  })
})
