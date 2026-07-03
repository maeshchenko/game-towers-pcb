// Title screen + CRT power cycle + comic prologue. All procedural (CSS/inline-SVG, no assets):
// a retro terminal monitor shows "MIZHGAN GAMES presents — PCB TD [START]"; pressing START
// plays the classic CRT collapse, then the four-panel comic prologue "powers on" (Kingdom
// Rush style: panels pop in one by one on a single screen), then the game begins.
import { i18n } from './i18n'
import { audioEngine } from './AudioEngine'
import { mountUi } from './uiRoot'
import { comicPanelArt } from './comicArt'

export class TitleScreen {
  private root: HTMLElement | null = null

  /** Show the monitor. onStart fires AFTER the CRT-off animation.
   * showComic=true routes through the prologue first (fresh saves). */
  show(opts: { showComic: boolean; onDone(): void }): void {
    if (this.root) return
    const root = document.createElement('div')
    root.className = 'pcb-title-screen'
    root.innerHTML = `
      <div class="pcb-monitor">
        <div class="pcb-monitor-screen">
          <div class="pcb-title-presents">${i18n.t('title.presents')}</div>
          <div class="pcb-title-logo">PCB&nbsp;TD</div>
          <div class="pcb-title-sub">${i18n.t('title.tagline')}</div>
          <button class="pcb-title-start">[ ${i18n.t('title.start')} ]</button>
        </div>
        <div class="pcb-monitor-badge">MIZHGAN&nbsp;8000</div>
      </div>`
    mountUi(root)
    this.root = root
    const startBtn = root.querySelector('.pcb-title-start') as HTMLButtonElement
    startBtn.onclick = () => {
      audioEngine.playClick()
      const screen = root.querySelector('.pcb-monitor-screen') as HTMLElement
      screen.classList.add('crt-off') // classic collapse-to-a-line
      window.setTimeout(() => {
        if (opts.showComic) this.showComic(root, opts.onDone)
        else this.finish(opts.onDone)
      }, 620)
    }
  }

  private showComic(root: HTMLElement, onDone: () => void): void {
    const monitor = root.querySelector('.pcb-monitor') as HTMLElement
    monitor.remove()
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
