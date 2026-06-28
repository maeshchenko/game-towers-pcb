import type { Application } from 'pixi.js'
import { EditorState } from './EditorState'
import { Renderer } from '../render/Renderer'
import { Camera } from '../render/Camera'
import { snapToCell } from '../geom/grid'
import type { Board } from '../model/level'

export class Editor {
  state: EditorState
  private debounce: ReturnType<typeof setTimeout> | null = null

  private onPointerDown = (e: PointerEvent): void => {
    const w = this.worldFromEvent(e)
    this.state.addPoint(snapToCell(w, this.state.board.pitch))
    this.scheduleRecompute()
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (this.debounce) { clearTimeout(this.debounce); this.debounce = null }
      this.state.commitTrace(); this.redraw()
    }
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const r = this.app.canvas.getBoundingClientRect()
    this.camera.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 0.9)
    this.camera.apply(this.renderer.world)
  }

  constructor(private app: Application, private renderer: Renderer, private camera: Camera, board: Board, seed: number) {
    this.state = new EditorState(board, seed)
    this.bind()
  }

  private worldFromEvent(e: PointerEvent): { x: number; y: number } {
    const r = this.app.canvas.getBoundingClientRect()
    return { x: (e.clientX - r.left - this.camera.x) / this.camera.zoom, y: (e.clientY - r.top - this.camera.y) / this.camera.zoom }
  }

  private bind(): void {
    this.app.canvas.addEventListener('pointerdown', this.onPointerDown)
    window.addEventListener('keydown', this.onKeyDown)
    this.app.canvas.addEventListener('wheel', this.onWheel, { passive: false })
  }

  destroy(): void {
    this.app.canvas.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('keydown', this.onKeyDown)
    this.app.canvas.removeEventListener('wheel', this.onWheel)
    if (this.debounce) { clearTimeout(this.debounce); this.debounce = null }
  }

  private scheduleRecompute(): void {
    if (this.debounce) clearTimeout(this.debounce)
    this.debounce = setTimeout(() => { this.state.commitTrace(); this.redraw() }, 120)
  }

  redraw(): void {
    if (this.state.level) this.renderer.render(this.state.level)
    this.camera.apply(this.renderer.world)
  }
}
