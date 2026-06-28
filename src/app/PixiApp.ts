// src/app/PixiApp.ts
import { Application } from 'pixi.js'

export async function createPixiApp(opts: { width: number; height: number; background: number }): Promise<Application> {
  const app = new Application()
  await app.init({ width: opts.width, height: opts.height, background: opts.background, antialias: true })
  return app
}
