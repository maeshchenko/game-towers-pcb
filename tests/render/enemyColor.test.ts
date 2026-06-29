import { describe, it, expect } from 'vitest'
import { enemyColor } from '../../src/render/GameLayers'

describe('enemyColor', () => {
  it('returns a distinct number per kind', () => {
    const kinds = ['normal','fast','tank','rogue','brute','healer','boss']
    const colors = kinds.map(enemyColor)
    expect(new Set(colors).size).toBe(kinds.length)
    for (const c of colors) expect(typeof c).toBe('number')
  })
  it('falls back for unknown kind', () => { expect(typeof enemyColor('xyz')).toBe('number') })
})
