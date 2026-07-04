// src/app/PixiApp.ts
import { Application } from 'pixi.js'

/** Coarse mobile check: touch-primary + no fine pointer. Used to trim GPU cost on phones. */
function isMobile(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches
}

export async function createPixiApp(opts: { width: number; height: number; background: number }): Promise<Application> {
  const app = new Application()
  const mobile = isMobile()
  await app.init({
    width: opts.width,
    height: opts.height,
    background: opts.background,
    // Antialias costs a full-screen resolve every frame; on phones (already DPR-supersampled and
    // fill-rate bound) it's the first thing to drop. Desktop keeps the smooth edges.
    antialias: !mobile,
    // Ask the driver for the discrete GPU on laptops — bloom/CRT filters are fill-heavy.
    powerPreference: 'high-performance',
    // Render at native pixel density (capped at 2 — DPR 3 phones pay too much for bloom; on mobile
    // cap harder at 1.5), autoDensity keeps the canvas CSS size in logical pixels so input math holds.
    resolution: Math.min(globalThis.devicePixelRatio ?? 1, mobile ? 1.5 : 2),
    autoDensity: true,
  })
  // Cap the render loop at 60 — 120/144 Hz displays otherwise burn 2× the battery redrawing a
  // sim that gains nothing above 60 (movement is dt-based, not frame-based).
  app.ticker.maxFPS = 60
  return app
}
