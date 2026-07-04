// src/main.ts
import './ui/styles.css'
import { createPixiApp } from './app/PixiApp'
import { PALETTE } from './style/palette'
import { Renderer } from './render/Renderer'
import { clearTextureCache, clearParticleTextureCache, clearProjectileTextureCache } from './render/views/textures'
import { Camera } from './render/Camera'
import { Editor } from './editor/Editor'
import { MAP_PRESETS } from './app/viewport'

const PITCH_PX = 30 // fixed cell size → bigger board = bigger track on screen (pan to navigate)
import { mountToolbar, levelToBlobUrl, readLevelFile, retranslateToolbar } from './ui/Toolbar'
import { mountPanels, updateLevelName, retranslatePanels, showTipsPanel } from './ui/Panels'
import { Game } from './game/Game'
import { generateBalancedLevel } from './game/balance'
import { GameView } from './render/GameView'
import { GameUI } from './ui/GameUI'
import type { Board } from './model/level'
import { levelPaths } from './model/level'
import type { Tower } from './game/Tower'
import { CampaignMenu, dailyStamp } from './ui/CampaignMenu'
import { rollDailyMods, type DailyMods } from './game/dailyMods'
import { recordDailyWin } from './game/dailyHistory'
import { CAMPAIGN_LEVELS, registerVictory, loadProgress, completeTutorial } from './game/campaign'
import { metaEffects } from './game/metaUpgrades'
import { AchievementTracker, evaluateAchievements } from './game/achievements'
import { recordRun, EMPTY_STATS } from './game/profileStats'
import { showAchievementToasts } from './ui/metaScreens'
import { StoryScreen } from './ui/StoryScreen'
import { TitleScreen } from './ui/TitleScreen'
import { CAMPAIGN_STORY } from './story/campaignStory'
import { TutorialOverlay } from './ui/TutorialOverlay'
import { audioEngine } from './ui/AudioEngine'
import { i18n } from './ui/i18n'
import { gsap } from 'gsap'
import { initGsap } from './render/juice/tweens'
import { initMotion, setReducedFx, juice } from './render/juice/motion'
import { PerfMonitor } from './render/PerfMonitor'
import { ScreenShake } from './render/juice/ScreenShake'
import { HitStop } from './render/juice/HitStop'
import { enemyTheme, enemyColorHex } from './render/theme'
import { showAlert } from './ui/confirmModal'
import { showHint, showInfoToast } from './ui/hints'
import { Graphics } from 'pixi.js'
import { TOWER_DEFS } from './game/towerTypes'
import { mountUi, uiRoot } from './ui/uiRoot'
import { enemyGlyphSvg, icon } from './ui/icons'
import { waveComposition } from './game/WaveManager'
import { PLAYER_DIFFICULTY_HP } from './game/difficulty'
import { loadPlayerDifficulty } from './game/playerPrefs'
import { saveRun, loadRun, clearRun } from './game/runSave'
import { storageGet, storageSet } from './util/safeStorage'

// Difficulty ramp across tracks: EASY → MEDIUM → HARD (Auto-Generate climbs it).
const DIFFICULTY_RAMP = [1, 2, 4, 5, 7, 8, 9]

async function boot() {
  // All game UI mounts into #game-container via mountUi() (src/ui/uiRoot.ts) — the container is
  // what rotates 90° in mobile portrait mode. The old approach of monkey-patching
  // document.body.appendChild redirected third-party DOM inserts too (analytics, portal SDK
  // overlays) and was removed.
  const gameContainer = uiRoot()

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

  // Audio unlocks on the FIRST user gesture anywhere — not only via the campaign-menu click.
  // Direct URL entry (?t=...) and mid-level page reloads used to stay silent forever because
  // nothing ever called setMute(false) on those paths.
  const enableAudioOnce = () => {
    window.removeEventListener('pointerdown', enableAudioOnce, true)
    audioEngine.init()
    if (audioEngine.isMuted()) audioEngine.setMute(false)
  }
  window.addEventListener('pointerdown', enableAudioOnce, true)
  document.getElementById('app')!.appendChild(app.canvas)
  // WebGL context recovery is wired AFTER the renderer exists (see below) — a lost context on
  // mobile (backgrounding, GPU pressure) must be recoverable, not a fatal dead-end.

  // Hidden tab: pause the sim and silence the audio graph. Without this the background
  // setInterval throttling shreds the music into bursts while enemies keep leaking.
  let speedBeforeHide: number | null = null
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audioEngine.suspendForBackground()
      if (game && game.speed > 0) {
        speedBeforeHide = game.speed
        game.speed = 0
      }
    } else {
      audioEngine.resumeFromBackground()
      if (game && speedBeforeHide !== null && game.speed === 0) game.speed = speedBeforeHide
      speedBeforeHide = null
    }
  })

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

  // --- WebGL context loss recovery -------------------------------------------------------------
  // On mobile the GPU can drop the context (backgrounding, memory pressure, driver reset). Pixi
  // re-uploads live Graphics geometry on restore, but our BAKED textures (cacheAsTexture render
  // targets + generateTexture sprite caches) are gone — clear the caches so they regenerate, and
  // re-bake the board. Meanwhile freeze the sim so nothing leaks while the screen is black.
  let ctxLostSpeed: number | null = null
  app.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault() // REQUIRED — lets the browser fire 'restored' instead of killing the canvas
    if (game) { ctxLostSpeed = game.speed; game.speed = 0 }
    showInfoToast(i18n.t('perf.ctx_lost.title'), i18n.t('perf.ctx_lost.body'), '⚠')
  })
  app.canvas.addEventListener('webglcontextrestored', () => {
    // Defer to the next frame so pixi finishes rebuilding its GL context before we touch it. The
    // baked sprite caches (generateTexture RenderTextures) are GPU-only and cannot survive the
    // loss, and the pooled views hold sprites bound to those now-dead textures. So: clear the
    // caches, tear down the whole GameView (it unsubscribes cleanly) and rebuild it fresh, then
    // re-bake the board. Everything regenerates against the new context.
    requestAnimationFrame(() => {
      clearTextureCache(); clearParticleTextureCache(); clearProjectileTextureCache()
      if (editor.state.level) renderer.render(editor.state.level)
      if (game) {
        gameView?.destroy()
        gameView = new GameView(app, renderer, game)
        if (ctxLostSpeed !== null) { game.speed = ctxLostSpeed; ctxLostSpeed = null }
      }
    })
  })

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
  let achTracker: AchievementTracker | null = null
  // Replay modes launched from the campaign menu footer.
  let endlessMode = false
  let dailyActive = false
  let dailyMods: DailyMods | null = null // rolled once per daily entry, shared seed = shared twist
  // The framing clamp reads overlay heights from the DOM, but the next-wave strip only
  // appears AFTER the first ui.update of the build phase — re-frame once, when it shows up.
  let framedWithPreview = false
  // Ability aiming state: armed = the next board click fires that ability.
  let armedAbility: 'discharge' | 'overload' | null = null
  /** Discharge unlocks at campaign level 3 (story: "emergency discharge circuit restored") —
   * L1-2 teach the basics first. Non-campaign boards (endless/daily/generated) get it at once. */
  function abilityUnlocked(): boolean {
    return activeCampaignLevelIndex === null || activeCampaignLevelIndex >= 2
  }
  /** Overload unlocks at campaign level 6 — by then the player juggles full builds. */
  function overloadUnlocked(): boolean {
    return activeCampaignLevelIndex === null || activeCampaignLevelIndex >= 5
  }
  function updateDischargeButton(): void {
    ui.setAbilityState(game?.dischargeCooldown ?? 0, armedAbility === 'discharge', abilityUnlocked())
    ui.setAbility2State(game?.overloadCooldown ?? 0, armedAbility === 'overload', overloadUnlocked())
  }
  function armAbility(which: 'discharge' | 'overload'): void {
    armedAbility = armedAbility === which ? null : which
    document.body.classList.toggle('pcb-aiming', armedAbility !== null)
    updateDischargeButton()
  }
  let selectedSpeed = 1
  let selectedTower: Tower | null = null
  let gameView: GameView | null = null

  // Build-range preview circle (radial menu hover / touch arm) — lives in the overlay layer.
  const rangePreviewG = new Graphics()
  renderer.layers.game.addChild(rangePreviewG)
  // Discharge aim circle: follows the cursor while armed so the blast area is never a guess.
  const aimCircleG = new Graphics()
  renderer.layers.game.addChild(aimCircleG)
  window.addEventListener('pointermove', (e) => {
    if (!armedAbility || !game) { if (aimCircleG.visible) { aimCircleG.visible = false } return }
    const r = app.canvas.getBoundingClientRect()
    const wx = (e.clientX - r.left - camera.x) / camera.zoom
    const wy = (e.clientY - r.top - camera.y) / camera.zoom
    aimCircleG.visible = true
    aimCircleG.clear()
    const pitch = editor.state.board.pitch
    // Gold = discharge blast; cyan = overload boost zone.
    const radius = (armedAbility === 'discharge' ? Game.DISCHARGE.radiusCells : Game.OVERLOAD.radiusCells) * pitch
    const color = armedAbility === 'discharge' ? 0xf0c43a : 0x36e0e0
    aimCircleG.circle(wx, wy, radius).fill({ color, alpha: 0.08 }).stroke({ color, width: 1.5, alpha: 0.7 })
  })
  const RANGE_PREVIEW_COLORS: Record<string, number> = {
    cannon: 0x36e0e0, slow: 0x4dff7a, sniper: 0x3a7bff, mortar: 0xff9b3a, tesla: 0xc23bff,
  }

  // ---- pause menu / modal-pause plumbing -------------------------------
  // Remember the speed the player HAD (0 stays 0 — a deliberate pause must survive a modal).
  let speedBeforeModal: number | null = null
  function pauseForModal(): void {
    if (!game || speedBeforeModal !== null) return
    speedBeforeModal = game.speed
    game.speed = 0
  }
  function resumeFromModal(): void {
    if (!game || speedBeforeModal === null) { speedBeforeModal = null; return }
    game.speed = speedBeforeModal
    ui.selectSpeed(speedBeforeModal === 0 ? 0 : speedBeforeModal)
    speedBeforeModal = null
  }
  function exitToMenu(): void {
    endlessMode = false
    dailyActive = false
    dailyMods = null
    if (autoWaveBeforeEndless !== null) {
      // Endless forced auto-wave ON for its own session — leaving it must not keep the
      // player's campaign setting silently flipped until the next reload.
      autoWaveEnabled = autoWaveBeforeEndless
      ui.setAutoWave(autoWaveEnabled)
      autoWaveBeforeEndless = null
    }
    ui.closeOverlay()
    if (activeTutorial) {
      activeTutorial.destroy()
      activeTutorial = null
    }
    resetPlay()
    activeCampaignLevelIndex = null
    campaignMenu.show()
  }
  function restartLevel(): void {
    ui.closeOverlay()
    clearRun() // an explicit restart must not resume into the abandoned run
    if (activeCampaignLevelIndex !== null) {
      loadAuthoredOrGenerated(activeCampaignLevelIndex)
    } else if (editor.state.level) {
      const lvl = editor.state.level
      makeLevel(lvl.board.cols, lvl.board.rows, lvl.meta.difficulty, lvl.seed)
    }
    setMode('play')
  }
  function openPauseMenu(): void {
    if (ui.isPauseMenuOpen) return
    pauseForModal()
    ui.showPauseMenu({
      onResume: () => resumeFromModal(),
      onRestart: () => { resumeFromModal(); restartLevel() },
      onMenu: () => { resumeFromModal(); exitToMenu() },
    })
  }

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
    // fit the path into the free area (avoiding legend/top-bar/HUD) → tidy at ANY board size.
    // Margin must cover the build-spot bracket art (pitch*0.62 half-size + glow), or edge-row
    // towers get clipped while background decor stays visible — framing is keyed to GAMEPLAY
    // (path + spots) only; decor never affects it and may clip freely.
    const padc = pitch * 0.9
    minX -= padc; minY -= padc; maxX += padc; maxY += padc
    const isMobile = view().w < 800
    const mL = isMobile ? 16 : 156
    const mR = isMobile ? 16 : 24
    // Two user rules, combined: (1) center vertically on the FULL viewport — the HUD is a
    // floating overlay, not a layout block; (2) NOTHING of the map (trace + pads) may hide
    // under that overlay. So: frame to the full viewport first, then clamp — shift down if
    // the content's top lands under the HUD, and shrink the fit only when shifting can't help
    // (tall boards like 60×45). Small boards stay perfectly screen-centered.
    const mT = 16
    const mB = 16
    const hudEl = document.querySelector('.pcb-tophud') as HTMLElement | null
    let overlayBottom = hudEl && hudEl.offsetHeight > 0 ? hudEl.offsetTop + hudEl.offsetHeight : 0
    // The next-wave strip floats right under the HUD and hides traces/pads too (user report).
    const previewEl = document.querySelector('.pcb-wavepreview') as HTMLElement | null
    if (previewEl && previewEl.offsetHeight > 0 && getComputedStyle(previewEl).display !== 'none') {
      overlayBottom = Math.max(overlayBottom, previewEl.offsetTop + previewEl.offsetHeight)
    }
    const hudBottom = overlayBottom + 6
    const aw = Math.max(100, view().w - mL - mR), ah = Math.max(100, view().h - mT - mB)
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY)
    let zoom = Math.max(0.1, Math.min(4, Math.min(aw / bw, ah / bh) * 0.99))
    let cy = mT + ah / 2 - ((minY + maxY) / 2) * zoom
    const contentTop = cy + minY * zoom
    if (contentTop < hudBottom) {
      const shift = hudBottom - contentTop
      const contentBottom = cy + maxY * zoom
      if (contentBottom + shift <= view().h - mB) {
        cy += shift // room below — just slide the board out from under the HUD
      } else {
        // no room — refit into the [hudBottom .. h-mB] band
        const ah2 = Math.max(100, view().h - hudBottom - mB)
        zoom = Math.max(0.1, Math.min(4, Math.min(aw / bw, ah2 / bh) * 0.99))
        cy = hudBottom + ah2 / 2 - ((minY + maxY) / 2) * zoom
      }
    }
    // cap zoom-out slightly beyond the start framing — zooming further out loses the board
    camera.minZoom = zoom * 0.9
    const cx = mL + aw / 2 - ((minX + maxX) / 2) * zoom
    // First framing (camera still at the default pose) teleports; later ones glide — the
    // level-load "settle" is one of the cheapest expensive-feeling moves available.
    if (camera.zoom === 1 && camera.x === 0 && camera.y === 0) camera.snapTo(cx, cy, zoom)
    else camera.glideTo(cx, cy, zoom)
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
    // Re-anchor the tutorial bubble/ring: frameLevel just moved the camera underneath them.
    // Delayed past the camera glide so the ring lands on the settled spot position.
    if (activeTutorial) setTimeout(() => { if (activeTutorial) runTutorialStep(tutorialStep) }, 450)
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
    achTracker?.dispose() // abandoned mid-run — no evaluation, just stop listening
    achTracker = null
    gameView?.destroy()
    gameView = null
    shake.reset() // drop leftover trauma/freeze so they don't bleed into the next level
    hitStop.reset()
    audioEngine.setSlowHum(false) // the ticker stops driving it once game=null — kill the drone here
    audioEngine.setMusicTension(0) // don't let boss/final-wave tension bleed into the next level
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
        console.error(err); void showAlert(i18n.t('editor.load_error'))
      }
    },
    onResize: (cols, rows) => { resetPlay(); ui.showTower(null, 0); applyBoard(cols, rows); frameLevel() },
  })

  function ensureGame() {
    if (!game && editor.state.level) {
      showTipsPanel() // tips dismissal is per-level: they return on every new level entry
      seenIntroCache = new Set() // per-run: intro cards return on every playthrough
      framedWithPreview = false // the next-wave strip isn't visible yet — re-frame once it is
      // Meta upgrades apply to campaign + endless; daily stays a level playing field
      // (everyone plays the same board with the same rules).
      const meta = dailyActive ? undefined : metaEffects(loadProgress().metaUpgrades)
      const mods = dailyActive ? dailyMods : null
      game = new Game(editor.state.level, ++seedCounter, {
        hpMul: PLAYER_DIFFICULTY_HP[loadPlayerDifficulty()] * (mods?.hpMul ?? 1),
        endless: endlessMode, meta,
        countMul: mods?.countMul, goldDelta: mods?.goldDelta, banned: mods?.banned,
      })
      achTracker?.dispose()
      achTracker = new AchievementTracker(game)
      gameView?.destroy() // defensive: resetPlay normally clears it, this guards any future path that skips it
      gameView = new GameView(app, renderer, game)
      // Normalized world X → gentle stereo pan (you can HEAR which side is breached).
      const worldX01 = (x: number): number => {
        const lvl = editor.state.level
        return lvl ? x / (lvl.board.cols * lvl.board.pitch) : 0.5
      }
      game.events.on((e) => {
        if (e.type === 'leak') audioEngine.playLeak()
        else if (e.type === 'enemyDied') audioEngine.playEnemyDeath(worldX01(e.pos.x))
        else if (e.type === 'shotFired') { if (e.kind !== 'slow') audioEngine.playShot(e.kind, worldX01(e.from.x)) }
        else if (e.type === 'enemySpawned' && e.kind === 'boss') {
          // Boss only appears on the final wave in this game, so tension jumps straight to max.
          audioEngine.playBossSpawn()
          audioEngine.setMusicTension(2)
        } else if (e.type === 'baseHit') audioEngine.playBaseAlarm()
      })
      game.events.on((e) => {
        if (e.type === 'baseHit') shake.add(0.35)
        else if (e.type === 'enemyDied') {
          if (e.kind === 'boss') { shake.add(0.6); hitStop.trigger(0.13) }
          else hitStop.trigger(0.05)
        } else if (e.type === 'projectileImpact' && e.kind === 'mortar') {
          shake.add(0.08)
          audioEngine.playExplosion(worldX01(e.pos.x))
        } else if (e.type === 'projectileImpact') {
          audioEngine.playImpact(worldX01(e.pos.x))
        }
      })
      game.events.on((e) => {
        if (e.type === 'waveStart') {
          const comp = [...waveComposition(game!.peekWave(e.index))].map(([kind, count]) => {
            const theme = enemyTheme(kind)
            return { name: theme.name, color: theme.color, count }
          })
          ui.showWaveBanner(e.index + 1, comp)
          audioEngine.playWaveStart()
          // Final wave (index 9, i.e. wave 10) carries the boss and ramps tension straight up;
          // any other wave start resets to normal.
          audioEngine.setMusicTension(e.index === 9 ? 2 : 0)
        } else if (e.type === 'waveEnd') {
          audioEngine.setMusicTension(0)
          // Mid-level save: persist the run at every build-phase boundary (campaign only).
          if (activeCampaignLevelIndex !== null && game) {
            const snap = game.snapshot()
            if (snap && snap.wave > 0) saveRun(activeCampaignLevelIndex, snap)
          }
        }
      })
      // Ability briefings on their DEBUT levels — every playthrough, like enemy intros.
      if (activeCampaignLevelIndex === 2 && !seenIntroCache.has('ability_discharge')) {
        seenIntroCache.add('ability_discharge')
        setTimeout(() => showAbilityIntroduction('discharge'), 600) // after the level frame settles
      }
      if (activeCampaignLevelIndex === 5 && !seenIntroCache.has('ability_overload')) {
        seenIntroCache.add('ability_overload')
        setTimeout(() => showAbilityIntroduction('overload'), 600)
      }
      // Resume an interrupted campaign run: rebuild towers/economy at the saved wave boundary.
      if (activeCampaignLevelIndex !== null) {
        const snap = loadRun(activeCampaignLevelIndex)
        if (snap && snap.wave > 0 && game.restore(snap)) {
          ui.showWaveBanner(snap.wave + 1, [])
        }
      }
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
  // Persisted like every other setting (it silently reset to ON each session before).
  let autoWaveEnabled = storageGet('pcb_td_autowave_v1') !== '0'
  /** Pre-endless auto-wave value; non-null only while an endless run forces it on. */
  let autoWaveBeforeEndless: boolean | null = null
  let waveCountdown = 0
  let countdownTimer: any = null
  const introducingEnemies = new Set<string>()
  // Intros are PER-RUN (user rule: every playthrough re-teaches, like the L1 tutorial):
  // a kind's card shows on its DEBUT level each time you enter it. Cleared in ensureGame().
  let seenIntroCache = new Set<string>()
  const DEBUT_LEVEL: Record<string, number> = {
    normal: 0, fast: 1, healer: 2, brute: 3, tank: 4, shielded: 5, rogue: 6, carrier: 7, fragment: 7, boss: 7,
  }

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
        if (!game.build(kind, spotIndex)) audioEngine.playError() // can't afford / spot taken
        else if (activeTutorial && tutorialStep === 1 && kind === 'cannon') {
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
    onUpgradeBranch: (b) => { if (game && selectedTower) { game.upgradeBranch(selectedTower, b); ui.showTower(selectedTower, game.sellValue(selectedTower)) } },
    onAbility: () => {
      if (!game || game.dischargeCooldown > 0 || game.state.phase !== 'wave') return
      armAbility('discharge')
    },
    onAbility2: () => {
      if (!game || game.overloadCooldown > 0 || game.state.phase !== 'wave') return
      armAbility('overload')
    },
    onSell: () => { if (game && selectedTower) { game.sell(selectedTower); selectedTower = null; ui.showTower(null, 0) } },
    onTargetMode: () => { if (selectedTower) { selectedTower.cycleTargetMode(); ui.showTower(selectedTower, game!.sellValue(selectedTower)) } },
    onMenu: () => {
      // MAP is the most expensive misclick in the game (kills a 20-min run) — it now routes
      // through the pause menu instead of leaving instantly. No game → straight to the map.
      if (game && game.state.phase !== 'win' && game.state.phase !== 'lose') openPauseMenu()
      else exitToMenu()
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
      storageSet('pcb_td_autowave_v1', val ? '1' : '0')
    },
    onOpenBestiary: () => {
      // Reading the bestiary must not cost lives — pause while it's open.
      pauseForModal()
      const progress = loadProgress()
      campaignMenu.showBestiary(progress.unlockedLevelIndex, () => { if (!ui.isPauseMenuOpen) resumeFromModal() })
    },
    onModalOpen: () => pauseForModal(),
    onModalClose: () => { if (!ui.isPauseMenuOpen) resumeFromModal() },
    onPreviewRange: (kind, spotIndex) => {
      // Range circle while choosing in the radial — buying blind was the touch UX hole.
      rangePreviewG.clear()
      if (!kind || !game) return
      const cell = game.spotCells()[spotIndex]
      if (!cell) return
      const pitch = editor.state.board.pitch
      const cx = cell[0] * pitch + pitch / 2, cy = cell[1] * pitch + pitch / 2
      const boost = game.isSpecial(spotIndex) ? 1.35 : 1
      const r = TOWER_DEFS[kind][0].range * pitch * boost
      const color = RANGE_PREVIEW_COLORS[kind]
      rangePreviewG.circle(cx, cy, r).fill({ color, alpha: 0.07 }).stroke({ color, width: 1.5, alpha: 0.55 })
    },
    onProgressImported: () => {
      // Imported save changes unlocks/intros: refresh the per-level cache and the menu.
      seenIntroCache = new Set(Object.keys(loadProgress().seenIntroductions ?? {}))
      if (activeCampaignLevelIndex === null && !game) campaignMenu.show()
    }
  })
  const gameBar = ui.mountHud()
  ui.setAutoWave(autoWaveEnabled)

  // Shared campaign-story overlay (POST-intro, per-level briefings, final log). One instance
  // reused across the whole session — show() tears down any previous run before mounting.
  const storyScreen = new StoryScreen()

  // "ЖУРНАЛ СМЕНЫ · ЗАПИСЬ NN" — shared by the pre-level briefing and the campaign map's
  // per-card "ЛОГ" replay button, so both read the exact same title.
  function briefTitle(index: number): string {
    return `${i18n.t('story.brief.title')} ${String(index + 1).padStart(2, '0')}`
  }

  // Queues up the POST-intro (level 0 only, once) and the per-level briefing (once per level),
  // then calls onDone. Progress flags are re-read/saved around each step so a mid-queue reload
  // can't lose the "seen" mark. No-ops straight to onDone once everything for this level is seen.
  function showStoryFor(index: number, onDone: () => void): void {
    // The FULL story plays on EVERY level entry (user rule): level 1 keeps its station
    // intro before the briefing, all levels replay their shift-log brief each time.
    const showBrief = () => {
      const story = CAMPAIGN_STORY.levels[index]
      if (!story) {
        onDone()
        return
      }
      storyScreen.show(story.brief, {
        title: briefTitle(index),
        onDone,
      })
    }
    if (index === 0) {
      storyScreen.show(CAMPAIGN_STORY.intro, {
        title: i18n.t('story.intro.title'),
        onDone: showBrief,
      })
    } else {
      showBrief()
    }
  }

  // Loads a campaign level and routes through its story briefing before calling onReady —
  // shared by level-select and the victory screen's "next level" path so neither can skip
  // the briefing overlay.
  function goToCampaignLevel(index: number, onReady: () => void): void {
    activeCampaignLevelIndex = index
    loadAuthoredOrGenerated(index)
    setMode('play')
    showStoryFor(index, onReady)
  }

  function enterCampaignLevel(index: number): void {
    audioEngine.init()
    if (audioEngine.isMuted()) {
      audioEngine.setMute(false)
    }
    audioEngine.playClick()

    campaignMenu.hide()

    // Tutorial only ever runs for level 0, and must start after the story overlay closes
    // (it points at on-canvas spots, which the fullscreen story overlay would sit on top of).
    goToCampaignLevel(index, () => {
      if (index === 0) {
        activeTutorial = new TutorialOverlay()
        activeTutorial.onSkip = () => {
          completeTutorial() // persists — the guided intro never comes back
          activeTutorial?.destroy()
          activeTutorial = null
        }
        setTimeout(() => {
          runTutorialStep(0)
        }, 100)
      } else {
        if (activeTutorial) {
          activeTutorial.destroy()
          activeTutorial = null
        }
      }
    })
  }

  // Same locale-neutral badges the radial menu shows — the ban must name the button players see.
  const TOWER_BADGE: Record<import('./game/towerTypes').TowerKind, string> =
    { cannon: 'PULSE', slow: 'SLOW', sniper: 'LASER', mortar: 'MISSILE', tesla: 'TESLA' }
  function dailyModsHtml(mods: DailyMods): string {
    const rows = mods.ids.map((id) => {
      let desc = i18n.tk(`daily.mod.${id}.desc`)
      if (id === 'embargo' && mods.banned) desc = desc.replace('{tower}', TOWER_BADGE[mods.banned])
      return `<div style="margin: 7px 0;"><span style="color: #f0c43a; font-weight: bold;">${i18n.tk(`daily.mod.${id}.name`)}</span> — <span style="color: #8fb3a0;">${desc}</span></div>`
    }).join('')
    return `<div style="font-weight: bold; color: #f0c43a; margin-bottom: 8px;">${i18n.t('daily.mods_title')}</div>
      <div>${i18n.t('daily.mods_intro')}</div>${rows}`
  }

  campaignMenu = new CampaignMenu({
    onEndless: () => {
      // Survival: the BIGGEST board at max difficulty; waves synthesize harder forever.
      // Auto-wave is forced on — endless is about tactics under pressure, not clicking START.
      campaignMenu.hide()
      endlessMode = true
      dailyActive = false
      dailyMods = null
      activeCampaignLevelIndex = null
      autoWaveBeforeEndless = autoWaveEnabled // forced ON is endless-only; restore on exit
      autoWaveEnabled = true
      ui.setAutoWave(true)
      // Day-fixed seed: everyone climbs the same endless board today — "wave 23" is comparable.
      makeLevel(60, 45, 9, 1 + (Number(dailyStamp()) % 99999))
      setMode('play')
    },
    onDaily: () => {
      // One shared seed per calendar day — everyone plays the same board with the same twist.
      campaignMenu.hide()
      endlessMode = false
      dailyActive = true
      dailyMods = rollDailyMods(dailyStamp())
      activeCampaignLevelIndex = null
      makeLevel(32, 24, 5, Number(dailyStamp()) % 100000)
      setMode('play')
      void showAlert(dailyModsHtml(dailyMods))
    },
    onSelectLevel: (index) => enterCampaignLevel(index),
    onShowLog: (index) => {
      audioEngine.playClick()
      // The FULL log: level 1 includes the station intro before its briefing.
      const lines = index === 0
        ? [...CAMPAIGN_STORY.intro, { key: 'story.blank' }, ...CAMPAIGN_STORY.levels[index].brief]
        : CAMPAIGN_STORY.levels[index].brief
      storyScreen.show(lines, {
        title: briefTitle(index),
        onDone: () => {},
      })
    }
  })

  // --- explicit mode switch: Editor (author/generate/save levels) vs Play (towers + waves) ---
  function setMode(m: 'edit' | 'play'): void {
    if (m === 'play') {
      const lvl = editor.state.level
      if (!lvl || (lvl.paths?.[0]?.waypoints.length ?? lvl.trace.waypoints.length) < 2) {
        void showAlert(i18n.t('editor.alert')); return
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
  mountUi(seedLabel)

  // start from ?t=COLSxROWS.DIFF.SEED if present (reproducible), else show campaign selector
  // Back to the campaign menu via a clean reload. Must stay relative: on itch.io the game
  // lives deep under a CDN path, so an absolute '/' would leave the game entirely.
  function exitToRoot(): void {
    location.href = location.pathname.replace(/(editor|new)\/?$/, '') || './'
  }

  const params = new URLSearchParams(location.search)
  const t = params.get('t')
  const m = t && /^(\d+)x(\d+)\.(\d+)\.(\d+)$/.exec(t)
  // Modes are query-based (?mode=editor|new) so they survive subpath hosting (itch.io CDN);
  // the pathname variants remain as dev-server conveniences (/editor, /new have own entries).
  const modeParam = params.get('mode')
  const isEditor = modeParam === 'editor' || location.pathname.replace(/\/+$/, '').endsWith('/editor')
  const isNew = modeParam === 'new' || location.pathname.replace(/\/+$/, '').endsWith('/new')

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
    modeBtn(i18n.t('mode.play'), 'pcb-mode-btn-play', () => { exitToRoot() })
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
      // Cold boot on the root path: the retro-monitor title screen. START plays the CRT
      // collapse; a fresh save then gets the comic prologue and drops straight into level 1,
      // a veteran goes to the campaign map.
      const progress0 = loadProgress()
      const freshSave = progress0.unlockedLevelIndex === 0 && !(progress0.stars[0] || 0)
      // The comic prologue plays on EVERY cold boot (user rule — same as per-run intros);
      // one click reveals all panels, NEXT skips on through.
      new TitleScreen().show({
        showComic: true,
        onDone: () => {
          if (freshSave) enterCampaignLevel(0)
          else campaignMenu.show()
        },
      })
    }
  }
  mountUi(modeBar)

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

    // Armed ability: the next board click fires it instead of selecting.
    if (armedAbility) {
      const which = armedAbility
      armedAbility = null
      document.body.classList.remove('pcb-aiming')
      aimCircleG.visible = false
      const r = app.canvas.getBoundingClientRect()
      const wx = (e.clientX - r.left - camera.x) / camera.zoom
      const wy = (e.clientY - r.top - camera.y) / camera.zoom
      if (which === 'discharge') {
        if (game.useDischarge({ x: wx, y: wy })) {
          audioEngine.playExplosion()
          shake.add(0.25)
        }
      } else if (game.useOverload({ x: wx, y: wy })) {
        audioEngine.playUpgrade()
      }
      updateDischargeButton()
      return
    }

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
    // If the tutorial bubble was hidden for the ring and no chip was built, bring it back.
    if (activeTutorial && tutorialStep === 1) runTutorialStep(1)

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
      ui.openRadialMenu(bestI, clientX, clientY, game.state.gold, activeTutorial && tutorialStep === 1 ? 'cannon' : undefined, !activeTutorial, game.banned)
      // The instruction bubble sits right next to the pad — hide it while the chip ring is
      // open so they never overlap; it comes back if the ring closes without a build.
      if (activeTutorial && tutorialStep === 1) activeTutorial.hide()
    } else {
      const t = game.towers.find((tw) => Math.hypot(tw.pos.x - wx, tw.pos.y - wy) <= pitch)
      selectedTower = t ?? null
      ui.showTower(selectedTower, selectedTower ? game.sellValue(selectedTower) : 0)
      // Teachable moments, first occurrence only (tutorial handles L1 basics; these add depth).
      if (selectedTower && !activeTutorial) {
        showHint(selectedTower.canBranch ? 'branch' : 'upgrade')
      }
    }
  }

  let lastPhase: string | null = null

  // game loop on the Pixi ticker
  // ------------------------------------------------------------ hotkeys
  // Desktop keyboard layer. Guards: typing fields, story terminal (it owns its own keys),
  // enemy-intro modal. Esc unwinds the TOP layer only: settings → pause → radial → selection.
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
    if (document.querySelector('.pcb-story-overlay')) return // StoryScreen handles its own keys
    if (e.code === 'Escape') {
      if (ui.isSettingsOpen) { ui.closeSettings(); return }
      if (ui.isPauseMenuOpen) { ui.hidePauseMenu(); resumeFromModal(); return }
      if (armedAbility) { armedAbility = null; document.body.classList.remove('pcb-aiming'); updateDischargeButton(); return }
      if (ui.isRadialOpen) { ui.closeRadialMenu(); return }
      if (selectedTower) { selectedTower = null; ui.showTower(null, 0); return }
      if (game && game.state.phase !== 'win' && game.state.phase !== 'lose') openPauseMenu()
      return
    }
    if (!game) return
    switch (e.code) {
      case 'Space':
        e.preventDefault() // Space scrolls / re-triggers focused buttons otherwise
        if (game.speed === 0) { game.speed = selectedSpeed; ui.selectSpeed(selectedSpeed) }
        else { selectedSpeed = game.speed; game.speed = 0; ui.selectSpeed(0) }
        break
      case 'Digit1': selectedSpeed = 1; game.speed = 1; ui.selectSpeed(1); break
      case 'Digit2': selectedSpeed = 2; game.speed = 2; ui.selectSpeed(2); break
      case 'Digit3':
      case 'Digit4': selectedSpeed = 4; game.speed = 4; ui.selectSpeed(4); break
      case 'Enter': onStartWaveClick(); break
      case 'KeyU':
        if (selectedTower) {
          if (selectedTower.canBranch) break // branch choice must be a deliberate click
          game.upgrade(selectedTower)
          ui.showTower(selectedTower, game.sellValue(selectedTower))
        }
        break
      case 'KeyM': audioEngine.toggleMute(); break
      case 'KeyQ':
        if (game.dischargeCooldown === 0 && game.state.phase === 'wave' && abilityUnlocked()) armAbility('discharge')
        break
      case 'KeyW':
        if (game.overloadCooldown === 0 && game.state.phase === 'wave' && overloadUnlocked()) armAbility('overload')
        break
    }
  })

  let ambientClock = 0
  // Tutorial anchors live in screen space: any camera motion (glide, clamp, resize) leaves the
  // ring/bubble stranded at stale coordinates. Track the pose per frame and re-run the current
  // step ONCE, the frame the camera comes to rest.
  let lastCamX = NaN, lastCamY = NaN, lastCamZoom = NaN // camera-pose diff without per-frame string alloc
  let camWasMoving = false
  let liveAchClock = 0 // throttle accumulator for mid-run achievement toasts
  let earlyCallReadyAt: number | null = null // performance.now() when the early call lit up (instant_call)
  const shakeCenter = { x: 0, y: 0 } // reused each frame for shake.applyTo (no per-frame alloc)
  // Adaptive quality: sustained low FPS auto-enables reduced effects (once). Skip if the user is
  // already running reduced — nothing left to drop.
  const perfMonitor = new PerfMonitor({
    onDegrade: () => {
      setReducedFx(true)
      ui.syncReducedFx?.(true) // keep the settings checkbox honest
      showInfoToast(i18n.t('perf.degraded.title'), i18n.t('perf.degraded.body'), '⚙')
    },
  })
  app.ticker.add((ticker) => {
    const rawDt = ticker.deltaMS / 1000
    // Only judge FPS during active combat (menus/build phase idle low is meaningless) and only
    // while effects are still on — once reduced, there's nothing more to shed.
    if (!juice.reducedFx && game && game.state.phase === 'wave') perfMonitor.sample(rawDt)
    ambientClock += rawDt
    renderer.updateAmbient(ambientClock)
    // Free build spots "breathe" during the build phase; steady during combat (distraction).
    renderer.layers.spot.alpha = !game || game.state.phase === 'build'
      ? 0.82 + 0.18 * Math.sin(ambientClock * 2.2)
      : 1
    // Camera glide must advance even with no game running (level-load settle, menu → level).
    camera.update(rawDt)
    // Pose diff via cheap numeric epsilons (matches the old 0.1px / 0.001zoom string precision)
    // — no per-frame template-string + 3× toFixed allocation.
    const moved = Math.abs(camera.x - lastCamX) >= 0.05
      || Math.abs(camera.y - lastCamY) >= 0.05
      || Math.abs(camera.zoom - lastCamZoom) >= 0.0005
    if (moved) {
      camWasMoving = true
    } else if (camWasMoving) {
      camWasMoving = false
      if (activeTutorial) runTutorialStep(tutorialStep)
    }
    lastCamX = camera.x; lastCamY = camera.y; lastCamZoom = camera.zoom
    if (!game) {
      camera.apply(renderer.world)
      lastPhase = null
      return
    }
    const simDt = hitStop.filter(rawDt)
    game.tick(simDt)
    achTracker?.frame(simDt) // advance micro-moment detectors (quick-sell clock, slow streaks, AOE bursts)
    // Live achievements: pop a toast the instant one triggers mid-run (climax moments — boss
    // down, discharge streaks — land while you play, not buried in the end-of-run list).
    // Throttled to ~2 Hz; only the `live`-flagged defs run, so won/lifetime ones never fire early.
    liveAchClock += rawDt
    if (achTracker && game.state.phase === 'wave' && liveAchClock >= 0.5) {
      liveAchClock = 0
      const fresh = evaluateAchievements({
        game, tracker: achTracker, won: false,
        levelIndex: activeCampaignLevelIndex, endless: endlessMode, daily: dailyActive,
        endlessWave: game.state.wave + 1, profile: EMPTY_STATS,
      }, true)
      if (fresh.length > 0) showAchievementToasts(fresh)
    }
    updateDischargeButton()
    audioEngine.setSlowHum(game.state.phase === 'wave' && game.towers.some((t) => t.kind === 'slow'))
    audioEngine.setAmbient(game.state.phase === 'build')
    gameView?.update(rawDt, selectedTower)
    ui.update(game, editor.state.level?.meta.difficulty ?? 1)
    if (!framedWithPreview) {
      const previewEl = document.querySelector('.pcb-wavepreview') as HTMLElement | null
      if (previewEl && previewEl.offsetHeight > 0 && getComputedStyle(previewEl).display !== 'none') {
        framedWithPreview = true
        frameLevel() // now the clamp can see the strip's real height
      }
    }
    camera.apply(renderer.world)
    // camera.apply resets position/scale but not rotation, so zero it before the additive shake
    // to keep residual rotation from accumulating across frames.
    renderer.world.rotation = 0
    shake.update(rawDt)
    // Reuse a scratch center object + inline the portrait swap — no per-frame {w,h}/{x,y} allocs.
    const portrait = window.innerWidth < window.innerHeight
    shakeCenter.x = (portrait ? window.innerHeight : window.innerWidth) / 2
    shakeCenter.y = (portrait ? window.innerWidth : window.innerHeight) / 2
    shake.applyTo(renderer.world, shakeCenter)

    if (game.state.phase === 'wave') {
      const activeEnemies = game.enemies()

      // Enemy introductions are part of onboarding → trigger on any campaign level (activeCampaignLevelIndex !== null)
      // the first time that specific enemy type is encountered. seenIntroCache mirrors
      // progress.seenIntroductions — never re-read storage in the frame loop.
      const newEnemy = activeCampaignLevelIndex !== null ? activeEnemies.find(e => {
        const k = e.kind
        return DEBUT_LEVEL[k] === activeCampaignLevelIndex && !seenIntroCache.has(k) && !introducingEnemies.has(k)
      }) : undefined

      if (newEnemy) {
        const kind = newEnemy.kind
        introducingEnemies.add(kind)

        // Pause game ticks
        game.speed = 0
        
        // NO camera movement: the popup shows the enemy portrait, and new signals always emerge
        // from the spawn anyway — panning the screen back and forth is just jarring.

        // Reset countdown timer
        if (countdownTimer) {
          clearInterval(countdownTimer)
          countdownTimer = null
        }
        waveCountdown = 0
        updateStartWaveButtonText()

        showEnemyIntroduction(kind, () => {
          seenIntroCache.add(kind)
          introducingEnemies.delete(kind)

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
      clearRun() // the run ended either way — never resume INTO a finished/lost level

      // Lifetime dossier + achievements. Record the run now (cumulative checks need fresh
      // totals), but EVALUATE deferred — registerVictory below must bank the new star first
      // (all_stars reads the save), and `game` is nulled at the end of this block.
      if (achTracker) {
        const tracker = achTracker
        achTracker = null
        tracker.dispose()
        const endedGame = game
        const levelIndex = activeCampaignLevelIndex
        const wasEndless = endlessMode
        const wasDaily = dailyActive
        const endlessWave = wasEndless ? endedGame.state.wave + 1 : 0
        const profile = recordRun({
          won,
          kills: endedGame.runStats.kills,
          leaks: endedGame.runStats.leaks,
          goldEarned: endedGame.runStats.goldEarned,
          builds: Object.fromEntries(tracker.builtKinds),
          killsByEnemy: tracker.killsByEnemy,
          discharges: tracker.discharges,
          branches: tracker.branches,
          endlessWave,
          daily: wasDaily,
        })
        // Delay also clears the victory/defeat stinger so toasts don't fight the overlay slam.
        setTimeout(() => {
          const fresh = evaluateAchievements({
            game: endedGame, tracker, won,
            levelIndex, endless: wasEndless, daily: wasDaily, endlessWave, profile,
          })
          showAchievementToasts(fresh)
        }, 900)
      }
      // Debrief highlight: the tower that actually carried the run.
      const carried = game.towers.reduce<{ kind: import('./game/towerTypes').TowerKind; damage: number } | null>(
        (best, t) => (t.damageDealt > (best?.damage ?? 0) ? { kind: t.kind, damage: t.damageDealt } : best), null)
      ui.setRunStats({
        ...game.runStats,
        wave: game.state.endless ? game.state.wave + 1 : Math.min(game.state.wave + 1, game.state.waveCount),
        waveCount: game.state.endless ? Infinity : game.state.waveCount,
        bestTower: carried,
      })
      if (endlessMode && !won) {
        // Endless score = the wave you fell on; keep the best.
        const reached = game.state.wave + 1
        const prev = Number(storageGet('pcb_td_endless_best_v1') ?? '0')
        if (reached > prev) storageSet('pcb_td_endless_best_v1', String(reached))
      }
      if (dailyActive && won) {
        const key = `pcb_td_daily_${dailyStamp()}`
        const prev = Number(storageGet(key) ?? '-1')
        if (game.state.lives > prev) storageSet(key, String(game.state.lives))
        recordDailyWin(dailyStamp()) // streak feed — one entry per calendar day
      }
      // Wordle-style share line for the social modes; campaign runs don't get one.
      if (dailyActive || endlessMode) {
        const st = dailyStamp()
        const date = `${st.slice(0, 4)}-${st.slice(4, 6)}-${st.slice(6, 8)}`
        const wave = game.state.wave + 1
        const modLine = dailyMods ? dailyMods.ids.map((id) => i18n.tk(`daily.mod.${id}.name`)).join(' + ') : ''
        ui.setShareText(dailyActive
          ? `PCB TD · ${i18n.t('mode.daily').replace('📅 ', '')} ${date}\n${modLine}\n${won
              ? `✅ ❤${game.state.lives}`
              : `❌ ${i18n.t('result.reached_wave').replace('{n}', String(wave)).replace('{m}', String(game.state.waveCount))}`}`
          : `PCB TD · ${i18n.t('mode.endless').replace('∞ ', '')} ${date}\n🌊 ${wave}`)
      } else {
        ui.setShareText(null)
      }

      if (won) {
        audioEngine.playVictory()
        if (activeCampaignLevelIndex !== null) {
          const res = registerVictory(activeCampaignLevelIndex, score)
          const hasNext = activeCampaignLevelIndex + 1 < CAMPAIGN_LEVELS.length
          // After L3 the player has real progress worth protecting — itch.io serves the game
          // from a CDN domain whose localStorage can be wiped. Nudge them (once) to copy the
          // save-code backup. Deferred past the victory slam so it doesn't fight the overlay.
          if (activeCampaignLevelIndex === 2) {
            setTimeout(() => showHint('backup'), 1400)
          }
          // Chime each earned star in sync with the pcb-star-earned CSS slam delay (0.15s * i).
          for (let i = 0; i < res.stars; i++) {
            setTimeout(() => audioEngine.playStar(), i * 150 + 200)
          }
          const st = CAMPAIGN_STORY.levels[activeCampaignLevelIndex] ?? null
          const debrief = st ? i18n.t(st.debriefKey as any) : undefined
          const isFinalLevel = activeCampaignLevelIndex === 11

          const openVictoryScreen = () => {
            ui.showVictoryScreen(
              res.stars,
              score,
              hasNext ? () => {
                ui.closeOverlay()
                goToCampaignLevel(activeCampaignLevelIndex! + 1, () => {})
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
              },
              debrief
            )
          }

          if (isFinalLevel) {
            // The finale replaces the usual per-level debrief with the full-screen final log
            // (twist reveal) — the ordinary victory screen only appears once it's closed.
            storyScreen.show(CAMPAIGN_STORY.final, {
              title: i18n.t('story.final.title'),
              onDone: openVictoryScreen,
            })
          } else {
            openVictoryScreen()
          }
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
              exitToRoot()
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
              exitToRoot()
            }
          }
        )
      }
      game = null
    }
  })

  /** New-enemy briefings BEFORE the wave launches: chained intro cards for every unseen kind
   * in the upcoming wave, then `proceed`. Mid-combat popups broke the flow — the ticker-based
   * detector remains only as a fallback for kinds born mid-wave (carrier fragments). */
  function introduceUpcoming(waveIndex: number, proceed: () => void): void {
    if (!game || activeCampaignLevelIndex === null) { proceed(); return }
    // Only kinds that DEBUT on this level get a card — and they get it on every playthrough.
    const fresh = [...waveComposition(game.peekWave(waveIndex)).keys()]
      .filter((k) => DEBUT_LEVEL[k] === activeCampaignLevelIndex && !seenIntroCache.has(k) && !introducingEnemies.has(k))
    if (fresh.length === 0) { proceed(); return }
    const showNext = (i: number): void => {
      if (i >= fresh.length) { proceed(); return }
      const kind = fresh[i]
      introducingEnemies.add(kind)
      showEnemyIntroduction(kind, () => {
        seenIntroCache.add(kind)
        introducingEnemies.delete(kind)
        showNext(i + 1)
      })
    }
    showNext(0)
  }

  function onStartWaveClick() {
    ensureGame()
    if (!game) return

    // Mid-wave early call: as soon as the spawner is done, the NEXT wave can be summoned onto
    // the tail of the current one — for the FULL early bonus (the countdown after a wave ends
    // only decays it). Big maps stop being a waiting game.
    if (game.state.phase === 'wave') {
      if (!game.canCallNextWave()) return
      // instant_call measured at the CLICK (not the post-intro summon — reading time must not
      // disqualify a snap decision).
      const clickedInstantly = earlyCallReadyAt !== null && performance.now() - earlyCallReadyAt <= 1000
      // Brief unseen kinds first, with the battle paused — then summon.
      const prevSpeed = game.speed
      if (game.speed > 0) game.speed = 0
      introduceUpcoming(game.state.wave + 1, () => {
        if (!game) return
        game.speed = prevSpeed
        if (!game.canCallNextWave()) return
        const bonus = game.earlyCallBonus() // the sim banks it inside callNextWave
        if (game.callNextWave()) {
          if (achTracker && clickedInstantly) achTracker.instantCall = true
          audioEngine.playUpgrade()
          showFloatingBonusText(bonus)
          ui.update(game, editor.state.level?.meta.difficulty ?? 1)
        }
      })
      return
    }
    if (game.state.phase !== 'build') return

    // Freeze the early-start bonus BEFORE any intro cards (reading time must not eat it),
    // then brief, then launch. Bonus scales with wave number so the risk/reward stays
    // meaningful late game (up to ~5s × (6+wave) energy for an instant restart).
    const frozenBonus = waveCountdown > 0 ? Math.ceil(waveCountdown) * (6 + (game?.state.waveNumber ?? 1)) : 0
    if (countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
    waveCountdown = 0
    updateStartWaveButtonText()

    introduceUpcoming(game.state.wave, () => {
      if (!game || game.state.phase !== 'build') return
      if (frozenBonus > 0) {
        game.state.add(frozenBonus)
        audioEngine.playUpgrade() // nice positive sound for bonus!
        showFloatingBonusText(frozenBonus)
      }
      game.startWave()
      if (activeTutorial && tutorialStep === 3) {
        completeTutorial()
        activeTutorial.destroy()
        activeTutorial = null
      }
      ui.update(game, editor.state.level?.meta.difficulty ?? 1)
    })
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
          // ensureGame is a no-op without a level (e.g. the timer fired mid-exit) — guard.
          if (game) {
            game.startWave()
            ui.update(game, editor.state.level?.meta.difficulty ?? 1)
          }
        }
      } else {
        updateStartWaveButtonText()
      }
    }, 100)
  }

  function updateStartWaveButtonText() {
    const startBtn = document.querySelector('.next-wave-btn') as HTMLElement
    if (!startBtn) return
    // Mid-wave: the button becomes the early "summon next wave" call with its bonus preview.
    if (game && game.state.phase === 'wave') {
      if (game.canCallNextWave()) {
        startBtn.textContent = `${i18n.t('hud.next_wave')} +${5 * (6 + game.state.waveNumber)}⚡`
        if (earlyCallReadyAt === null) earlyCallReadyAt = performance.now() // stamp when it lights up
        if (!activeTutorial) showHint('earlycall') // first time the early call lights up
      } else {
        startBtn.textContent = i18n.t('hud.start_wave')
        earlyCallReadyAt = null // reset each wave — the availability window is per-wave
      }
      return
    }
    if (waveCountdown > 0) {
      startBtn.textContent = `${i18n.t('hud.start_wave')} (${Math.ceil(waveCountdown)})`
    } else {
      startBtn.textContent = i18n.t('hud.start_wave')
    }
  }

  function showFloatingBonusText(bonus: number) {
    const startBtn = document.querySelector('.next-wave-btn')
    if (!startBtn) return
    
    const el = document.createElement('div')
    el.className = 'pcb-floating-bonus'
    el.textContent = `+${bonus} ⚡`
    startBtn.appendChild(el)
    
    setTimeout(() => el.remove(), 1000)
  }

  /** First-unlock briefing for an active ability — same modal style as enemy intros. */
  function showAbilityIntroduction(which: 'discharge' | 'overload' = 'discharge'): void {
    const isDischarge = which === 'discharge'
    const color = isDischarge ? '#f0c43a' : '#36e0e0'
    const glyph = isDischarge ? '⚡' : icon('overload', 22)
    const kp = isDischarge ? 'ability.intro' : 'ability.overload.intro'
    const modal = document.createElement('div')
    modal.className = 'pcb-settings-modal'
    modal.style.display = 'flex'
    modal.innerHTML = `
      <div class="pcb-settings-card" style="border-color: ${color}; box-shadow: 0 0 30px ${color}40; max-width: 340px; text-align: center;">
        <h2 style="color: ${color}; letter-spacing: 2px;">${i18n.tk(`${kp}.title`)}</h2>
        <div style="margin: 14px auto; width: 52px; height: 52px; border-radius: 50%; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; color: ${color}; box-shadow: 0 0 14px ${color}80; font-size: 22px;">${glyph}</div>
        <div style="color: #fff; font-size: 12px; line-height: 1.5; margin-bottom: 10px;">${i18n.tk(`${kp}.desc`)}</div>
        <div style="color: #8fb3a0; font-size: 11px; line-height: 1.5; margin-bottom: 14px;">${i18n.tk(`${kp}.how`)}</div>
        <button class="pcb-hud-btn active" style="width: 100%; min-height: 40px;">${i18n.t('enemy.intro.ok')}</button>
      </div>`
    const btn = modal.querySelector('button') as HTMLButtonElement
    btn.onclick = () => {
      audioEngine.playClick()
      modal.remove()
      ui.pulseAbilityButton(isDischarge ? 1 : 2)
    }
    modal.onclick = (e) => { if (e.target === modal) btn.click() }
    mountUi(modal)
  }

  function showEnemyIntroduction(kind: string, onClose: () => void) {
    const modal = document.createElement('div')
    modal.className = 'pcb-settings-modal'
    modal.style.display = 'flex'

    const color = enemyColorHex(kind)
    const name = i18n.t(`enemy.${kind}` as any)
    const desc = i18n.t(`enemy.${kind}.desc` as any)
    const strat = i18n.t(`enemy.${kind}.strat` as any)

    modal.innerHTML = `
      <div class="pcb-settings-card" style="width: 360px; max-width: 90%; text-align: center; border-color: ${color}; box-shadow: 0 0 20px ${color}33;">
        <h2 style="color: ${color}; font-size: 14px; margin-bottom: 6px;">${i18n.t('enemy.intro.title')}</h2>
        
        <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin: 16px 0;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: ${color}22; border: 2px solid ${color}; box-shadow: 0 0 12px ${color}55; display: flex; align-items: center; justify-content: center; font-size: 20px;">
            ${enemyGlyphSvg(enemyTheme(kind).glyph, color)}
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
    mountUi(modal);

    const closeIntro = () => {
      audioEngine.playClick()
      modal.parentNode?.removeChild(modal)
      onClose()
    }
    ;(modal.querySelector('.close-intro-btn') as HTMLElement).onclick = closeIntro
    modal.onclick = (e) => { if (e.target === modal) closeIntro() }
  }

  // Boot finished — drop the HTML splash (it covered the whole screen while the bundle loaded).
  document.getElementById('pcb-loading')?.remove()
}

/** Fatal-error screen: without it any boot failure (WebGL unavailable/blocked, lost context)
 * leaves the player on a silent black page forever. Uses the pristine <body> API — it may run
 * before (or instead of) the appendChild monkey-patch inside boot(). */
function showFatalError(err: unknown): void {
  console.error('PCB TD boot failed:', err)
  if (document.getElementById('pcb-fatal')) return
  const el = document.createElement('div')
  el.id = 'pcb-fatal'
  el.style.cssText =
    'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;' +
    'justify-content:center;gap:16px;background:#0b1611;color:#2bd06a;' +
    "font-family:'JetBrains Mono',Menlo,monospace;text-align:center;padding:24px"
  const ru = navigator.language?.toLowerCase().startsWith('ru')
  el.innerHTML =
    `<div style="font-size:18px;letter-spacing:2px">${ru ? 'НЕ УДАЛОСЬ ЗАПУСТИТЬ ИГРУ' : 'FAILED TO START THE GAME'}</div>` +
    `<div style="font-size:12px;color:#8fb3a0;max-width:480px">${ru
      ? 'Нужен браузер с поддержкой WebGL. Попробуйте перезагрузить страницу или другой браузер.'
      : 'A WebGL-capable browser is required. Try reloading the page or a different browser.'}</div>` +
    `<button style="font:inherit;color:inherit;background:none;border:1px solid #2bd06a;padding:8px 24px;cursor:pointer" ` +
    `onclick="location.reload()">${ru ? 'ПЕРЕЗАГРУЗИТЬ' : 'RELOAD'}</button>`
  document.body.appendChild(el)
}

window.addEventListener('unhandledrejection', (e) => {
  // Only fatal while nothing is on screen yet — in-game promise noise must not nuke a running game.
  if (!document.querySelector('canvas')) showFatalError(e.reason)
})

boot().catch(showFatalError)
