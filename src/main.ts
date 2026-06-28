// src/main.ts
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
}
boot()
