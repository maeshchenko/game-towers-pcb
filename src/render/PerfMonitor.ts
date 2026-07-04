// Adaptive-quality watchdog. Samples frame times, and when the smoothed FPS stays below a
// floor for a sustained window it fires onDegrade ONCE — the caller drops effects (reducedFx).
// Pure and deterministic: no clocks, the game loop feeds it dt. Framework-free so it's testable
// headless.

export interface PerfMonitorOpts {
  /** Smoothed FPS at or below this counts as "struggling". Default 45. */
  floorFps?: number
  /** Seconds of continuous struggling before degrading. Default 4. */
  sustainSec?: number
  /** EMA smoothing factor for instantaneous FPS (0..1, higher = snappier). Default 0.1. */
  smoothing?: number
  /** Ignore frames longer than this (tab-switch / GC stalls, not steady-state lag). Default 0.5 s. */
  spikeCutoff?: number
  /** Called once, the first time sustained low FPS is detected. */
  onDegrade: () => void
}

export class PerfMonitor {
  private readonly floorFps: number
  private readonly sustainSec: number
  private readonly smoothing: number
  private readonly spikeCutoff: number
  private readonly onDegrade: () => void

  private ema = 60 // start optimistic so a cold first frame doesn't trip it
  private lowFor = 0 // seconds spent continuously below the floor
  private fired = false

  constructor(opts: PerfMonitorOpts) {
    this.floorFps = opts.floorFps ?? 45
    this.sustainSec = opts.sustainSec ?? 4
    this.smoothing = opts.smoothing ?? 0.1
    this.spikeCutoff = opts.spikeCutoff ?? 0.5
    this.onDegrade = opts.onDegrade
  }

  /** Smoothed FPS estimate (for HUD/telemetry). */
  get fps(): number { return this.ema }
  get degraded(): boolean { return this.fired }

  /** Feed one frame's delta (seconds). */
  sample(dt: number): void {
    if (this.fired) return
    // A single huge frame (alt-tab, breakpoint, first paint) is not steady-state lag — skip it
    // AND reset the streak so a stall doesn't count toward the sustain window.
    if (dt <= 0 || dt > this.spikeCutoff) { this.lowFor = 0; return }
    const instFps = 1 / dt
    this.ema += (instFps - this.ema) * this.smoothing
    if (this.ema <= this.floorFps) {
      this.lowFor += dt
      if (this.lowFor >= this.sustainSec) {
        this.fired = true
        this.onDegrade()
      }
    } else {
      this.lowFor = 0
    }
  }
}
