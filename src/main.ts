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
import { mountPanels } from './ui/Panels'
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
    onNew: () => { editor.state.clear(); renderer.render(emptyLevel()) },
    onGenerate: () => { editor.state.loadLevel(generateLevel({ board, difficulty: 5, seed: ++seedCounter })); editor.redraw() },
    onReseed: () => { editor.state.reseed(++seedCounter); editor.redraw() },
    onSave: () => { if (!editor.state.level) return; const a = document.createElement('a'); a.href = levelToBlobUrl(editor.state.level); a.download = 'level.json'; a.click() },
    onLoad: async (file) => { editor.state.loadLevel(await readLevelFile(file)); board = editor.state.board; editor.redraw() },
    onResize: applyBoard,
  })
}
boot()
