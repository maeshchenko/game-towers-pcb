// src/main.ts
import './ui/styles.css'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { Camera } from './render/Camera'
import { Editor } from './editor/Editor'
import { fitPitch } from './app/viewport'
import { mountToolbar, levelToBlobUrl, readLevelFile } from './ui/Toolbar'
import { mountPanels, updateLevelName } from './ui/Panels'
import { Game } from './game/Game'
import { generateBalancedLevel } from './game/balance'
import { GameLayers } from './render/GameLayers'
import { GameUI } from './ui/GameUI'
import type { Board } from './model/level'
import type { Tower } from './game/Tower'

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
  let game: Game | null = null
  let selectedTower: Tower | null = null
  const gameLayers = new GameLayers(renderer.layers.game)

  // ui declared early so callbacks in mountToolbar can reference it via closure
  // (definite assignment: all calls happen after ui is fully initialised below)
  let ui!: GameUI

  const infoPanel = () => document.querySelector('.pcb-info') as HTMLElement | null
  function resetPlay() {
    game = null
    selectedTower = null
    gameLayers.clear()
    editor.enabled = true
    const ip = infoPanel(); if (ip) ip.style.display = '' // show static panel back in edit mode
  }

  mountToolbar({
    onNew: () => {
      resetPlay(); ui.showTower(null, 0)
      editor.state.clear(); renderer.render(emptyLevel()); updateLevelName('Untitled')
    },
    onGenerate: () => {
      resetPlay(); ui.showTower(null, 0)
      editor.state.loadLevel(generateBalancedLevel({ board, difficulty: 5, seed: ++seedCounter }))
      editor.redraw(); updateLevelName(editor.state.level?.meta.name ?? 'LEVEL --')
    },
    onReseed: () => { editor.state.reseed(++seedCounter); editor.redraw() },
    onSave: () => {
      if (!editor.state.level) return
      const a = document.createElement('a'); a.href = levelToBlobUrl(editor.state.level); a.download = 'level.json'; a.click()
    },
    onLoad: async (file) => {
      try {
        const lvl = await readLevelFile(file)
        resetPlay(); ui.showTower(null, 0)
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
    onResize: (cols, rows) => { resetPlay(); ui.showTower(null, 0); applyBoard(cols, rows) },
  })

  function ensureGame() {
    if (!game && editor.state.level) {
      game = new Game(editor.state.level, ++seedCounter)
      selectedTower = null
      editor.enabled = false
      const ip = infoPanel(); if (ip) ip.style.display = 'none' // live game-bar HUD replaces the static panel
    }
  }

  ui = new GameUI({
    onBuild: () => {},                       // arming handled inside GameUI; placement on canvas click
    onStartWave: () => { ensureGame(); game!.startWave() },
    onTogglePlay: () => { game && (game.speed = game.speed === 0 ? 1 : 0) },
    onSpeed: (m) => { if (game) game.speed = m },
    onUpgrade: () => { if (game && selectedTower) { game.upgrade(selectedTower); ui.showTower(selectedTower, game.sellValue(selectedTower)) } },
    onSell: () => { if (game && selectedTower) { game.sell(selectedTower); selectedTower = null; ui.showTower(null, 0) } },
    onTargetMode: () => { if (selectedTower) { selectedTower.cycleTargetMode(); ui.showTower(selectedTower, game!.sellValue(selectedTower)) } },
  })
  ui.mountHud()

  // build/select on canvas click during play
  app.canvas.addEventListener('pointerdown', (e) => {
    ensureGame() // first board interaction on a level enters play (build phase) so towers can be placed pre-wave
    if (!game) return
    const r = app.canvas.getBoundingClientRect()
    const wx = (e.clientX - r.left - camera.x) / camera.zoom
    const wy = (e.clientY - r.top - camera.y) / camera.zoom
    const cells = game.spotCells()
    const pitch = editor.state.board.pitch
    let bestI = -1, bestD = pitch
    cells.forEach((c, i) => {
      const cx = c[0] * pitch + pitch / 2, cy = c[1] * pitch + pitch / 2
      const d = Math.hypot(cx - wx, cy - wy)
      if (d < bestD) { bestD = d; bestI = i }
    })
    const kind = ui.selectedBuildKind()
    if (bestI >= 0 && kind && game.canBuild(bestI)) {
      game.build(kind, bestI)
    } else {
      const t = game.towers.find((tw) => Math.hypot(tw.pos.x - wx, tw.pos.y - wy) <= pitch)
      selectedTower = t ?? null
      ui.showTower(selectedTower, selectedTower ? game.sellValue(selectedTower) : 0)
    }
  })

  // game loop on the Pixi ticker
  app.ticker.add((ticker) => {
    if (!game) return
    game.tick(ticker.deltaMS / 1000)
    gameLayers.draw(game, selectedTower)
    ui.update(game)
    camera.apply(renderer.world)
  })
}
boot()
