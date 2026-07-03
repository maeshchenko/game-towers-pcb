// src/app/PixiApp.ts
import { Application } from 'pixi.js'

export async function createPixiApp(opts: { width: number; height: number; background: number }): Promise<Application> {
  const app = new Application()
  await app.init({
    width: opts.width,
    height: opts.height,
    background: opts.background,
    antialias: true,
    // Render at native pixel density (capped at 2 — DPR 3 phones pay too much for bloom),
    // autoDensity keeps the canvas CSS size in logical pixels so all input math stays intact.
    resolution: Math.min(globalThis.devicePixelRatio ?? 1, 2),
    autoDensity: true,
  })
  return app
}
