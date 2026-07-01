// tests/app/pixiApp.test.ts
import { describe, it, expect } from 'vitest'
import { createPixiApp } from '../../src/app/PixiApp'

describe('createPixiApp', () => {
  it('exports a factory function', () => {
    expect(typeof createPixiApp).toBe('function')
  })
})
