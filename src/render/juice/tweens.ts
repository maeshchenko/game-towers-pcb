// src/render/juice/tweens.ts
import type { Application } from 'pixi.js'
import { gsap } from 'gsap'
import { PixiPlugin } from 'gsap/PixiPlugin'
import * as PIXI from 'pixi.js'

// Wires GSAP's ticker to Pixi's ticker so tweens advance in lockstep with rendering,
// and registers PixiPlugin so tweens can target Pixi display-object props directly.
// Call once, right after the Pixi Application resolves.
export function initGsap(app: Application): void {
  gsap.registerPlugin(PixiPlugin)
  PixiPlugin.registerPIXI(PIXI)
  gsap.ticker.remove(gsap.updateRoot)
  app.ticker.add(() => gsap.updateRoot(performance.now() / 1000))
}

// Shared easing presets for juice tweens.
export const EASE = {
  pop: 'back.out(2)',
  ui: 'power2.out',
  settle: 'elastic.out(1, 0.5)',
} as const

// Shared duration presets (seconds) for juice tweens.
export const DUR = {
  ui: 0.15,
  pop: 0.3,
  settle: 0.4,
} as const
