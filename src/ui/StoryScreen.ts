// src/ui/StoryScreen.ts
// Fullscreen terminal-log overlay used for campaign story beats (POST-intro, per-level
// briefings/debriefs, the final log). Types out lines character-by-character, supports a
// "glitch" flicker effect on marked lines, and respects prefers-reduced-motion / juice.reducedFx
// by rendering everything instantly with no flicker.
import type { StoryLine } from '../story/campaignStory'
import { i18n } from './i18n'
import { juice } from '../render/juice/motion'
import { audioEngine } from './AudioEngine'

const CHAR_MS = 28
const PUNCT_PAUSE_MS = 220
const LINE_PAUSE_MS = 120
const GLITCH_INTERVAL_MS = 120
const GLITCH_CHARS = '§▓/0123456789'
const PUNCT_CHARS = new Set(['.', ':', '…'])

// StoryLine.key is a plain string (data-driven, defined outside the i18n dictionary type),
// while i18n.t() is typed to the RU dictionary's key union for autocomplete/typo-safety on
// call sites that use literal keys. Route dynamic story keys through this cast in one place.
function tKey(key: string): string {
  return i18n.t(key as Parameters<typeof i18n.t>[0])
}

function reducedMotionActive(): boolean {
  if (juice.reducedFx) return true
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface ResolvedLine {
  text: string
  glitch: boolean
  pauseMs: number
  el: HTMLDivElement
}

export class StoryScreen {
  private overlay: HTMLDivElement | null = null
  private column: HTMLDivElement | null = null
  private button: HTMLButtonElement | null = null
  private lines: ResolvedLine[] = []
  private typingTimer: number | null = null
  private glitchTimer: number | null = null
  private glitchedLine: ResolvedLine | null = null
  private typingDone = false
  private onDone: (() => void) | null = null

  private readonly handleClick = (): void => {
    this.advance()
  }

  private readonly handleKeydown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    e.preventDefault()
    // Enter/Space close once typing is done (keyboard path to the CONTINUE button);
    // any key fast-forwards while typing.
    if (this.typingDone && (e.key === 'Enter' || e.key === ' ')) { this.close(); return }
    this.advance()
  }

  show(lines: StoryLine[], opts: { title?: string; onDone: () => void; closeLabel?: string }): void {
    // A previous instance (if any) must be fully torn down before mounting a new one so timers
    // and listeners never leak or double-fire across overlapping show() calls.
    this.destroy()

    this.onDone = opts.onDone
    this.typingDone = false

    const overlay = document.createElement('div')
    overlay.className = 'pcb-story-overlay'
    this.overlay = overlay

    const column = document.createElement('div')
    column.className = 'pcb-story-column'
    this.column = column

    if (opts.title) {
      const titleEl = document.createElement('div')
      titleEl.className = 'pcb-story-title'
      titleEl.textContent = opts.title
      column.appendChild(titleEl)
    }

    this.lines = lines.map((line) => {
      const el = document.createElement('div')
      el.className = 'pcb-story-line'
      column.appendChild(el)
      return { text: tKey(line.key), glitch: !!line.glitch, pauseMs: line.pauseMs ?? 0, el }
    })

    const button = document.createElement('button')
    button.className = 'pcb-story-continue'
    button.textContent = `[ ${opts.closeLabel ?? i18n.t('story.continue')} ]`
    button.style.display = 'none'
    button.onclick = (e) => {
      e.stopPropagation()
      this.close()
    }
    this.button = button
    column.appendChild(button)

    overlay.appendChild(column)
    document.body.appendChild(overlay)

    overlay.addEventListener('click', this.handleClick)
    window.addEventListener('keydown', this.handleKeydown)

    if (reducedMotionActive()) {
      this.finishTyping()
    } else {
      this.typeNext(0, 0)
    }
  }

  /** Clicks only fast-forward the typing. Closing is explicit — the [CONTINUE] button (or
   * Enter/Space once typing is done); "click anywhere to dismiss" felt accidental. */
  private advance(): void {
    if (!this.typingDone) {
      this.finishTyping()
    }
    // typing already finished → do nothing; the button handles closing
  }

  private typeNext(lineIndex: number, charIndex: number): void {
    if (lineIndex >= this.lines.length) {
      this.onTypingComplete()
      return
    }
    const line = this.lines[lineIndex]
    if (charIndex >= line.text.length) {
      this.renderLine(line, line.text.length, false)
      if (line.text.trim().length > 0) audioEngine.playTerminalLine() // CR blip on non-blank lines
      this.typingTimer = window.setTimeout(() => this.typeNext(lineIndex + 1, 0), LINE_PAUSE_MS + line.pauseMs)
      return
    }
    this.renderLine(line, charIndex + 1, true)
    // DOS-teletype tick per printed glyph (spaces are silent, like a real print head gap)
    if (line.text[charIndex] !== ' ') audioEngine.playTerminalTick()
    this.scrollToBottom()
    const extra = PUNCT_CHARS.has(line.text[charIndex]) ? PUNCT_PAUSE_MS : 0
    this.typingTimer = window.setTimeout(() => this.typeNext(lineIndex, charIndex + 1), CHAR_MS + extra)
  }

  /** Skips straight to fully-typed text for every line (used by both reduced-motion and the
   * "finish instantly" interaction). */
  private finishTyping(): void {
    if (this.typingTimer !== null) {
      window.clearTimeout(this.typingTimer)
      this.typingTimer = null
    }
    for (const line of this.lines) this.renderLine(line, line.text.length, false)
    this.onTypingComplete()
  }

  private onTypingComplete(): void {
    this.typingDone = true
    if (this.button) this.button.style.display = ''
    this.scrollToBottom()
    if (!reducedMotionActive()) this.startGlitch()
  }

  private renderLine(line: ResolvedLine, charCount: number, showCursor: boolean): void {
    line.el.textContent = line.text.slice(0, charCount)
    if (showCursor) {
      const cursor = document.createElement('span')
      cursor.className = 'pcb-story-cursor'
      cursor.textContent = '▌'
      line.el.appendChild(cursor)
    }
  }

  private startGlitch(): void {
    const glitchLines = this.lines.filter((l) => l.glitch && l.text.length > 0)
    if (glitchLines.length === 0) return
    this.glitchTimer = window.setInterval(() => {
      // Revert whatever line was flickered on the previous tick before picking a new target.
      if (this.glitchedLine) {
        this.renderLine(this.glitchedLine, this.glitchedLine.text.length, false)
        this.glitchedLine = null
      }
      const line = glitchLines[Math.floor(Math.random() * glitchLines.length)]
      const count = Math.min(1 + Math.floor(Math.random() * 2), line.text.length)
      const positions = new Set<number>()
      while (positions.size < count) positions.add(Math.floor(Math.random() * line.text.length))
      const chars = line.text.split('')
      positions.forEach((p) => {
        chars[p] = GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]
      })
      line.el.textContent = chars.join('')
      this.glitchedLine = line
    }, GLITCH_INTERVAL_MS)
  }

  private scrollToBottom(): void {
    if (this.column) this.column.scrollTop = this.column.scrollHeight
  }

  private close(): void {
    const cb = this.onDone
    this.destroy()
    if (cb) cb()
  }

  destroy(): void {
    if (this.typingTimer !== null) {
      window.clearTimeout(this.typingTimer)
      this.typingTimer = null
    }
    if (this.glitchTimer !== null) {
      window.clearInterval(this.glitchTimer)
      this.glitchTimer = null
    }
    this.glitchedLine = null
    if (this.overlay) {
      this.overlay.removeEventListener('click', this.handleClick)
      this.overlay.remove()
      this.overlay = null
    }
    window.removeEventListener('keydown', this.handleKeydown)
    this.column = null
    this.button = null
    this.lines = []
    this.onDone = null
    this.typingDone = false
  }
}
