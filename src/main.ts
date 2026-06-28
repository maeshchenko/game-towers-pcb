// src/main.ts
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { generateLevel } from './pipeline/generator'

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const renderer = new Renderer(app)
  renderer.render(generateLevel({ board: { cols: 64, rows: 48, pitch: 24 }, difficulty: 5, seed: 5 }))
}
boot()
