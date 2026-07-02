// src/ui/AudioEngine.ts
import type { TowerKind } from '../game/towerTypes'

const MUSIC_VOL_KEY = 'pcb_td_music_vol_v1'
const SFX_VOL_KEY = 'pcb_td_sfx_vol_v1'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private enabled = false
  private scheduleTimer: any = null
  private nextNoteTime = 0
  private step = 0

  private musicVol = 0.5
  private sfxVol = 0.5

  // Cyberpunk bassline notes: C2, Eb2, G2, F2
  private bassline = [65.41, 65.41, 77.78, 77.78, 98.00, 98.00, 87.31, 87.31]
  // Synth melody arpeggios
  private melody = [130.81, 155.56, 196.00, 233.08, 261.63, 233.08, 196.00, 155.56]

  // Throttle for the mortar impact explosion layer (seconds, AudioContext clock)
  private lastExplosionTime = 0

  // Throttle for the base-hit alarm (seconds, AudioContext clock)
  private lastBaseAlarmTime = 0

  // Adaptive music tension: 0 = normal, 1 = boss wave active, 2 = final wave
  private musicTension: 0 | 1 | 2 = 0

  // Continuous SLOW-tower aura drone
  private slowHumOsc1: OscillatorNode | null = null
  private slowHumOsc2: OscillatorNode | null = null
  private slowHumGain: GainNode | null = null
  private slowHumActive = false

  constructor() {
    this.loadVolumeSettings()
  }

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

  loadVolumeSettings(): void {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      const mv = window.localStorage.getItem(MUSIC_VOL_KEY)
      const sv = window.localStorage.getItem(SFX_VOL_KEY)
      if (mv !== null) this.musicVol = parseFloat(mv)
      if (sv !== null) this.sfxVol = parseFloat(sv)
    }
  }

  getMusicVolume(): number { return this.musicVol }
  getSfxVolume(): number { return this.sfxVol }

  setMusicVolume(vol: number): void {
    this.musicVol = Math.max(0, Math.min(1, vol))
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(MUSIC_VOL_KEY, String(this.musicVol))
    }
  }

  setSfxVolume(vol: number): void {
    this.sfxVol = Math.max(0, Math.min(1, vol))
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(SFX_VOL_KEY, String(this.sfxVol))
    }
    // The SLOW-aura drone is continuous — retarget its gain live, or the slider is ignored
    // until the hum restarts.
    if (this.slowHumActive && this.slowHumGain && this.ctx) {
      const t = this.ctx.currentTime
      this.slowHumGain.gain.cancelScheduledValues(t)
      this.slowHumGain.gain.setValueAtTime(this.slowHumGain.gain.value, t)
      this.slowHumGain.gain.linearRampToValueAtTime(0.05 * this.sfxVol, t + 0.05)
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

  // Idempotent: level 0 = normal, 1 = boss wave active (tension drone), 2 = final wave
  // (tension drone + denser arpeggio). Read per-step inside scheduleNextNote — no extra timers.
  setMusicTension(level: 0 | 1 | 2): void {
    if (this.musicTension === level) return
    this.musicTension = level
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

    // Adaptive tension layer: boss wave (and final wave) add an off-beat low-fifth
    // drone stab under the bassline for persistent unease.
    if (this.musicTension >= 1 && step % 2 === 1) {
      const root = this.bassline[Math.floor(step / 2) % this.bassline.length]
      this.playSynthNode(root * 1.5, 'sawtooth', 0.02, 0.15, time)
    }

    // Final wave only: double the arpeggio into every step (16ths instead of 8ths)
    // for a denser, more urgent pulse.
    if (this.musicTension === 2) {
      const melFreq = this.melody[(step + 2) % this.melody.length]
      this.playSynthNode(melFreq, 'triangle', 0.015, 0.08, time)
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
      
      gain.gain.setValueAtTime(volume * this.musicVol, time)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
      
      osc.start(time)
      osc.stop(time + duration)
    } catch (e) {
      // noop
    }
  }

  // Random pitch multiplier within +/- `semitones` around `base` (1.0 = no shift).
  // Applied to oscillator frequencies so repeated SFX don't sound identical every time.
  private vary(base: number, semitones = 2): number {
    const st = (Math.random() * 2 - 1) * semitones
    return base * Math.pow(2, st / 12)
  }

  // Random +/-15% loudness jitter around a base gain value, so repeated SFX have some punch variety.
  private jitterGain(vol: number): number {
    return Math.max(0, vol * (0.85 + Math.random() * 0.3))
  }

  // --- SFX SYNTHS ---
  playClick(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const shift = this.vary(1, 1) // clicks get a softer +/-1 semitone variance
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(800 * shift, t)
      osc.frequency.exponentialRampToValueAtTime(1200 * shift, t + 0.04)

      gain.gain.setValueAtTime(this.jitterGain(0.08 * this.sfxVol), t)
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
      const shift = this.vary(1, 2)
      const playTone = (freq: number, delay: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'square'
        osc.frequency.setValueAtTime(freq * shift, t + delay)

        gain.gain.setValueAtTime(this.jitterGain(0.05 * this.sfxVol), t + delay)
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
      const shift = this.vary(1, 2)
      const playTone = (freq: number, delay: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq * shift, t + delay)

        gain.gain.setValueAtTime(this.jitterGain(0.08 * this.sfxVol), t + delay)
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
      const shift = this.vary(1, 2)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(400 * shift, t)
      osc.frequency.exponentialRampToValueAtTime(100 * shift, t + 0.18)

      gain.gain.setValueAtTime(this.jitterGain(0.06 * this.sfxVol), t)
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
      const shift = this.vary(1, 2)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      if (kind === 'cannon') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(450 * shift, t)
        osc.frequency.exponentialRampToValueAtTime(120 * shift, t + 0.09)

        gain.gain.setValueAtTime(this.jitterGain(0.12 * this.sfxVol), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)

        osc.start(t)
        osc.stop(t + 0.09)
      } else if (kind === 'sniper') {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(800 * shift, t)
        osc.frequency.exponentialRampToValueAtTime(250 * shift, t + 0.15)

        gain.gain.setValueAtTime(this.jitterGain(0.06 * this.sfxVol), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)

        osc.start(t)
        osc.stop(t + 0.15)
      } else if (kind === 'mortar') {
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(110 * shift, t)
        osc.frequency.exponentialRampToValueAtTime(30 * shift, t + 0.22)

        gain.gain.setValueAtTime(this.jitterGain(0.18 * this.sfxVol), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)

        osc.start(t)
        osc.stop(t + 0.22)
      } else if (kind === 'tesla') {
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(500 * shift, t)
        osc.frequency.setValueAtTime(250 * shift, t + 0.04)
        osc.frequency.setValueAtTime(600 * shift, t + 0.08)

        gain.gain.setValueAtTime(this.jitterGain(0.08 * this.sfxVol), t)
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
      const shift = this.vary(1, 2)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(650 * shift, t)
      osc.frequency.setValueAtTime(500 * shift, t + 0.1)

      gain.gain.setValueAtTime(this.jitterGain(0.15 * this.sfxVol), t)
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
      const shift = this.vary(1, 2)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(160 * shift, t)
      osc.frequency.exponentialRampToValueAtTime(70 * shift, t + 0.05)

      gain.gain.setValueAtTime(this.jitterGain(0.07 * this.sfxVol), t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)

      osc.start(t)
      osc.stop(t + 0.05)

      // Low-frequency thump layer under the death sound for extra "kill" weight
      const thumpOsc = this.ctx.createOscillator()
      const thumpGain = this.ctx.createGain()
      thumpOsc.connect(thumpGain)
      thumpGain.connect(this.ctx.destination)

      thumpOsc.type = 'sine'
      thumpOsc.frequency.setValueAtTime(this.vary(62, 3), t) // ~55-70Hz varied

      thumpGain.gain.setValueAtTime(this.jitterGain(0.22 * this.sfxVol), t)
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)

      thumpOsc.start(t)
      thumpOsc.stop(t + 0.15)
    } catch (e) {}
  }

  // Bigger low-end thump + noise burst for mortar/rocket impacts.
  // Throttled to at most one per 90ms so overlapping mortar impacts don't clip/stack.
  playExplosion(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    if (t - this.lastExplosionTime < 0.09) return
    this.lastExplosionTime = t
    try {
      // Big low thump
      const thumpOsc = this.ctx.createOscillator()
      const thumpGain = this.ctx.createGain()
      thumpOsc.connect(thumpGain)
      thumpGain.connect(this.ctx.destination)

      thumpOsc.type = 'sine'
      thumpOsc.frequency.setValueAtTime(this.vary(45, 3), t)

      thumpGain.gain.setValueAtTime(this.jitterGain(0.3 * this.sfxVol), t)
      thumpGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)

      thumpOsc.start(t)
      thumpOsc.stop(t + 0.25)

      // Noise burst for the crackle/debris on top of the thump
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.2)
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
      }
      const noise = this.ctx.createBufferSource()
      noise.buffer = buffer

      const noiseFilter = this.ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.setValueAtTime(1200, t)

      const noiseGain = this.ctx.createGain()
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(this.ctx.destination)

      noiseGain.gain.setValueAtTime(this.jitterGain(0.25 * this.sfxVol), t)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)

      noise.start(t)
      noise.stop(t + 0.2)
    } catch (e) {}
  }

  // Continuous low drone while a SLOW tower's aura is active during a wave.
  // Idempotent: safe to call every frame with the same value (no-op if state unchanged).
  setSlowHum(active: boolean): void {
    this.init()
    const shouldPlay = active && this.enabled && !!this.ctx
    if (shouldPlay === this.slowHumActive) return
    this.slowHumActive = shouldPlay
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime

    if (shouldPlay) {
      if (!this.slowHumGain) {
        try {
          const osc1 = ctx.createOscillator()
          const osc2 = ctx.createOscillator()
          const gain = ctx.createGain()
          osc1.type = 'sine'
          osc2.type = 'sine'
          osc1.frequency.setValueAtTime(50, t)
          osc2.frequency.setValueAtTime(53, t) // slight detune for a beating drone
          osc1.connect(gain)
          osc2.connect(gain)
          gain.connect(ctx.destination)
          gain.gain.setValueAtTime(0.0001, t)
          osc1.start(t)
          osc2.start(t)
          this.slowHumOsc1 = osc1
          this.slowHumOsc2 = osc2
          this.slowHumGain = gain
        } catch (e) {
          return
        }
      }
      const gain = this.slowHumGain!
      const target = 0.05 * this.sfxVol
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(target, t + 0.3)
    } else {
      const gain = this.slowHumGain
      const osc1 = this.slowHumOsc1
      const osc2 = this.slowHumOsc2
      if (gain) {
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(gain.gain.value, t)
        gain.gain.linearRampToValueAtTime(0.0001, t + 0.3)
      }
      this.slowHumOsc1 = null
      this.slowHumOsc2 = null
      this.slowHumGain = null
      setTimeout(() => {
        try { osc1?.stop() } catch (e) {}
        try { osc2?.stop() } catch (e) {}
      }, 320)
    }
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

        gain.gain.setValueAtTime(0.1 * this.sfxVol, t + idx * 0.1)
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

        gain.gain.setValueAtTime(0.12 * this.sfxVol, t + idx * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + idx * 0.1 + 0.4)

        osc.start(t + idx * 0.1)
        osc.stop(t + idx * 0.1 + 0.4)
      })
    } catch (e) {}
  }

  // Short two-note rising motif marking the start of a wave.
  playWaveStart(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const shift = this.vary(1, 1)
      // Radar/sonar ping: a soft rising sine blip + a quieter echo — reads as "incoming
      // carrier detected", not a drum hit.
      const ping = (delay: number, vol: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(660 * shift, t + delay)
        osc.frequency.linearRampToValueAtTime(880 * shift, t + delay + 0.12)
        gain.gain.setValueAtTime(0.0001, t + delay)
        gain.gain.linearRampToValueAtTime(vol * this.sfxVol, t + delay + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.28)
        osc.start(t + delay)
        osc.stop(t + delay + 0.3)
      }
      ping(0, 0.05)
      ping(0.22, 0.02) // echo
    } catch (e) {}
  }

  // Menacing stinger for boss spawn: a descending low sweep plus a dissonant
  // minor-second pair for extra unease.
  playBossSpawn(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const shift = this.vary(1, 1)

      const sweep = this.ctx.createOscillator()
      const sweepGain = this.ctx.createGain()
      sweep.connect(sweepGain)
      sweepGain.connect(this.ctx.destination)

      sweep.type = 'sawtooth'
      sweep.frequency.setValueAtTime(110 * shift, t)
      sweep.frequency.exponentialRampToValueAtTime(55 * shift, t + 0.6)

      sweepGain.gain.setValueAtTime(this.jitterGain(0.25 * this.sfxVol), t)
      sweepGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)

      sweep.start(t)
      sweep.stop(t + 0.6)

      const playDissonant = (freq: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(freq * shift, t)

        gain.gain.setValueAtTime(this.jitterGain(0.12 * this.sfxVol), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)

        osc.start(t)
        osc.stop(t + 0.4)
      }
      playDissonant(233.08) // Bb3
      playDissonant(246.94) // B3 — a minor second above, deliberately dissonant
    } catch (e) {}
  }

  // Bright victory-star chime. Call once per earned star, staggered by the caller
  // to match the star-slam animation delay.
  playStar(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    try {
      const t = this.ctx.currentTime
      const shift = this.vary(1, 1)
      const playTone = (freq: number, vol: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq * shift, t)

        gain.gain.setValueAtTime(this.jitterGain(vol * this.sfxVol), t)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)

        osc.start(t)
        osc.stop(t + 0.3)
      }
      playTone(880, 0.15)
      playTone(1320, 0.08) // overtone
    } catch (e) {}
  }

  // Urgent two-beep alarm for a base hit. Throttled to at most one per 400ms
  // so a burst of leaks doesn't spam beeps on top of each other.
  playBaseAlarm(): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    if (t - this.lastBaseAlarmTime < 0.4) return
    this.lastBaseAlarmTime = t
    try {
      const shift = this.vary(1, 1)
      const playBeep = (delay: number) => {
        const osc = this.ctx!.createOscillator()
        const gain = this.ctx!.createGain()
        osc.connect(gain)
        gain.connect(this.ctx!.destination)

        osc.type = 'square'
        osc.frequency.setValueAtTime(660 * shift, t + delay)

        gain.gain.setValueAtTime(this.jitterGain(0.2 * this.sfxVol), t + delay)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.08)

        osc.start(t + delay)
        osc.stop(t + delay + 0.08)
      }
      playBeep(0)
      playBeep(0.1)
    } catch (e) {}
  }
}

export const audioEngine = new AudioEngine()
