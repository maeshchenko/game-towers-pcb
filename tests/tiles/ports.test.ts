import { describe, it, expect } from 'vitest'
import { tilePorts, opposite, portDelta, tileCenterCell } from '../../src/tiles/ports'

describe('ports', () => {
  it('canonical straight is N/S, rotates to E/W at 90', () => {
    expect(new Set(tilePorts({ type: 'straight', rot: 0 }))).toEqual(new Set(['N', 'S']))
    expect(new Set(tilePorts({ type: 'straight', rot: 90 }))).toEqual(new Set(['E', 'W']))
  })
  it('corner N/E rotates clockwise', () => {
    expect(new Set(tilePorts({ type: 'corner', rot: 0 }))).toEqual(new Set(['N', 'E']))
    expect(new Set(tilePorts({ type: 'corner', rot: 90 }))).toEqual(new Set(['E', 'S']))
  })
  it('fork has 3 ports, bridge 4, start 1', () => {
    expect(tilePorts({ type: 'fork', rot: 0 })).toHaveLength(3)
    expect(tilePorts({ type: 'bridge', rot: 0 })).toHaveLength(4)
    expect(tilePorts({ type: 'start', rot: 0 })).toEqual(['N'])
    expect(tilePorts({ type: 'empty', rot: 0 })).toEqual([])
  })
  it('opposite + portDelta', () => {
    expect(opposite('N')).toBe('S'); expect(opposite('E')).toBe('W')
    expect(portDelta('N')).toEqual([0, -1]); expect(portDelta('E')).toEqual([1, 0]); expect(portDelta('W')).toEqual([-1, 0])
  })
  it('tileCenterCell maps tile to fine-cell center', () => {
    expect(tileCenterCell(0, 0, 6)).toEqual([3, 3])
    expect(tileCenterCell(2, 1, 6)).toEqual([15, 9])
  })
})
