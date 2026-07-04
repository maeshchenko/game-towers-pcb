// Title screen + comic prologue. All procedural (CSS/inline-SVG, no assets).
// The title IS a printed circuit board — the game's own world: copper traces converge from
// the screen edges onto a big IC package silkscreened "PCB TD"; enemy packets stream along
// the traces toward the chip. START is a gold contact pad. Pressing it fires a power surge
// through the traces, then the four-panel comic prologue pops in (fresh saves) or the game
// begins.
import { i18n } from './i18n'
import { audioEngine } from './AudioEngine'
import { mountUi } from './uiRoot'
import { comicPanelArt } from './comicArt'

// Octilinear traces (1200×675 viewBox) that end at the central chip's edge. The chip DOM
// card sits over the center, so every path terminates just under it.
const TRACES = [
  'M 0 150 H 250 L 330 230 H 380',
  'M 0 337 H 380',
  'M 0 530 H 240 L 320 450 H 380',
  'M 1200 190 H 950 L 875 265 H 820',
  'M 1200 337 H 820',
  'M 1200 495 H 945 L 870 420 H 820',
  'M 470 0 V 115 L 540 185 V 220',
  'M 730 0 V 140 L 665 205 V 220',
  'M 490 675 V 565 L 555 500 V 455',
  'M 712 675 V 590 L 650 528 V 455',
]
// Fainter background-copper decor traces — depth without noise.
const DECOR_TRACES = [
  'M 0 70 H 420 L 520 170', 'M 1200 90 H 800 L 700 190',
  'M 60 675 V 480 L 160 380', 'M 1140 675 V 470 L 1050 380',
  'M 250 0 V 90 L 180 160 V 300', 'M 980 0 V 110 L 1060 190 V 320',
]
const PACKET_COLORS = ['#ff4d4d', '#36e0e0', '#f0c43a', '#ff4d4d', '#c23bff', '#36e0e0']

function traceSvg(d: string): string {
  // Same halo recipe as the in-game trace renderer: wide dim stroke → mid glow → bright core.
  return `
    <path d="${d}" fill="none" stroke="#123f28" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <path d="${d}" fill="none" stroke="#1f8f4d" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
    <path d="${d}" fill="none" stroke="#2bd06a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
}

function boardSvg(): string {
  const traces = TRACES.map(traceSvg).join('')
  const decor = DECOR_TRACES.map((d) =>
    `<path d="${d}" fill="none" stroke="#5d4423" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`,
  ).join('')
  // Entry pads where traces leave the screen edge + vias on the bends.
  const pads = TRACES.map((d) => {
    const m = /M\s*([\d.]+)\s+([\d.]+)/.exec(d)!
    return `<circle cx="${m[1]}" cy="${m[2]}" r="7" fill="#0a130e" stroke="#b98a2e" stroke-width="2.2"/>`
  }).join('')
  // Streaming packets: enemy-colored dots riding the converging traces (SMIL; CSS hides
  // them under prefers-reduced-motion).
  const packets = PACKET_COLORS.map((color, i) => {
    const path = TRACES[[0, 2, 3, 5, 6, 9][i]]
    const dur = (5.5 + (i % 3) * 1.6).toFixed(1)
    const begin = (i * 1.15).toFixed(2)
    return `
      <g class="pcb-title-pkt">
        <circle r="7" fill="${color}" opacity="0.28">
          <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/>
        </circle>
        <circle r="3.2" fill="${color}">
          <animateMotion dur="${dur}s" begin="${begin}s" repeatCount="indefinite" path="${path}"/>
        </circle>
      </g>`
  }).join('')
  const fiducial = (x: number, y: number): string =>
    `<g stroke="#3f5748" stroke-width="1.4" fill="none" opacity="0.8">
       <circle cx="${x}" cy="${y}" r="7"/><path d="M ${x - 11} ${y} H ${x + 11} M ${x} ${y - 11} V ${y + 11}"/>
     </g>`
  return `
    <svg class="pcb-title-traces" viewBox="0 0 1200 675" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="titleGrid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#12241a" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1200" height="675" fill="url(#titleGrid)" opacity="0.55"/>
      ${decor}
      ${traces}
      ${pads}
      ${packets}
      ${fiducial(40, 40)}${fiducial(1160, 40)}${fiducial(40, 635)}${fiducial(1160, 635)}
    </svg>`
}

export class TitleScreen {
  private root: HTMLElement | null = null

  /** Show the board. onDone fires AFTER the power-surge transition.
   * showComic=true routes through the prologue first (fresh saves). */
  show(opts: { showComic: boolean; onDone(): void }): void {
    if (this.root) return
    const root = document.createElement('div')
    root.className = 'pcb-title-screen'
    root.innerHTML = `
      <div class="pcb-title-board">
        ${boardSvg()}
        <div class="pcb-title-chip">
          <div class="pcb-chip-notch"></div>
          <div class="pcb-title-presents">${i18n.t('title.presents')}</div>
          <div class="pcb-title-logo">PCB&nbsp;TD</div>
          <div class="pcb-title-sub">${i18n.t('title.tagline')}</div>
          <button class="pcb-title-start">[ ${i18n.t('title.start')} ]</button>
          <div class="pcb-title-lang" role="group" aria-label="Language / Язык">
            <button class="pcb-title-lang-btn lang-ru ${i18n.lang === 'ru' ? 'active' : ''}" data-lang="ru">RU</button>
            <button class="pcb-title-lang-btn lang-en ${i18n.lang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
          </div>
        </div>
        <div class="pcb-title-silk">MIZHGAN GAMES&nbsp;&nbsp;·&nbsp;&nbsp;MZG-8000&nbsp;&nbsp;·&nbsp;&nbsp;REV 2.6</div>
      </div>`
    mountUi(root)
    this.root = root

    // Language switch, right on the first screen. Swapping updates the title texts in place.
    const langBtns = Array.from(root.querySelectorAll('.pcb-title-lang-btn')) as HTMLButtonElement[]
    for (const btn of langBtns) {
      btn.onclick = (e) => {
        e.stopPropagation() // don't trigger the comic/board click handlers
        const next = btn.dataset.lang as 'ru' | 'en'
        if (i18n.lang === next) return
        i18n.lang = next
        audioEngine.playClick()
        for (const b of langBtns) b.classList.toggle('active', b.dataset.lang === next)
        this.retranslate(root)
      }
    }

    const startBtn = root.querySelector('.pcb-title-start') as HTMLButtonElement
    startBtn.onclick = () => {
      audioEngine.playClick()
      root.classList.add('power-surge') // traces flare, the chip flashes and fades
      window.setTimeout(() => {
        if (opts.showComic) this.showComic(root, opts.onDone)
        else this.finish(opts.onDone)
      }, 620)
    }
  }

  /** Refresh the localized title texts after a language swap (board isn't rebuilt). */
  private retranslate(root: HTMLElement): void {
    const set = (sel: string, text: string) => {
      const el = root.querySelector(sel)
      if (el) el.textContent = text
    }
    set('.pcb-title-presents', i18n.t('title.presents'))
    set('.pcb-title-sub', i18n.t('title.tagline'))
    set('.pcb-title-start', `[ ${i18n.t('title.start')} ]`)
  }

  private showComic(root: HTMLElement, onDone: () => void): void {
    root.classList.remove('power-surge')
    const board = root.querySelector('.pcb-title-board') as HTMLElement
    board.remove()
    const comic = document.createElement('div')
    comic.className = 'pcb-comic crt-on'
    comic.innerHTML = `
      <div class="pcb-comic-grid">
        ${[0, 1, 2, 3].map((n) => `
          <div class="pcb-comic-panel" data-panel="${n}">
            ${comicPanelArt(n)}
            <div class="pcb-comic-caption">${i18n.tk(`comic.${n + 1}`)}</div>
          </div>`).join('')}
      </div>
      <div class="pcb-comic-hint">${i18n.t('comic.click')}</div>
      <button class="pcb-hud-btn active pcb-comic-next">${i18n.t('tutorial.next')}</button>`
    root.appendChild(comic)
    // Player-paced: the first panel shows at once, every CLICK reveals the next one
    // (user rule); the hint line swaps for the NEXT button after the last panel.
    const panels = Array.from(comic.querySelectorAll('.pcb-comic-panel')) as HTMLElement[]
    const nextBtn = comic.querySelector('.pcb-comic-next') as HTMLButtonElement
    const hint = comic.querySelector('.pcb-comic-hint') as HTMLElement
    nextBtn.style.display = 'none'
    let revealed = 0
    const revealNext = () => {
      if (revealed >= panels.length) return
      panels[revealed].classList.add('shown')
      audioEngine.playTerminalLine()
      revealed += 1
      if (revealed >= panels.length) {
        hint.style.display = 'none'
        nextBtn.style.display = ''
      }
    }
    revealNext() // panel 1 is on screen immediately
    comic.onclick = (e) => {
      if (e.target === nextBtn) return
      revealNext()
    }
    nextBtn.onclick = () => {
      audioEngine.playClick()
      this.finish(onDone)
    }
  }

  private finish(onDone: () => void): void {
    this.root?.remove()
    this.root = null
    onDone()
  }
}
