// src/main.ts
import './ui/styles.css'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { Camera } from './render/Camera'
import { Editor } from './editor/Editor'
import { generateLevel } from './pipeline/generator'
import { fitPitch } from './app/viewport'
import { mountToolbar, levelToBlobUrl, readLevelFile } from './ui/Toolbar'
import { mountPanels, updateLevelName } from './ui/Panels'
import { Game } from './game/Game'
import { GameLayers } from './render/GameLayers'
import type { Board } from './model/level'

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const renderer = new Renderer(app)
  const camera = new Camera()

  const view = () => ({ w: window.innerWidth, h: window.innerHeight })
  let board: Board = { cols: 64, rows: 48, pitch: fitPitch(64, 48, view().w, view().h) }
  const editor = new Editor(app, renderer, camera, board, 1)
  mountPanels(null)

  const emptyLevel = (): import('./model/level').Level => ({
    version: 1, board, seed: editor.state.seed, trace: { waypoints: [], cornerRadius: 0.5 },
    spots: [], specialSpots: [], decor: [], meta: { name: 'Untitled', difficulty: 1 },
  })

  const applyBoard = (cols: number, rows: number) => {
    board = { cols, rows, pitch: fitPitch(cols, rows, view().w, view().h) }
    editor.state.board = board
    if (editor.state.level) { editor.state.level.board = board; editor.state.recompute(); editor.redraw() }
    else renderer.render(emptyLevel())
  }

  let seedCounter = 1
  mountToolbar({
    onNew: () => { editor.state.clear(); renderer.render(emptyLevel()); updateLevelName('Untitled') },
    onGenerate: () => { editor.state.loadLevel(generateLevel({ board, difficulty: 5, seed: ++seedCounter })); editor.redraw(); updateLevelName(editor.state.level?.meta.name ?? 'LEVEL --') },
    onReseed: () => { editor.state.reseed(++seedCounter); editor.redraw() },
    onSave: () => { if (!editor.state.level) return; const a = document.createElement('a'); a.href = levelToBlobUrl(editor.state.level); a.download = 'level.json'; a.click() },
    onLoad: async (file) => {
      try {
        const lvl = await readLevelFile(file)
        editor.state.loadLevel(lvl)
        const b = editor.state.board
        board = { cols: b.cols, rows: b.rows, pitch: fitPitch(b.cols, b.rows, view().w, view().h) }
        editor.state.board = board
        if (editor.state.level) editor.state.level.board = board
        editor.redraw()
        updateLevelName(editor.state.level?.meta.name ?? 'LEVEL --')
      } catch (err) {
        console.error(err); alert('Не удалось загрузить уровень: неверный файл')
      }
    },
    onResize: applyBoard,
  })

  // --- TEMP mini-demo (replaced by full play-mode wiring in G1 Task 12) ---
  // Press "p" to play the current level: spawns a wave; enemies flow along the path.
  const gameLayers = new GameLayers(renderer.layers.game)
  let demo: Game | null = null
  window.addEventListener('keydown', (e) => {
    if (e.key === 'p' && editor.state.level) {
      demo = new Game(editor.state.level, ++seedCounter)
      demo.startWave()
    }
  })
  app.ticker.add((t) => {
    if (!demo) return
    demo.tick(t.deltaMS / 1000)
    gameLayers.draw(demo, null)
    camera.apply(renderer.world)
  })
}
boot()
