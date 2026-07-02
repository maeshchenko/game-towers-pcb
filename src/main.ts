// src/main.ts
import './ui/styles.css'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { Camera } from './render/Camera'
import { Editor } from './editor/Editor'
import { MAP_PRESETS } from './app/viewport'

const PITCH_PX = 30 // fixed cell size → bigger board = bigger track on screen (pan to navigate)
import { mountToolbar, levelToBlobUrl, readLevelFile, retranslateToolbar } from './ui/Toolbar'
import { mountPanels, updateLevelName, retranslatePanels } from './ui/Panels'
import { Game } from './game/Game'
import { generateBalancedLevel } from './game/balance'
import { GameView } from './render/GameView'
import { GameUI } from './ui/GameUI'
import type { Board } from './model/level'
import { levelPaths } from './model/level'
import type { Tower } from './game/Tower'
import { CampaignMenu } from './ui/CampaignMenu'
import { CAMPAIGN_LEVELS, registerVictory, loadProgress, completeTutorial, saveProgress } from './game/campaign'
import { TutorialOverlay } from './ui/TutorialOverlay'
import { audioEngine } from './ui/AudioEngine'
import { i18n } from './ui/i18n'
import { gsap } from 'gsap'
import { initGsap } from './render/juice/tweens'
import { initMotion } from './render/juice/motion'
import { ScreenShake } from './render/juice/ScreenShake'
import { HitStop } from './render/juice/HitStop'
import { enemyTheme } from './render/theme'

// Difficulty ramp across tracks: EASY → MEDIUM → HARD (Auto-Generate climbs it).
const DIFFICULTY_RAMP = [1, 2, 4, 5, 7, 8, 9]

async function boot() {
  const gameContainer = document.getElementById('game-container') || document.body

  // Intercept appendChild/removeChild/insertBefore on document.body to direct them to gameContainer
  const originalAppendChild = document.body.appendChild.bind(document.body)
  const originalRemoveChild = document.body.removeChild.bind(document.body)
  const originalInsertBefore = document.body.insertBefore.bind(document.body)

  document.body.appendChild = function<T extends Node>(node: T): T {
    if ((node as Node) === gameContainer) return originalAppendChild(node)
    return gameContainer.appendChild(node)
  }
  document.body.removeChild = function<T extends Node>(node: T): T {
    if (gameContainer.contains(node)) return gameContainer.removeChild(node)
    return originalRemoveChild(node)
  }
  document.body.insertBefore = function<T extends Node>(node: T, child: Node | null): T {
    if (child && gameContainer.contains(child)) return gameContainer.insertBefore(node, child)
    return originalInsertBefore(node, child)
  }

  let currentRotation = 0

  function getPointerCoords(e: { clientX: number; clientY: number }) {
    if (currentRotation === 90) {
      const rect = gameContainer.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const rx = e.clientX - cx
      const ry = e.clientY - cy
      const w = gameContainer.clientWidth
      const h = gameContainer.clientHeight
      return {
        clientX: ry + w / 2,
        clientY: -rx + h / 2
      }
    }
    return { clientX: e.clientX, clientY: e.clientY }
  }

  function wrapEventCoords(e: UIEvent) {
    if (currentRotation !== 90) return
    if ((e as any).__mapped) return
    ;(e as any).__mapped = true

    const clientX = (e as any).clientX
    const clientY = (e as any).clientY
    if (typeof clientX !== 'number' || typeof clientY !== 'number') return

    const mapped = getPointerCoords({ clientX, clientY })

    Object.defineProperty(e, 'clientX', { get: () => mapped.clientX, configurable: true })
    Object.defineProperty(e, 'clientY', { get: () => mapped.clientY, configurable: true })
    Object.defineProperty(e, 'pageX', { get: () => mapped.clientX, configurable: true })
    Object.defineProperty(e, 'pageY', { get: () => mapped.clientY, configurable: true })
  }

  window.addEventListener('pointerdown', wrapEventCoords, true)
  window.addEventListener('pointermove', wrapEventCoords, true)
  window.addEventListener('pointerup', wrapEventCoords, true)
  window.addEventListener('pointercancel', wrapEventCoords, true)
  window.addEventListener('wheel', wrapEventCoords, { capture: true, passive: false })

  const app = await createPixiApp({ width: window.innerWidth, height: window.innerHeight, background: PALETTE.substrate })
  initGsap(app)
  initMotion()
  document.getElementById('app')!.appendChild(app.canvas)

  // Override canvas.getBoundingClientRect
  app.canvas.getBoundingClientRect = function(): DOMRect {
    const isPortrait = window.innerWidth < window.innerHeight
    const w = isPortrait ? window.innerHeight : window.innerWidth
    const h = isPortrait ? window.innerWidth : window.innerHeight
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: w,
      bottom: h,
      width: w,
      height: h,
      toJSON() { return this }
    } as DOMRect
  }

  const renderer = new Renderer(app)
  const camera = new Camera()
  const shake = new ScreenShake()
  const hitStop = new HitStop()

  const view = () => {
    const isPortrait = window.innerWidth < window.innerHeight
    return {
      w: isPortrait ? window.innerHeight : window.innerWidth,
      h: isPortrait ? window.innerWidth : window.innerHeight
    }
  }
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
  let selectedSpeed = 1
  let selectedTower: Tower | null = null
  let gameView: GameView | null = null

  // Frame the camera on the PATH bounding box so the trace is the centered hero (~78% of viewport).
  function frameLevel(): void {
    const lvl = editor.state.level
    if (!lvl) return
    const pitch = lvl.board.pitch
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const acc = (cx: number, cy: number) => {
      const x = cx * pitch + pitch / 2, y = cy * pitch + pitch / 2
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
    for (const t of levelPaths(lvl)) for (const [cx, cy] of t.waypoints) acc(cx, cy)
    // include the tower pads (and boost contacts) so they always fit on screen, not just the trace
    for (const sp of lvl.spots) acc(sp.cell[0], sp.cell[1])
    for (const sp of lvl.specialSpots) acc(sp.cell[0], sp.cell[1])
    if (!isFinite(minX)) return
    // fit the path into the free area (avoiding legend/top-bar/HUD) → tidy at ANY board size
    const padc = pitch * 0.4   // tight margin around path+spots → larger boards fill more screen
    minX -= padc; minY -= padc; maxX += padc; maxY += padc
    const isMobile = view().w < 800
    const mL = isMobile ? 16 : 156
    const mR = isMobile ? 16 : 24
    const mT = isMobile ? 52 : 56
    const mB = isMobile ? 16 : 64
    const aw = Math.max(100, view().w - mL - mR), ah = Math.max(100, view().h - mT - mB)
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY)
    camera.zoom = Math.max(0.1, Math.min(4, Math.min(aw / bw, ah / bh) * 0.99))
    // cap zoom-out slightly beyond the start framing — zooming further out loses the board
    camera.minZoom = camera.zoom * 0.9
    camera.x = mL + aw / 2 - ((minX + maxX) / 2) * camera.zoom
    camera.y = mT + ah / 2 - ((minY + maxY) / 2) * camera.zoom
    camera.apply(renderer.world)
  }

  function handleResize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const isPortrait = w < h

    let logicalW = w
    let logicalH = h

    if (isPortrait) {
      currentRotation = 90
      document.body.classList.add('pcb-portrait')
      logicalW = h
      logicalH = w
      gameContainer.style.width = `${logicalW}px`
      gameContainer.style.height = `${logicalH}px`
    } else {
      currentRotation = 0
      document.body.classList.remove('pcb-portrait')
      gameContainer.style.width = '100%'
      gameContainer.style.height = '100%'
    }

    app.renderer.resize(logicalW, logicalH)
    frameLevel()
  }

  window.addEventListener('resize', handleResize)
  window.addEventListener('orientationchange', handleResize)
  // Call on next tick to align sizes
  setTimeout(handleResize, 0)

  // generate a specific reproducible level (size + difficulty + seed → always the same track) + show its code
  function makeLevel(cols: number, rows: number, difficulty: number, seed: number): void {
    resetPlay(); ui.showTower(null, 0)
    board = { cols, rows, pitch: PITCH_PX }; editor.state.board = board
    editor.state.loadLevel(generateBalancedLevel({ board, difficulty, seed }))
    editor.redraw(); frameLevel()
    ui.setLevelNumber(activeCampaignLevelIndex !== null ? activeCampaignLevelIndex + 1 : 1)
    const lvlName = editor.state.level?.meta.name
    updateLevelName(lvlName ? (i18n.t(lvlName as any) || lvlName) : 'LEVEL --')
    const code = `${cols}x${rows}.${difficulty}.${seed}`
    history.replaceState(null, '', `${location.pathname}?t=${code}`)
    const trackStr = i18n.lang === 'ru' ? 'трасса' : 'track'
    if (seedLabel) seedLabel.textContent = `${trackStr} ${code}`
  }
  // campaign: load a hand-authored level when one exists for this index, else fall back to generator
  function loadAuthoredOrGenerated(index: number): void {
    const def = CAMPAIGN_LEVELS[index]
    if (def?.build) {
      resetPlay(); ui.showTower(null, 0)
      board = { cols: def.cols, rows: def.rows, pitch: PITCH_PX }; editor.state.board = board
      editor.state.loadLevel(def.build(board))
      editor.redraw(); frameLevel()
      ui.setLevelNumber(index + 1)
      updateLevelName(i18n.t(def.nameKey as any) || def.name)
      history.replaceState(null, '', `${location.pathname}?t=authored-${index + 1}`)
      const trackStr = i18n.lang === 'ru' ? 'уровень' : 'level'
      if (seedLabel) seedLabel.textContent = `${trackStr} ${index + 1}`
    } else {
      makeLevel(def.cols, def.rows, def.difficulty, def.seed)
    }
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
    gameView?.destroy()
    gameView = null
    shake.reset() // drop leftover trauma/freeze so they don't bleed into the next level
    hitStop.reset()
    gsap.killTweensOf(camera) // a mid-flight intro zoom tween must not fight the next level's framing
    renderer.world.rotation = 0 // ticker early-returns without a game, so clear mid-shake tilt here
    editor.enabled = false // freehand trace off — board is generated; canvas drag pans the camera
    const ip = infoPanel(); if (ip) ip.style.display = '' // show static panel back in edit mode
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    waveCountdown = 0
    selectedSpeed = 1
    ui.selectSpeed(1)
  }

  const editorBar = mountToolbar({
    onNew: () => {
      resetPlay(); ui.showTower(null, 0)
      editor.state.clear(); renderer.render(emptyLevel()); updateLevelName(i18n.lang === 'ru' ? 'Без названия' : 'Untitled')
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
        const name = editor.state.level?.meta.name
        updateLevelName(name ? (i18n.t(name as any) || name) : 'LEVEL --')
      } catch (err) {
        console.error(err); alert(i18n.t('editor.load_error'))
      }
    },
    onResize: (cols, rows) => { resetPlay(); ui.showTower(null, 0); applyBoard(cols, rows); frameLevel() },
  })

  function ensureGame() {
    if (!game && editor.state.level) {
      game = new Game(editor.state.level, ++seedCounter)
      gameView?.destroy() // defensive: resetPlay normally clears it, this guards any future path that skips it
      gameView = new GameView(app, renderer, game)
      game.events.on((e) => {
        if (e.type === 'leak') audioEngine.playLeak()
        else if (e.type === 'enemyDied') audioEngine.playEnemyDeath()
        else if (e.type === 'shotFired') audioEngine.playShot(e.kind as any)
      })
      game.events.on((e) => {
        if (e.type === 'baseHit') shake.add(0.35)
        else if (e.type === 'enemyDied') {
          if (e.kind === 'boss') { shake.add(0.6); hitStop.trigger(0.13) }
          else hitStop.trigger(0.05)
        } else if (e.type === 'projectileImpact' && e.kind === 'mortar') shake.add(0.08)
      })
      game.events.on((e) => {
        if (e.type === 'waveStart') {
          const entries = game!.peekWave(e.index)
          const comp = entries.map((entry) => {
            const theme = enemyTheme(entry.kind)
            return { name: theme.name, color: theme.color, count: entry.count }
          })
          ui.showWaveBanner(e.index + 1, comp)
        }
      })
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
  let autoWaveEnabled = true
  let waveCountdown = 0
  let countdownTimer: any = null
  const introducingEnemies = new Set<string>()

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
          i18n.t('tutorial.step0'),
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
          i18n.t('tutorial.step1'),
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
          i18n.t('tutorial.step2'),
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
          i18n.t('tutorial.step3'),
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
      onStartWaveClick()
    },
    onTogglePlay: () => {
      if (game) {
        if (game.speed === 0) {
          game.speed = selectedSpeed
          ui.selectSpeed(selectedSpeed)
        } else {
          selectedSpeed = game.speed
          game.speed = 0
          ui.selectSpeed(0)
        }
      }
    },
    onSpeed: (m) => {
      if (game) {
        selectedSpeed = m
        game.speed = m
        ui.selectSpeed(m)
      }
    },
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
    },
    onLanguageChanged: () => {
      ui.retranslateHud(game || undefined, editor.state.level?.meta.difficulty ?? 1)
      if (game) {
        ui.update(game, editor.state.level?.meta.difficulty ?? 1)
      }
      campaignMenu.render()
      if (activeTutorial) {
        runTutorialStep(tutorialStep)
      }
      retranslateToolbar()
      updateStartWaveButtonText()
      const lvlName = editor.state.level?.meta.name
      retranslatePanels(lvlName ? (i18n.t(lvlName as any) || lvlName) : 'LEVEL --')
      retranslateModebar()
      
      // Update seed label
      if (editor.state.level) {
        const code = `${editor.state.board.cols}x${editor.state.board.rows}.${editor.state.level.meta.difficulty}.${editor.state.level.seed}`
        const trackStr = i18n.lang === 'ru' ? 'трасса' : 'track'
        seedLabel.textContent = `${trackStr} ${code}`
      }
    },
    onAutoWaveChanged: (val) => {
      autoWaveEnabled = val
    },
    onOpenBestiary: () => {
      const progress = loadProgress()
      campaignMenu.showBestiary(progress.unlockedLevelIndex)
    }
  })
  const gameBar = ui.mountHud()
  ui.setAutoWave(autoWaveEnabled)

  campaignMenu = new CampaignMenu({
    onSelectLevel: (index) => {
      audioEngine.init()
      if (audioEngine.isMuted()) {
        audioEngine.setMute(false)
      }
      audioEngine.playClick()

      campaignMenu.hide()
      activeCampaignLevelIndex = index
      loadAuthoredOrGenerated(index)
      setMode('play')

      if (index === 0) {
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
        alert(i18n.t('editor.alert')); return
      }
      ensureGame()
      editorBar.style.display = 'none'
      gameBar.style.display = ''
      startBuildPhaseCountdown()
    } else {
      resetPlay(); ui.showTower(null, 0)
      gameBar.style.display = 'none'
      editorBar.style.display = ''
    }
  }
  const modeBar = document.createElement('div')
  modeBar.className = 'pcb-modebar'
  const modeBtn = (label: string, className: string, fn: () => void) => {
    const b = document.createElement('button'); b.className = className; b.textContent = label; b.onclick = fn; modeBar.appendChild(b)
  }
  // copyable track-code label (bottom-right) — same code in the URL reproduces the track
  const seedLabel = document.createElement('div')
  seedLabel.className = 'pcb-seed'; seedLabel.title = i18n.t('seed.tooltip')
  document.body.appendChild(seedLabel)

  // start from ?t=COLSxROWS.DIFF.SEED if present (reproducible), else show campaign selector
  const t = new URLSearchParams(location.search).get('t')
  const m = t && /^(\d+)x(\d+)\.(\d+)\.(\d+)$/.exec(t)
  const isEditor = location.pathname.replace(/\/+$/, '').endsWith('/editor')
  const isNew = location.pathname.replace(/\/+$/, '').endsWith('/new')

  function retranslateModebar(): void {
    const btnPlay = modeBar.querySelector('.pcb-mode-btn-play')
    if (btnPlay) btnPlay.textContent = i18n.t('mode.play')
    const btnNew = modeBar.querySelector('.pcb-mode-btn-new')
    if (btnNew) btnNew.textContent = i18n.t('mode.new_map')
    const btnEdit = modeBar.querySelector('.pcb-mode-btn-editor')
    if (btnEdit) btnEdit.textContent = i18n.t('mode.editor')
    seedLabel.title = i18n.t('seed.tooltip')
  }

  if (isNew) {
    newRandomLevel()
    setMode('play')
  } else if (isEditor) {
    newRandomLevel()
    modeBtn(i18n.t('mode.play'), 'pcb-mode-btn-play', () => { location.href = '/' })
    setMode('edit')
  } else {
    // Normal campaign screen or code-based launch:
    // We hide New Map and Editor buttons by default, so we don't call modeBtn() here.
    const am = t && /^authored-(\d+)$/.exec(t)
    if (am && CAMPAIGN_LEVELS[+am[1] - 1]?.build) {
      activeCampaignLevelIndex = +am[1] - 1
      loadAuthoredOrGenerated(+am[1] - 1)
      setMode('play')
    } else if (m) {
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

  // DRAG/PINCH to pan/zoom the camera; a CLICK (no drag) builds/selects in play mode
  let drag: { x: number; y: number; cx: number; cy: number } | null = null
  let dragged = false
  const activePointers = new Map<number, { clientX: number; clientY: number }>()
  let lastPinchDist = 0
  let lastMidX = 0
  let lastMidY = 0

  app.canvas.addEventListener('pointerdown', (e) => {
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })
    if (activePointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y }
      dragged = false
    } else if (activePointers.size === 2) {
      drag = null
      const pts = Array.from(activePointers.values())
      lastPinchDist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY)
      lastMidX = (pts[0].clientX + pts[1].clientX) / 2
      lastMidY = (pts[0].clientY + pts[1].clientY) / 2
    }
  })

  window.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return
    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY })
    if (activeTutorial) return   // no pan/zoom while the tutorial guides a fixed spot

    if (activePointers.size === 1 && drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y
      if (!dragged && Math.hypot(dx, dy) > 4) dragged = true
      if (dragged) {
        camera.x = drag.cx + dx
        camera.y = drag.cy + dy
        camera.apply(renderer.world)
      }
    } else if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values())
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY)
      const midX = (pts[0].clientX + pts[1].clientX) / 2
      const midY = (pts[0].clientY + pts[1].clientY) / 2

      if (lastPinchDist > 0) {
        const factor = dist / lastPinchDist
        camera.zoomAt(midX, midY, factor)
        camera.x += (midX - lastMidX)
        camera.y += (midY - lastMidY)
        camera.apply(renderer.world)
      }

      lastPinchDist = dist
      lastMidX = midX
      lastMidY = midY
    }
  })

  const handlePointerUp = (e: PointerEvent) => {
    activePointers.delete(e.pointerId)
    if (activePointers.size < 2) {
      lastPinchDist = 0
    }
    if (activePointers.size === 0) {
      if (drag && !dragged) handleClick(e)
      drag = null
    } else if (activePointers.size === 1) {
      const remaining = Array.from(activePointers.values())[0]
      drag = { x: remaining.clientX, y: remaining.clientY, cx: camera.x, cy: camera.y }
      dragged = true
    }
  }

  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('pointercancel', handlePointerUp)

  app.canvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    if (activeTutorial) return   // freeze camera during the guided tutorial so the ring stays aligned
    const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
    let factor: number
    if (e.ctrlKey) {
      // TRACKPAD PINCH (ctrlKey on macOS): deltas can be large/fast, so use a tiny coefficient AND a
      // tight per-event clamp -> each pinch event nudges zoom at most ~2.5%, so it's smooth and slow.
      factor = Math.max(0.975, Math.min(1.025, Math.exp(-px * 0.0006)))
    } else {
      // MOUSE WHEEL: keep the prior ~1.15 / 0.85 feel (big discrete deltas).
      factor = Math.max(0.85, Math.min(1.18, Math.exp(-px * 0.0016)))
    }
    const r = app.canvas.getBoundingClientRect()
    camera.zoomAt(e.clientX - r.left, e.clientY - r.top, factor)
    camera.apply(renderer.world)
    if ((window as any).__zoomdbg) console.log('[zoom]', { dy: e.deltaY, mode: e.deltaMode, ctrl: e.ctrlKey, factor: +factor.toFixed(3), zoom: +camera.zoom.toFixed(2) })
  }, { passive: false })
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
      ui.openRadialMenu(bestI, clientX, clientY, game.state.gold, activeTutorial && tutorialStep === 1 ? 'cannon' : undefined, !activeTutorial)
    } else {
      const t = game.towers.find((tw) => Math.hypot(tw.pos.x - wx, tw.pos.y - wy) <= pitch)
      selectedTower = t ?? null
      ui.showTower(selectedTower, selectedTower ? game.sellValue(selectedTower) : 0)
    }
  }

  let lastPhase: string | null = null

  // game loop on the Pixi ticker
  app.ticker.add((ticker) => {
    if (!game) {
      lastPhase = null
      return
    }
    const rawDt = ticker.deltaMS / 1000
    const simDt = hitStop.filter(rawDt)
    game.tick(simDt)
    gameView?.update(rawDt, selectedTower)
    ui.update(game, editor.state.level?.meta.difficulty ?? 1)
    camera.apply(renderer.world)
    // camera.apply resets position/scale but not rotation, so zero it before the additive shake
    // to keep residual rotation from accumulating across frames.
    renderer.world.rotation = 0
    shake.update(rawDt)
    shake.applyTo(renderer.world, { x: view().w / 2, y: view().h / 2 })

    if (game.state.phase === 'wave') {
      const activeEnemies = game.enemies()
      const progress = loadProgress()
      if (!progress.seenIntroductions) progress.seenIntroductions = {}
      
      // Enemy introductions are part of onboarding → trigger on any campaign level (activeCampaignLevelIndex !== null)
      // the first time that specific enemy type is encountered.
      const newEnemy = activeCampaignLevelIndex !== null ? activeEnemies.find(e => {
        const k = e.kind
        return ['normal', 'fast', 'healer', 'brute', 'tank', 'rogue', 'boss'].includes(k) && !progress.seenIntroductions![k] && !introducingEnemies.has(k)
      }) : undefined

      if (newEnemy) {
        const kind = newEnemy.kind
        introducingEnemies.add(kind)

        // Pause game ticks
        game.speed = 0
        
        // Focus camera on the new enemy (centered in the visible play area, respecting margins),
        // remembering the current framing so it can be restored when the popup closes.
        const savedCam = { x: camera.x, y: camera.y, zoom: camera.zoom }
        const enemyX = newEnemy.pos.x
        const enemyY = newEnemy.pos.y
        const isMobile = view().w < 800
        const mL = isMobile ? 16 : 156
        const mR = isMobile ? 16 : 24
        const mT = isMobile ? 52 : 56
        const mB = isMobile ? 16 : 64
        const aw = Math.max(100, view().w - mL - mR), ah = Math.max(100, view().h - mT - mB)
        const introZoom = Math.max(camera.zoom, 1.2)
        gsap.killTweensOf(camera)
        gsap.to(camera, {
          zoom: introZoom,
          x: mL + aw / 2 - enemyX * introZoom,
          y: mT + ah / 2 - enemyY * introZoom,
          duration: 0.35, ease: 'power2.out',
        })

        // Reset countdown timer
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
        waveCountdown = 0
        updateStartWaveButtonText()

        showEnemyIntroduction(kind, () => {
          const prog = loadProgress()
          if (!prog.seenIntroductions) prog.seenIntroductions = {}
          prog.seenIntroductions[kind] = true
          saveProgress(prog)
          introducingEnemies.delete(kind)

          // Restore the framing the player had before the intro zoom-in.
          gsap.killTweensOf(camera)
          gsap.to(camera, { ...savedCam, duration: 0.4, ease: 'power2.out' })

          if (game) {
            game.speed = selectedSpeed
            ui.selectSpeed(selectedSpeed)
          }
        })
      }
    }

    const currentPhase = game.state.phase
    if (lastPhase === 'wave' && currentPhase === 'build') {
      startBuildPhaseCountdown()
    }
    lastPhase = currentPhase

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
        audioEngine.playVictory()
        if (activeCampaignLevelIndex !== null) {
          const res = registerVictory(activeCampaignLevelIndex, score)
          const hasNext = activeCampaignLevelIndex + 1 < CAMPAIGN_LEVELS.length
          ui.showVictoryScreen(
            res.stars,
            score,
            hasNext ? () => {
              ui.closeOverlay()
              activeCampaignLevelIndex!++
              loadAuthoredOrGenerated(activeCampaignLevelIndex!)
              setMode('play')
            } : null,
            () => {
              ui.closeOverlay()
              loadAuthoredOrGenerated(activeCampaignLevelIndex!)
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
        audioEngine.playDefeat()
        shake.add(0.5)
        ui.showDefeatScreen(
          () => {
            ui.closeOverlay()
            if (activeCampaignLevelIndex !== null) {
              loadAuthoredOrGenerated(activeCampaignLevelIndex)
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

  function onStartWaveClick() {
    ensureGame()
    if (!game || game.state.phase !== 'build') return

    // Calculate early start bonus
    if (waveCountdown > 0) {
      const bonus = Math.ceil(waveCountdown) * 3
      game.state.add(bonus)
      audioEngine.playUpgrade() // nice positive sound for bonus!
      showFloatingBonusText(bonus)
    }

    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    waveCountdown = 0
    
    game.startWave()
    if (activeTutorial && tutorialStep === 3) {
      completeTutorial()
      activeTutorial.destroy()
      activeTutorial = null
    }
    ui.update(game, editor.state.level?.meta.difficulty ?? 1)
  }

  function startBuildPhaseCountdown() {
    if (countdownTimer) clearInterval(countdownTimer)
    if (!game || game.state.wave >= game.state.waveCount) {
      waveCountdown = 0
      updateStartWaveButtonText()
      return
    }

    // If it is the very first wave of the level, do NOT auto-start and do NOT run the countdown!
    if (game.state.wave === 0) {
      waveCountdown = 0
      updateStartWaveButtonText()
      return
    }

    waveCountdown = 5.0
    updateStartWaveButtonText()

    countdownTimer = setInterval(() => {
      if (!game || game.state.phase !== 'build') {
        clearInterval(countdownTimer)
        countdownTimer = null
        waveCountdown = 0
        updateStartWaveButtonText()
        return
      }

      waveCountdown -= 0.1
      if (waveCountdown <= 0) {
        waveCountdown = 0
        clearInterval(countdownTimer)
        countdownTimer = null
        updateStartWaveButtonText()
        
        if (autoWaveEnabled) {
          ensureGame()
          game.startWave()
          ui.update(game, editor.state.level?.meta.difficulty ?? 1)
        }
      } else {
        updateStartWaveButtonText()
      }
    }, 100)
  }

  function updateStartWaveButtonText() {
    const startBtn = document.querySelector('.next-wave-btn') as HTMLElement
    if (!startBtn) return
    if (waveCountdown > 0) {
      startBtn.textContent = `${i18n.t('hud.start_wave')} (${Math.ceil(waveCountdown)})`
    } else {
      startBtn.textContent = i18n.t('hud.start_wave')
    }
  }

  function showFloatingBonusText(bonus: number) {
    const startBtn = document.querySelector('.next-wave-btn')
    if (!startBtn) return
    const rect = startBtn.getBoundingClientRect()
    
    const el = document.createElement('div')
    el.className = 'pcb-floating-bonus'
    el.style.left = `${rect.left + rect.width / 2}px`
    el.style.top = `${rect.top - 20}px`
    el.textContent = `+${bonus} ⚡`
    document.body.appendChild(el)
    
    setTimeout(() => el.remove(), 1000)
  }

  function showEnemyIntroduction(kind: string, onClose: () => void) {
    const modal = document.createElement('div')
    modal.className = 'pcb-settings-modal'
    modal.style.zIndex = '300'
    modal.style.display = 'flex'

    const color = getEnemyColor(kind)
    const name = i18n.t(`enemy.${kind}` as any)
    const desc = i18n.t(`enemy.${kind}.desc` as any)
    const strat = i18n.t(`enemy.${kind}.strat` as any)

    modal.innerHTML = `
      <div class="pcb-settings-card" style="width: 360px; max-width: 90%; text-align: center; border-color: ${color}; box-shadow: 0 0 20px ${color}33;">
        <h2 style="color: ${color}; font-size: 14px; margin-bottom: 6px;">${i18n.t('enemy.intro.title')}</h2>
        
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 16px 0;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: ${color}22; border: 2px solid ${color}; box-shadow: 0 0 12px ${color}55; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            👾
          </div>
          <div style="font-weight: bold; color: ${color}; font-size: 15px; letter-spacing: 1px;">${name}</div>
        </div>

        <div style="color: #fff; margin-bottom: 12px; font-size: 11px; line-height: 1.4; text-align: left; background: rgba(10,22,17,0.5); padding: 10px; border-radius: 4px; border: 1px solid #1a4534;">
          ${desc}
        </div>
        
        <div style="color: #6f8f7e; font-size: 10px; line-height: 1.3; text-align: left; margin-bottom: 20px; padding: 0 10px;">
          <span style="color: #f0c43a; font-weight: bold;">${i18n.t('bestiary.strategy')}:</span> ${strat}
        </div>

        <button class="pcb-hud-btn active close-intro-btn" style="width: 100%;">${i18n.t('enemy.intro.ok')}</button>
      </div>
    `
    document.body.appendChild(modal);

    (modal.querySelector('.close-intro-btn') as HTMLElement).onclick = () => {
      audioEngine.playClick()
      modal.parentNode?.removeChild(modal)
      onClose()
    }
  }

  function getEnemyColor(kind: string): string {
    const map: Record<string, string> = {
      normal: '#ff4d4d',
      fast: '#36e0e0',
      healer: '#f0c43a',
      brute: '#c23bff',
      tank: '#ff9b3a',
      rogue: '#4dff7a',
      boss: '#c23bff',
    }
    return map[kind] || '#fff'
  }
}
boot()
