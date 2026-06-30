// src/ui/AudioEngine.ts
import type { TowerKind } from '../game/towerTypes'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private enabled = false
  private scheduleTimer: any = null
  private nextNoteTime = 0
  private step = 0

  // Cyberpunk bassline notes: C2, Eb2, G2, F2
  private bassline = [65.41, 65.41, 77.78, 77.78, 98.00, 98.00, 87.31, 87.31]
  // Synth melody arpeggios
  private melody = [130.81, 155.56, 196.00, 233.08, 261.63, 233.08, 196.00, 155.56]

  constructor() {}

  init(): void {
    if (this.ctx) return
    const Win = typeof window !== 'undefined' ? window : null as any
    const AudioCtx = Win ? (Win.AudioContext || Win.webkitAudioContext) : null
    if (AudioCtx) {
      try {
        this.ctx = new AudioCtx()
      } catch (e) {
        console.warn('Web Audio Context initialization failed:', e)
      }
    }
  }

  setMute(mute: boolean): void {
    this.init()
    this.enabled = !mute
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume()
      }
    }
    if (this.enabled) {
      this.startMusic()
    } else {
      this.stopMusic()
    }
  }

  toggleMute(): boolean {
    this.setMute(this.enabled)
    return !this.enabled
  }

  isMuted(): boolean {
    return !this.enabled
  }

  private startMusic(): void {
    if (!this.ctx || this.scheduleTimer) return
    this.nextNoteTime = this.ctx.currentTime
    this.step = 0
    
    const scheduler = () => {
      if (!this.ctx) return
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        this.scheduleNextNote(this.step, this.nextNoteTime)
        // 120 BPM: 8th notes are 0.25 seconds
        this.nextNoteTime += 0.25
        this.step = (this.step + 1) % 16
      }
    }
    this.scheduleTimer = setInterval(scheduler, 100)
  }

  private stopMusic(): void {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer)
      this.scheduleTimer = null
    }
  }

  private scheduleNextNote(step: number, time: number): void {
    if (!this.ctx || !this.enabled) return
    
    // Play bass line notes
    if (step % 2 === 0) {
      const bassFreq = this.bassline[(step / 2) % this.bassline.length]
      this.playSynthNode(bassFreq, 'sawtooth', 0.03, 0.24, time)
    }

    // Play subtle synth arpeggios
    if (step % 4 === 1 || step % 4 === 3) {
      const melFreq = this.melody[step % this.melody.length]
      this.playSynthNode(melFreq, 'triangle', 0.02, 0.12, time)
    }
  }

  private playSynthNode(freq: number, type: OscillatorType, volume: number, duration: number, time: number): void {
    if (!this.ctx || !this.enabled) return
    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = type
      osc.frequency.setValueAtTime(freq, time)
      
      gain.gain.setValueAtTime(volume, time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
      
      osc.start(time)
      osc.stop(time + duration)
    } catch (e) {
      // noop
    }
  }

  // --- SFX SYNTHS ---
  playClick(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, t)
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.04)

      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)

      osc.start(t)
      osc.stop(t + 0.04)
    } catch (e) {}
  }

  playBuild(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const playTone = (freq: number, delay: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'square'
        osc.frequency.setValueAtTime(freq, t + delay)

        gain.gain.setValueAtTime(0.05, t + delay)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.06)

        osc.start(t + delay)
        osc.stop(t + delay + 0.06)
      }
      playTone(180, 0)
      playTone(360, 0.05)
    } catch (e) {}
  }

  playUpgrade(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const playTone = (freq: number, delay: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, t + delay)

        gain.gain.setValueAtTime(0.08, t + delay)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.08)

        osc.start(t + delay)
        osc.stop(t + delay + 0.08)
      }
      playTone(300, 0)
      playTone(450, 0.06)
      playTone(600, 0.12)
    } catch (e) {}
  }

  playSell(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(400, t)
      osc.frequency.exponentialRampToValueAtTime(100, t + 0.18)

      gain.gain.setValueAtTime(0.06, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)

      osc.start(t)
      osc.stop(t + 0.18)
    } catch (e) {}
  }

  playShot(kind: TowerKind): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      if (kind === 'cannon') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(450, t)
        osc.frequency.exponentialRampToValueAtTime(120, t + 0.09)

        gain.gain.setValueAtTime(0.12, t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)

        osc.start(t)
        osc.stop(t + 0.09)
      } else if (kind === 'sniper') {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(800, t)
        osc.frequency.exponentialRampToValueAtTime(250, t + 0.15)

        gain.gain.setValueAtTime(0.06, t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)

        osc.start(t)
        osc.stop(t + 0.15)
      } else if (kind === 'mortar') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(110, t)
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.22)

        gain.gain.setValueAtTime(0.18, t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)

        osc.start(t)
        osc.stop(t + 0.22)
      } else if (kind === 'tesla') {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(500, t)
        osc.frequency.setValueAtTime(250, t + 0.04)
        osc.frequency.setValueAtTime(600, t + 0.08)

        gain.gain.setValueAtTime(0.08, t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)

        osc.start(t)
        osc.stop(t + 0.12)
      }
    } catch (e) {}
  }

  playLeak(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(650, t)
      osc.frequency.setValueAtTime(500, t + 0.1)

      gain.gain.setValueAtTime(0.15, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)

      osc.start(t)
      osc.stop(t + 0.22)
    } catch (e) {}
  }

  playEnemyDeath(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(160, t)
      osc.frequency.exponentialRampToValueAtTime(70, t + 0.05)

      gain.gain.setValueAtTime(0.07, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)

      osc.start(t)
      osc.stop(t + 0.05)
    } catch (e) {}
  }

  playVictory(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const notes = [261.63, 329.63, 392.00, 523.25] // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, t + idx * 0.1)

        gain.gain.setValueAtTime(0.1, t + idx * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.1 + 0.3)

        osc.start(t + idx * 0.1)
        osc.stop(t + idx * 0.1 + 0.3)
      })
    } catch (e) {}
  }

  playDefeat(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const notes = [261.63, 220.00, 174.61, 130.81] // C4, A3, F3, C3
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, t + idx * 0.1)

        gain.gain.setValueAtTime(0.12, t + idx * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.1 + 0.4)

        osc.start(t + idx * 0.1)
        osc.stop(t + idx * 0.1 + 0.4)
      })
    } catch (e) {}
  }
}

export const audioEngine = new AudioEngine()
