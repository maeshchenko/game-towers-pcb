import { describe, it, expect } from 'vitest'
import { EditorState } from '../../src/editor/EditorState'
import { isOctilinear } from '../../src/geom/octilinear'

const board = { cols: 40, rows: 30, pitch: 24 }

describe('EditorState', () => {
  it('octilinearizes the draft as points are added', () => {
    const s = new EditorState(board, 1)
    s.addPoint([0, 0]); s.addPoint([5, 2])
    for (let i = 1; i < s.draftPoints.length; i++)
      expect(isOctilinear(s.draftPoints[i - 1], s.draftPoints[i])).toBe(true)
  })
  it('commitTrace builds a level with spots and decor', () => {
    const s = new EditorState(board, 1)
    s.addPoint([2, 2]); s.addPoint([2, 20]); s.addPoint([25, 20])
    s.commitTrace()
    expect(s.level).not.toBeNull()
    expect(s.level!.trace.waypoints.length).toBeGreaterThanOrEqual(3)
    expect(s.level!.spots.length + s.level!.specialSpots.length).toBeGreaterThan(0)
    expect(s.level!.decor.length).toBeGreaterThan(0)
  })
  it('reseed changes decor deterministically', () => {
    const s = new EditorState(board, 1)
    s.addPoint([2, 2]); s.addPoint([2, 20]); s.addPoint([25, 20]); s.commitTrace()
    const before = JSON.stringify(s.level!.decor)
    s.reseed(2)
    const after = JSON.stringify(s.level!.decor)
    expect(after).not.toEqual(before)
  })
})
