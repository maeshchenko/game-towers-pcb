// src/main.ts
import './ui/styles.css'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { Camera } from './render/Camera'
import { Editor } from './editor/Editor'
import { MAP_PRESETS } from './app/viewport'

const PITCH_PX = 30 // fixed cell size → bigger board = bigger track on screen (pan to navigate)
import { mountToolbar, levelToBlobUrl, readLevelFile } from './ui/Toolbar'
import { mountPanels, updateLevelName } from './ui/Panels'
import { Game } from './game/Game'
import { generateBalancedLevel } from './game/balance'
import { GameLayers } from './render/GameLayers'
import { GameUI } from './ui/GameUI'
import type { Board } from './model/level'
import { levelPaths } from './model/level'
import type { Tower } from './game/Tower'
import { CampaignMenu } from './ui/CampaignMenu'
import { CAMPAIGN_LEVELS, registerVictory, loadProgress, completeTutorial } from './game/campaign'
import { TutorialOverlay } from './ui/TutorialOverlay'

// Difficulty ramp across tracks: EASY → MEDIUM → HARD (Auto-Generate climbs it).
const DIFFICULTY_RAMP = [1, 2, 4, 5, 7, 8, 9]

async function boot() {
  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  document.getElementById('app')!.appendChild(app.canvas)
  const renderer = new Renderer(app)
  const camera = new Camera()

  const view = () => ({ w: window.innerWidth, h: window.innerHeight })
  let board: Board = { cols: 32, rows: 24, pitch: PITCH_PX }
  const editor = new Editor(app, renderer, camera, board, 1)
  mountPanels(null)

  const emptyLevel = (): import('./model/level').Level => ({
    version: 1, board, seed: editor.state.seed, trace: { waypoints: [], cornerRadius: 0.5 },
    spots: [], specialSpots: [], decor: [], meta: { name: 'Untitled', difficulty: 1 },
  })

  const applyBoard = (cols: number, rows: number) => {
    board = { cols, rows, pitch: PITCH_PX }
    editor.state.board = board
    if (editor.state.level) { editor.state.level.board = board; editor.state.recompute(); editor.redraw() }
    else renderer.render(emptyLevel())
  }

  let seedCounter = 1
  let campaign = 0 // index into DIFFICULTY_RAMP; advances each Auto-Generate
  let game: Game | null = null
  let selectedTower: Tower | null = null
  const gameLayers = new GameLayers(renderer.layers.game)

  // Frame the camera on the PATH bounding box so the trace is the centered hero (~78% of viewport).
  function frameLevel(): void {
    const lvl = editor.state.level
    if (!lvl) return
    const pitch = lvl.board.pitch
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const t of levelPaths(lvl)) for (const [cx, cy] of t.waypoints) {
      const x = cx * pitch + pitch / 2, y = cy * pitch + pitch / 2
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
    if (!isFinite(minX)) return
    // fit the path into the free area (avoiding legend/top-bar/HUD) → tidy at ANY board size
    const padc = pitch * 1.2
    minX -= padc; minY -= padc; maxX += padc; maxY += padc
    const mL = 180, mR = 24, mT = 56, mB = 88 // UI margins: legend, mode-bar, HUD
    const aw = Math.max(100, view().w - mL - mR), ah = Math.max(100, view().h - mT - mB)
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY)
    camera.zoom = Math.max(0.2, Math.min(4, Math.min(aw / bw, ah / bh) * 0.97))
    camera.x = mL + aw / 2 - ((minX + maxX) / 2) * camera.zoom
    camera.y = mT + ah / 2 - ((minY + maxY) / 2) * camera.zoom
    camera.apply(renderer.world)
  }

  // generate a specific reproducible level (size + difficulty + seed → always the same track) + show its code
  function makeLevel(cols: number, rows: number, difficulty: number, seed: number): void {
    resetPlay(); ui.showTower(null, 0)
    board = { cols, rows, pitch: PITCH_PX }; editor.state.board = board
    editor.state.loadLevel(generateBalancedLevel({ board, difficulty, seed }))
    editor.redraw(); frameLevel(); updateLevelName(editor.state.level?.meta.name ?? 'LEVEL --')
    const code = `${cols}x${rows}.${difficulty}.${seed}`
    history.replaceState(null, '', `${location.pathname}?t=${code}`)
    if (seedLabel) seedLabel.textContent = `track ${code}`
  }
  function newRandomLevel(): void {
    const difficulty = DIFFICULTY_RAMP[Math.min(campaign++, DIFFICULTY_RAMP.length - 1)]
    const sz = MAP_PRESETS[Math.floor(Math.random() * MAP_PRESETS.length)]
    makeLevel(sz.cols, sz.rows, difficulty, Math.floor(Math.random() * 1_000_000))
  }

  // ui declared early so callbacks in mountToolbar can reference it via closure
  // (definite assignment: all calls happen after ui is fully initialised below)
  let ui!: GameUI

  const infoPanel = () => document.querySelector('.pcb-info') as HTMLElement | null
  function resetPlay() {
    game = null
    selectedTower = null
    gameLayers.clear()
    editor.enabled = false // freehand trace off — board is generated; canvas drag pans the camera
    const ip = infoPanel(); if (ip) ip.style.display = '' // show static panel back in edit mode
  }

  const editorBar = mountToolbar({
    onNew: () => {
      resetPlay(); ui.showTower(null, 0)
      editor.state.clear(); renderer.render(emptyLevel()); updateLevelName('Untitled')
    },
    onGenerate: () => {
      newRandomLevel()
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
        board = { cols: b.cols, rows: b.rows, pitch: PITCH_PX }
        editor.state.board = board
        if (editor.state.level) editor.state.level.board = board
        editor.redraw(); frameLevel()
        updateLevelName(editor.state.level?.meta.name ?? 'LEVEL --')
      } catch (err) {
        console.error(err); alert('Не удалось загрузить уровень: неверный файл')
      }
    },
    onResize: (cols, rows) => { resetPlay(); ui.showTower(null, 0); applyBoard(cols, rows); frameLevel() },
  })

  function ensureGame() {
    if (!game && editor.state.level) {
      game = new Game(editor.state.level, ++seedCounter)
      selectedTower = null
      editor.enabled = false
      const ip = infoPanel(); if (ip) ip.style.display = 'none' // live game-bar HUD replaces the static panel
    }
  }

  let activeCampaignLevelIndex: number | null = null
  let campaignMenu!: CampaignMenu
  let activeTutorial: TutorialOverlay | null = null
  let tutorialStep = 0
  let tutorialSpotIndex = -1

  function runTutorialStep(step: number): void {
    if (!activeTutorial) return
    tutorialStep = step
    const r = app.canvas.getBoundingClientRect()
    const pitch = editor.state.board.pitch

    if (step === 0) {
      const waypoints = editor.state.level?.paths?.[0]?.waypoints || []
      if (waypoints.length > 0) {
        const startC = waypoints[0]
        const sx = (startC[0] * pitch + pitch / 2) * camera.zoom + camera.x + r.left
        const sy = (startC[1] * pitch + pitch / 2) * camera.zoom + camera.y + r.top
        activeTutorial.showStep(
          'Энергетические пакеты пойдут от зеленого входа (START) к красному выходу (FINISH) по дорожкам платы. Ваша задача — защитить финиш!',
          sx,
          sy,
          () => runTutorialStep(1)
        )
      }
    } else if (step === 1) {
      const cells = game?.spotCells() || []
      const targetIndex = cells.findIndex((c) => {
        return editor.state.level?.spots.some(s => s.cell[0] === c[0] && s.cell[1] === c[1])
      })
      tutorialSpotIndex = targetIndex >= 0 ? targetIndex : 0
      const targetCell = cells[tutorialSpotIndex]
      if (targetCell) {
        const sx = (targetCell[0] * pitch + pitch / 2) * camera.zoom + camera.x + r.left
        const sy = (targetCell[1] * pitch + pitch / 2) * camera.zoom + camera.y + r.top
        activeTutorial.showStep(
          'Кликните по этой золотой монтажной площадке, чтобы открыть круговое меню постройки чипа, и выберите PULSE ($40).',
          sx,
          sy,
          null
        )
      }
    } else if (step === 2) {
      const specSpots = editor.state.level?.specialSpots || []
      if (specSpots.length > 0) {
        const specCell = specSpots[0].cell
        const sx = (specCell[0] * pitch + pitch / 2) * camera.zoom + camera.x + r.left
        const sy = (specCell[1] * pitch + pitch / 2) * camera.zoom + camera.y + r.top
        activeTutorial.showStep(
          'Бирюзовые восьмиугольные контакты дают чипам мощный буст (+35% к дальности атаки и урону). Размещайте чипы с умом!',
          sx,
          sy,
          () => runTutorialStep(3)
        )
      } else {
        runTutorialStep(3)
      }
    } else if (step === 3) {
      const startBtn = document.querySelector('.pcb-hud-btn.active') as HTMLElement
      if (startBtn) {
        const rect = startBtn.getBoundingClientRect()
        activeTutorial.showStep(
          'Теперь запустите волну, нажав "START WAVE"! Уничтожение волн приносит кредиты, утечки стоят жизней. Удачи!',
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          null
        )
      } else {
        activeTutorial.hide()
      }
    }
  }

  ui = new GameUI({
    onBuild: (kind, spotIndex) => {
      if (game) {
        game.build(kind, spotIndex)
        if (activeTutorial && tutorialStep === 1 && kind === 'cannon') {
          runTutorialStep(2)
        }
      }
    },
    onStartWave: () => {
      ensureGame()
      game!.startWave()
      if (activeTutorial && tutorialStep === 3) {
        completeTutorial()
        activeTutorial.destroy()
        activeTutorial = null
      }
    },
    onTogglePlay: () => { game && (game.speed = game.speed === 0 ? 1 : 0) },
    onSpeed: (m) => { if (game) game.speed = m },
    onUpgrade: () => { if (game && selectedTower) { game.upgrade(selectedTower); ui.showTower(selectedTower, game.sellValue(selectedTower)) } },
    onSell: () => { if (game && selectedTower) { game.sell(selectedTower); selectedTower = null; ui.showTower(null, 0) } },
    onTargetMode: () => { if (selectedTower) { selectedTower.cycleTargetMode(); ui.showTower(selectedTower, game!.sellValue(selectedTower)) } },
    onMenu: () => {
      ui.closeOverlay()
      if (activeTutorial) {
        activeTutorial.destroy()
        activeTutorial = null
      }
      resetPlay()
      activeCampaignLevelIndex = null
      campaignMenu.show()
    }
  })
  const gameBar = ui.mountHud()

  campaignMenu = new CampaignMenu({
    onSelectLevel: (index) => {
      campaignMenu.hide()
      activeCampaignLevelIndex = index
      const lvlDef = CAMPAIGN_LEVELS[index]
      makeLevel(lvlDef.cols, lvlDef.rows, lvlDef.difficulty, lvlDef.seed)
      setMode('play')

      const progress = loadProgress()
      if (index === 0 && !progress.tutorialCompleted) {
        activeTutorial = new TutorialOverlay()
        setTimeout(() => {
          runTutorialStep(0)
        }, 100)
      } else {
        if (activeTutorial) {
          activeTutorial.destroy()
          activeTutorial = null
        }
      }
    }
  })

  // --- explicit mode switch: Editor (author/generate/save levels) vs Play (towers + waves) ---
  function setMode(m: 'edit' | 'play'): void {
    if (m === 'play') {
      const lvl = editor.state.level
      if (!lvl || (lvl.paths?.[0]?.waypoints.length ?? lvl.trace.waypoints.length) < 2) {
        alert('Сначала создай или сгенерируй уровень'); return
      }
      ensureGame()
      editorBar.style.display = 'none'
      gameBar.style.display = ''
    } else {
      resetPlay(); ui.showTower(null, 0)
      gameBar.style.display = 'none'
      editorBar.style.display = ''
    }
  }
  const modeBar = document.createElement('div')
  modeBar.className = 'pcb-modebar'
  const modeBtn = (label: string, fn: () => void) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn; modeBar.appendChild(b)
  }
  // copyable track-code label (bottom-right) — same code in the URL reproduces the track
  const seedLabel = document.createElement('div')
  seedLabel.className = 'pcb-seed'; seedLabel.title = 'код трассы — скопируй или открой этот URL, чтобы повторить'
  document.body.appendChild(seedLabel)

  // start from ?t=COLSxROWS.DIFF.SEED if present (reproducible), else show campaign selector
  const t = new URLSearchParams(location.search).get('t')
  const m = t && /^(\d+)x(\d+)\.(\d+)\.(\d+)$/.exec(t)
  const isEditor = location.pathname.replace(/\/+$/, '').endsWith('/editor')

  if (isEditor) {
    newRandomLevel()
    modeBtn('▶ Играть', () => { location.href = '/' })
    setMode('edit')
  } else {
    modeBtn('🗺 Новая карта', () => { newRandomLevel(); setMode('play') })
    modeBtn('✎ Редактор', () => { location.href = '/editor' })
    if (m) {
      makeLevel(+m[1], +m[2], +m[3], +m[4])
      setMode('play')
    } else {
      resetPlay()
      gameBar.style.display = 'none'
      editorBar.style.display = 'none'
      campaignMenu.show()
    }
  }
  document.body.appendChild(modeBar)

  // DRAG to pan the camera; a CLICK (no drag) builds/selects in play mode
  let drag: { x: number; y: number; cx: number; cy: number } | null = null
  let dragged = false
  app.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }; dragged = false })
  window.addEventListener('pointermove', (e) => {
    if (!drag) return
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (!dragged && Math.hypot(dx, dy) > 4) dragged = true
    if (dragged) { camera.x = drag.cx + dx; camera.y = drag.cy + dy; camera.apply(renderer.world) }
  })
  window.addEventListener('pointerup', (e) => { if (drag && !dragged) handleClick(e); drag = null })
  function handleClick(e: PointerEvent): void {
    if (!game) return

    // Tutorial blocking logic
    if (activeTutorial) {
      if (tutorialStep === 1) {
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
        if (bestI !== tutorialSpotIndex) return
      } else {
        return
      }
    }

    ui.closeRadialMenu() // Close menu on any click first

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
    
    if (bestI >= 0 && game.canBuild(bestI)) {
      const spotCell = cells[bestI]
      const wx_c = spotCell[0] * pitch + pitch / 2
      const wy_c = spotCell[1] * pitch + pitch / 2
      const clientX = wx_c * camera.zoom + camera.x + r.left
      const clientY = wy_c * camera.zoom + camera.y + r.top
      ui.openRadialMenu(bestI, clientX, clientY, game.state.gold, activeTutorial && tutorialStep === 1 ? 'cannon' : undefined)
    } else {
      const t = game.towers.find((tw) => Math.hypot(tw.pos.x - wx, tw.pos.y - wy) <= pitch)
      selectedTower = t ?? null
      ui.showTower(selectedTower, selectedTower ? game.sellValue(selectedTower) : 0)
    }
  }

  // game loop on the Pixi ticker
  app.ticker.add((ticker) => {
    if (!game) return
    game.tick(ticker.deltaMS / 1000)
    gameLayers.draw(game, selectedTower)
    ui.update(game, editor.state.level?.meta.difficulty ?? 1)
    camera.apply(renderer.world)

    // Handle win/lose state transitions
    if (game.state.phase === 'win' || game.state.phase === 'lose') {
      if (activeTutorial) {
        activeTutorial.destroy()
        activeTutorial = null
      }
      const won = game.state.phase === 'win'
      const score = game.state.lives
      game.speed = 0 // pause ticker updates

      if (won) {
        if (activeCampaignLevelIndex !== null) {
          const res = registerVictory(activeCampaignLevelIndex, score)
          const hasNext = activeCampaignLevelIndex + 1 < CAMPAIGN_LEVELS.length
          ui.showVictoryScreen(
            res.stars,
            score,
            hasNext ? () => {
              ui.closeOverlay()
              activeCampaignLevelIndex!++
              const nextDef = CAMPAIGN_LEVELS[activeCampaignLevelIndex!]
              makeLevel(nextDef.cols, nextDef.rows, nextDef.difficulty, nextDef.seed)
              setMode('play')
            } : null,
            () => {
              ui.closeOverlay()
              const lvlDef = CAMPAIGN_LEVELS[activeCampaignLevelIndex!]
              makeLevel(lvlDef.cols, lvlDef.rows, lvlDef.difficulty, lvlDef.seed)
              setMode('play')
            },
            () => {
              ui.closeOverlay()
              resetPlay()
              activeCampaignLevelIndex = null
              campaignMenu.show()
            }
          )
        } else {
          ui.showVictoryScreen(
            null,
            score,
            null,
            () => {
              ui.closeOverlay()
              const lvl = editor.state.level!
              makeLevel(lvl.board.cols, lvl.board.rows, lvl.meta.difficulty, lvl.seed)
              setMode('play')
            },
            () => {
              ui.closeOverlay()
              resetPlay()
              location.href = '/'
            }
          )
        }
      } else {
        ui.showDefeatScreen(
          () => {
            ui.closeOverlay()
            if (activeCampaignLevelIndex !== null) {
              const lvlDef = CAMPAIGN_LEVELS[activeCampaignLevelIndex]
              makeLevel(lvlDef.cols, lvlDef.rows, lvlDef.difficulty, lvlDef.seed)
            } else {
              const lvl = editor.state.level!
              makeLevel(lvl.board.cols, lvl.board.rows, lvl.meta.difficulty, lvl.seed)
            }
            setMode('play')
          },
          () => {
            ui.closeOverlay()
            resetPlay()
            if (activeCampaignLevelIndex !== null) {
              activeCampaignLevelIndex = null
              campaignMenu.show()
            } else {
              location.href = '/'
            }
          }
        )
      }
      game = null
    }
  })
}
boot()
