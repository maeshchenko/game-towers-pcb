// src/ui/AudioEngine.ts
// Fully synthesized WebAudio engine — no samples. Signal graph:
//
//   SFX voices → [panner] → sfxBus  ─┬→ master → compressor → destination
//   music voices → musicLowpass → musicBus ─┤
//   sfxBus → reverbSend → convolver ─┘   (generated impulse — shared wet return)
//   musicBus → delay (dotted-8th feedback) → master
//
// The compressor on the master is what keeps a dense 4×-speed battle from clipping into
// digital crunch; buses own the music/sfx volumes so individual voices never multiply them in.
import type { TowerKind } from '../game/towerTypes'
import { storageGet, storageSet } from '../util/safeStorage'

const MUSIC_VOL_KEY = 'pcb_td_music_vol_v1'
const SFX_VOL_KEY = 'pcb_td_sfx_vol_v1'

/** Generated impulse response: exponentially decaying noise ≈ a 1.4s plate-ish tail. */
function makeImpulse(ctx: AudioContext, seconds = 1.4, decay = 2.8): AudioBuffer {
  const rate = ctx.sampleRate
  const len = Math.floor(rate * seconds)
  const buf = ctx.createBuffer(2, len, rate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

interface ToneSpec {
  freq: number
  type?: OscillatorType
  vol: number
  dur: number
  delay?: number           // seconds after "now" (or after `at` when given)
  at?: number              // absolute AudioContext time; defaults to currentTime
  sweepTo?: number         // frequency destination
  sweepMode?: 'exp' | 'lin'
  steps?: Array<[number, number]> // extra [timeOffset, freq] setValue points (tesla crackle)
  attack?: number          // linear fade-in seconds (default: instant)
  pan?: number             // -1..1 stereo position
  bus?: 'sfx' | 'music'
  reverb?: number          // 0..1 extra send into the shared convolver
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private enabled = false
  private scheduleTimer: any = null
  private nextNoteTime = 0
  private step = 0
  private totalStep = 0

  private musicVol = 0.5
  private sfxVol = 0.5

  // --- bus graph (created lazily in init) ---
  private master: GainNode | null = null
  private compressor: DynamicsCompressorNode | null = null
  private sfxBus: GainNode | null = null
  private musicBus: GainNode | null = null
  private musicFilter: BiquadFilterNode | null = null
  private reverb: ConvolverNode | null = null
  private reverbReturn: GainNode | null = null

  // Harmonic sequence (4 bars of 8 steps): Cm → Ab → Eb → Bb (i–VI–III–VII).
  private chordRoots = [65.41, 51.91, 77.78, 58.27]
  // Three arp patterns (ratios over root×4), rotated every 4 bars for slow variety.
  private arpPatterns = [
    [1, 1.2, 1.5, 2, 1.5, 1.2],
    [1, 1.5, 2, 2.4, 2, 1.5],
    [2, 1.5, 1.2, 1, 1.2, 1.5],
  ]

  // Polyphony throttles: category → last play time (AudioContext clock).
  private lastPlay = new Map<string, number>()
  // Kill-streak: rapid deaths climb in pitch instead of stacking into low-end mud.
  private deathStreak = 0
  private lastDeathTime = -Infinity

  // Adaptive music tension: 0 = normal, 1 = boss wave active, 2 = final wave
  private musicTension: 0 | 1 | 2 = 0

  // Continuous SLOW-tower aura drone
  private slowHumOsc1: OscillatorNode | null = null
  private slowHumOsc2: OscillatorNode | null = null
  private slowHumGain: GainNode | null = null
  private slowHumActive = false

  // Build-phase board ambience (filtered noise hum)
  private ambientSrc: AudioBufferSourceNode | null = null
  private ambientGain: GainNode | null = null
  private ambientOn = false

  constructor() {
    this.loadVolumeSettings()
  }

  init(): void {
    if (this.ctx) return
    const Win = typeof window !== 'undefined' ? window : null as any
    const AudioCtx = Win ? (Win.AudioContext || Win.webkitAudioContext) : null
    if (!AudioCtx) return
    try {
      this.ctx = new AudioCtx()
      const ctx = this.ctx!
      this.compressor = ctx.createDynamicsCompressor()
      this.compressor.threshold.value = -14
      this.compressor.ratio.value = 6
      this.compressor.attack.value = 0.003
      this.compressor.release.value = 0.25
      this.master = ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.compressor)
      this.compressor.connect(ctx.destination)

      this.sfxBus = ctx.createGain()
      this.sfxBus.gain.value = this.sfxVol
      this.sfxBus.connect(this.master)

      this.musicBus = ctx.createGain()
      this.musicBus.gain.value = this.musicVol
      this.musicBus.connect(this.master)
      // Slow LFO on a lowpass over all music voices → instant "analog" movement.
      this.musicFilter = ctx.createBiquadFilter()
      this.musicFilter.type = 'lowpass'
      this.musicFilter.frequency.value = 1600
      this.musicFilter.Q.value = 0.8
      this.musicFilter.connect(this.musicBus)
      const lfo = ctx.createOscillator()
      lfo.frequency.value = 0.07
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 800 // 1600 ± 800 Hz
      lfo.connect(lfoGain)
      lfoGain.connect(this.musicFilter.frequency)
      lfo.start()
      // Dotted-8th feedback delay on the music — depth for ~15 lines of code.
      const delay = ctx.createDelay(1)
      delay.delayTime.value = 0.375
      const fb = ctx.createGain()
      fb.gain.value = 0.3
      const wet = ctx.createGain()
      wet.gain.value = 0.22
      this.musicBus.connect(delay)
      delay.connect(fb)
      fb.connect(delay)
      delay.connect(wet)
      wet.connect(this.master)
      // Shared generated-impulse reverb as a send off the SFX bus.
      this.reverb = ctx.createConvolver()
      this.reverb.buffer = makeImpulse(ctx)
      this.reverbReturn = ctx.createGain()
      this.reverbReturn.gain.value = 0.35
      const send = ctx.createGain()
      send.gain.value = 0.12
      this.sfxBus.connect(send)
      send.connect(this.reverb)
      this.reverb.connect(this.reverbReturn)
      this.reverbReturn.connect(this.master)
    } catch (e) {
      console.warn('Web Audio Context initialization failed:', e)
    }
  }

  loadVolumeSettings(): void {
    // Clamp + finite-check: a corrupt stored value would set gain to NaN, which the try/catch
    // around WebAudio calls swallows silently — the game would go permanently mute.
    const mv = parseFloat(storageGet(MUSIC_VOL_KEY) ?? '')
    const sv = parseFloat(storageGet(SFX_VOL_KEY) ?? '')
    if (Number.isFinite(mv)) this.musicVol = Math.max(0, Math.min(1, mv))
    if (Number.isFinite(sv)) this.sfxVol = Math.max(0, Math.min(1, sv))
  }

  getMusicVolume(): number { return this.musicVol }
  getSfxVolume(): number { return this.sfxVol }

  setMusicVolume(vol: number): void {
    this.musicVol = Math.max(0, Math.min(1, vol))
    storageSet(MUSIC_VOL_KEY, String(this.musicVol))
    if (this.musicBus && this.ctx) this.musicBus.gain.setTargetAtTime(this.musicVol, this.ctx.currentTime, 0.03)
  }

  setSfxVolume(vol: number): void {
    this.sfxVol = Math.max(0, Math.min(1, vol))
    storageSet(SFX_VOL_KEY, String(this.sfxVol))
    if (this.sfxBus && this.ctx) this.sfxBus.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.03)
  }

  setMute(mute: boolean): void {
    this.init()
    this.enabled = !mute
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
    if (this.enabled) this.startMusic()
    else this.stopMusic()
  }

  toggleMute(): boolean {
    this.setMute(this.enabled)
    return !this.enabled
  }

  /** Hidden-tab handling: suspend mutes the whole graph instantly; on resume the music
   * scheduler clock must be resynced, otherwise it "catches up" the missed notes in a burst
   * (background setInterval is throttled to ≥1 s while the lookahead is only 0.3 s). */
  suspendForBackground(): void {
    this.ctx?.suspend().catch(() => {})
  }

  resumeFromBackground(): void {
    if (!this.ctx) return
    this.ctx.resume().catch(() => {})
    this.nextNoteTime = this.ctx.currentTime
  }

  isMuted(): boolean {
    return !this.enabled
  }

  /** Manual sidechain: dip the music under an important stinger, recover exponentially. */
  duckMusic(to = 0.3, release = 1.0): void {
    if (!this.ctx || !this.musicBus) return
    const t = this.ctx.currentTime
    const g = this.musicBus.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(this.musicVol * to, t + 0.05)
    g.setTargetAtTime(this.musicVol, t + 0.25, release / 3)
  }

  // ---------------------------------------------------------------- music

  private startMusic(): void {
    if (!this.ctx || this.scheduleTimer) return
    this.nextNoteTime = this.ctx.currentTime
    this.step = 0
    this.totalStep = 0

    const scheduler = () => {
      if (!this.ctx) return
      while (this.nextNoteTime < this.ctx.currentTime + 0.3) {
        this.scheduleNextNote(this.step, this.nextNoteTime)
        // 120 BPM: 8th notes are 0.25 seconds
        this.nextNoteTime += 0.25
        this.step = (this.step + 1) % 8
        this.totalStep += 1
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

  // Idempotent: level 0 = normal, 1 = boss wave active (adds kick+stab), 2 = final wave
  // (everything + doubled arps). Read per-step inside scheduleNextNote — no extra timers.
  setMusicTension(level: 0 | 1 | 2): void {
    if (this.musicTension === level) return
    this.musicTension = level
  }

  /** One 8-step bar per chord; chords cycle i–VI–III–VII; arp pattern rotates every 4 bars. */
  private scheduleNextNote(step: number, time: number): void {
    if (!this.ctx || !this.enabled) return
    const bar = Math.floor(this.totalStep / 8)
    const root = this.chordRoots[bar % this.chordRoots.length]
    const arp = this.arpPatterns[Math.floor(bar / 4) % this.arpPatterns.length]

    // Bass: root pulse on even steps, a fifth on the bar's last step for movement.
    if (step % 2 === 0) {
      const f = step === 6 ? root * 1.5 : root
      this.tone({ freq: f, type: 'sawtooth', vol: 0.05, dur: 0.24, at: time, bus: 'music' })
      this.tone({ freq: f / 2, type: 'sine', vol: 0.04, dur: 0.24, at: time, bus: 'music' }) // sub layer
    }
    // Arpeggio on off-beats (16ths everywhere at tension 2).
    if (step % 2 === 1 || this.musicTension === 2) {
      const f = root * 4 * arp[(this.totalStep + (step % 2)) % arp.length]
      this.tone({ freq: f, type: 'triangle', vol: 0.028, dur: 0.14, at: time, bus: 'music' })
    }
    // Percussion synthesis: kick on 0/4 during any wave tension, hats on off-beats at 1+.
    if (this.musicTension >= 1) {
      if (step % 4 === 0) this.tone({ freq: 120, sweepTo: 45, sweepMode: 'exp', type: 'sine', vol: 0.09, dur: 0.09, at: time, bus: 'music' })
      if (step % 2 === 1) this.noiseBurst({ vol: 0.018, dur: 0.03, at: time, highpass: 7000, bus: 'music' })
      // off-beat low-fifth stab for persistent unease
      if (step % 2 === 1) this.tone({ freq: root * 1.5, type: 'sawtooth', vol: 0.02, dur: 0.15, at: time, bus: 'music' })
    }
  }

  // ------------------------------------------------------------- voice core

  /** Single-oscillator voice into a bus. All SFX/music voices route through here. */
  private tone(o: ToneSpec): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    const dest = o.bus === 'music' ? this.musicFilter : this.sfxBus
    if (!dest) return
    try {
      const t = (o.at ?? this.ctx.currentTime) + (o.delay ?? 0)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.connect(gain)
      let tail: AudioNode = gain
      if (o.pan !== undefined && this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner()
        panner.pan.value = Math.max(-1, Math.min(1, o.pan))
        gain.connect(panner)
        tail = panner
      }
      tail.connect(dest)
      if (o.reverb && this.reverb) {
        const send = this.ctx.createGain()
        send.gain.value = o.reverb
        tail.connect(send)
        send.connect(this.reverb)
      }
      osc.type = o.type ?? 'sine'
      osc.frequency.setValueAtTime(o.freq, t)
      if (o.sweepTo !== undefined) {
        if (o.sweepMode === 'lin') osc.frequency.linearRampToValueAtTime(o.sweepTo, t + o.dur)
        else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.sweepTo), t + o.dur)
      }
      if (o.steps) for (const [dt, f] of o.steps) osc.frequency.setValueAtTime(f, t + dt)
      if (o.attack && o.attack > 0) {
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.linearRampToValueAtTime(o.vol, t + o.attack)
      } else {
        gain.gain.setValueAtTime(o.vol, t)
      }
      gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
      osc.start(t)
      osc.stop(t + o.dur + 0.02)
    } catch (e) { /* voice failure is non-fatal */ }
  }

  /** Filtered white-noise burst (explosions, hats, sparks). */
  private noiseBurst(o: { vol: number; dur: number; at?: number; lowpass?: number; highpass?: number; pan?: number; bus?: 'sfx' | 'music' }): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    const dest = o.bus === 'music' ? this.musicFilter : this.sfxBus
    if (!dest) return
    try {
      const t = o.at ?? this.ctx.currentTime
      const n = Math.floor(this.ctx.sampleRate * o.dur)
      const buffer = this.ctx.createBuffer(1, Math.max(16, n), this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      const filter = this.ctx.createBiquadFilter()
      if (o.highpass) { filter.type = 'highpass'; filter.frequency.value = o.highpass }
      else { filter.type = 'lowpass'; filter.frequency.value = o.lowpass ?? 1200 }
      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(o.vol, t)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
      src.connect(filter)
      filter.connect(gain)
      let tail: AudioNode = gain
      if (o.pan !== undefined && this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner()
        panner.pan.value = Math.max(-1, Math.min(1, o.pan))
        gain.connect(panner)
        tail = panner
      }
      tail.connect(dest)
      src.start(t)
      src.stop(t + o.dur)
    } catch (e) { /* non-fatal */ }
  }

  // Random pitch multiplier within +/- `semitones` around `base` (1.0 = no shift).
  private vary(base: number, semitones = 2): number {
    const st = (Math.random() * 2 - 1) * semitones
    return base * Math.pow(2, st / 12)
  }

  // Random +/-15% loudness jitter so repeated SFX have some punch variety.
  private jitterGain(vol: number): number {
    return Math.max(0.0001, vol * (0.85 + Math.random() * 0.3))
  }

  /** Polyphony throttle: true if `category` may fire now (window in seconds). */
  private canPlay(category: string, window: number): boolean {
    if (!this.ctx) return false
    const t = this.ctx.currentTime
    if (t - (this.lastPlay.get(category) ?? -Infinity) < window) return false
    this.lastPlay.set(category, t)
    return true
  }

  /** World-x → gentle stereo position (±0.6 so nothing lives in one ear only). */
  private panFor(x01?: number): number | undefined {
    return x01 === undefined ? undefined : (Math.max(0, Math.min(1, x01)) * 2 - 1) * 0.6
  }

  // ------------------------------------------------------------------ SFX

  playClick(): void {
    const shift = this.vary(1, 1)
    this.tone({ freq: 800 * shift, sweepTo: 1200 * shift, sweepMode: 'exp', vol: this.jitterGain(0.08), dur: 0.04 })
  }

  playBuild(): void {
    const shift = this.vary(1, 2)
    this.tone({ freq: 180 * shift, type: 'square', vol: this.jitterGain(0.05), dur: 0.06 })
    this.tone({ freq: 360 * shift, type: 'square', vol: this.jitterGain(0.05), dur: 0.06, delay: 0.05 })
  }

  playUpgrade(): void {
    const shift = this.vary(1, 2)
    this.tone({ freq: 300 * shift, vol: this.jitterGain(0.08), dur: 0.08 })
    this.tone({ freq: 450 * shift, vol: this.jitterGain(0.08), dur: 0.08, delay: 0.06 })
    this.tone({ freq: 600 * shift, vol: this.jitterGain(0.08), dur: 0.08, delay: 0.12, reverb: 0.15 })
  }

  playSell(): void {
    const shift = this.vary(1, 2)
    this.tone({ freq: 400 * shift, type: 'sawtooth', sweepTo: 100 * shift, sweepMode: 'exp', vol: this.jitterGain(0.06), dur: 0.18 })
  }

  /** x01: normalized world X (0..1) → stereo pan. Per-kind polyphony window keeps 4× fights clean. */
  playShot(kind: TowerKind, x01?: number): void {
    this.init()
    if (!this.canPlay(`shot:${kind}`, 0.035)) return
    const shift = this.vary(1, 2)
    const pan = this.panFor(x01)
    if (kind === 'cannon') {
      this.tone({ freq: 450 * shift, type: 'triangle', sweepTo: 120 * shift, sweepMode: 'exp', vol: this.jitterGain(0.12), dur: 0.09, pan })
    } else if (kind === 'sniper') {
      this.tone({ freq: 800 * shift, type: 'sawtooth', sweepTo: 250 * shift, sweepMode: 'exp', vol: this.jitterGain(0.06), dur: 0.15, pan, reverb: 0.1 })
    } else if (kind === 'mortar') {
      this.tone({ freq: 110 * shift, type: 'triangle', sweepTo: 30 * shift, sweepMode: 'exp', vol: this.jitterGain(0.18), dur: 0.22, pan })
    } else if (kind === 'tesla') {
      this.tone({ freq: 500 * shift, type: 'sawtooth', steps: [[0.04, 250 * shift], [0.08, 600 * shift]], vol: this.jitterGain(0.08), dur: 0.12, pan })
    }
  }

  /** Refusal buzz (can't afford / can't build): low dissonant double-blip. */
  playError(): void {
    if (!this.canPlay('error', 0.15)) return
    this.tone({ freq: 220, type: 'square', vol: 0.07, dur: 0.07 })
    this.tone({ freq: 208, type: 'square', vol: 0.07, dur: 0.09, delay: 0.08 })
  }

  /** Tiny impact tick for non-explosive projectile hits (cannon pulse). */
  playImpact(x01?: number): void {
    if (!this.canPlay('impact', 0.04)) return
    this.tone({ freq: this.vary(2400, 2), type: 'square', vol: 0.03, dur: 0.03, pan: this.panFor(x01) })
  }

  playLeak(): void {
    const shift = this.vary(1, 2)
    this.tone({ freq: 650 * shift, steps: [[0.1, 500 * shift]], vol: this.jitterGain(0.15), dur: 0.22 })
  }

  /** Kill-streak: rapid consecutive deaths climb a semitone each — reward, not mud. */
  playEnemyDeath(x01?: number): void {
    this.init()
    if (!this.ctx || !this.enabled) return
    const t = this.ctx.currentTime
    if (t - this.lastDeathTime < 0.05) return
    this.deathStreak = t - this.lastDeathTime < 1.2 ? this.deathStreak + 1 : 0
    this.lastDeathTime = t
    const streakMul = Math.pow(2, Math.min(this.deathStreak, 12) / 12)
    const shift = this.vary(1, 1) * streakMul
    const pan = this.panFor(x01)
    this.tone({ freq: 160 * shift, type: 'triangle', sweepTo: 70 * shift, sweepMode: 'exp', vol: this.jitterGain(0.07), dur: 0.05, pan })
    // Low thump stays UNpitched by the streak — weight without booming an octave up.
    this.tone({ freq: this.vary(62, 3), vol: this.jitterGain(0.2 / (1 + this.deathStreak * 0.15)), dur: 0.15, pan })
  }

  // Bigger low-end thump + noise burst for mortar/rocket impacts (throttled).
  playExplosion(x01?: number): void {
    this.init()
    if (!this.canPlay('explosion', 0.09)) return
    const pan = this.panFor(x01)
    this.tone({ freq: this.vary(45, 3), vol: this.jitterGain(0.3), dur: 0.25, pan, reverb: 0.25 })
    this.noiseBurst({ vol: this.jitterGain(0.25), dur: 0.2, lowpass: 1200, pan })
  }

  // Continuous low drone while a SLOW tower's aura is active during a wave.
  // Idempotent: safe to call every frame with the same value (no-op if state unchanged).
  setSlowHum(active: boolean): void {
    this.init()
    const shouldPlay = active && this.enabled && !!this.ctx && !!this.sfxBus
    if (shouldPlay === this.slowHumActive) return
    this.slowHumActive = shouldPlay
    const ctx = this.ctx
    if (!ctx || !this.sfxBus) return
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
          gain.connect(this.sfxBus)
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
      gain.gain.cancelScheduledValues(t)
      gain.gain.setValueAtTime(gain.gain.value, t)
      gain.gain.linearRampToValueAtTime(0.05, t + 0.3) // bus applies sfxVol
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

  /** Build-phase board ambience: quiet band-passed hum — the device idles, it isn't dead.
   * Idempotent per-frame like setSlowHum. */
  setAmbient(active: boolean): void {
    this.init()
    const should = active && this.enabled && !!this.ctx && !!this.sfxBus
    if (should === this.ambientOn) return
    this.ambientOn = should
    const ctx = this.ctx
    if (!ctx || !this.sfxBus) return
    const t = ctx.currentTime
    if (should) {
      if (!this.ambientGain) {
        try {
          const len = Math.floor(ctx.sampleRate * 2)
          const buf = ctx.createBuffer(1, len, ctx.sampleRate)
          const data = buf.getChannelData(0)
          for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
          const src = ctx.createBufferSource()
          src.buffer = buf
          src.loop = true
          const bp = ctx.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = 220
          bp.Q.value = 0.6
          const gain = ctx.createGain()
          gain.gain.setValueAtTime(0.0001, t)
          src.connect(bp)
          bp.connect(gain)
          gain.connect(this.sfxBus)
          src.start(t)
          this.ambientSrc = src
          this.ambientGain = gain
        } catch (e) { return }
      }
      this.ambientGain!.gain.setTargetAtTime(0.022, t, 0.4)
    } else if (this.ambientGain) {
      const gain = this.ambientGain
      const src = this.ambientSrc
      gain.gain.setTargetAtTime(0.0001, t, 0.25)
      this.ambientSrc = null
      this.ambientGain = null
      setTimeout(() => { try { src?.stop() } catch (e) {} }, 1200)
    }
  }

  /** DOS-teletype tick for the story terminal: one very short quiet click per typed char. */
  playTerminalTick(): void {
    this.tone({ freq: this.vary(1500, 3), type: 'square', vol: 0.012, dur: 0.012 })
  }

  /** Soft end-of-line blip for the story terminal (the classic CR "ding", toned down). */
  playTerminalLine(): void {
    this.tone({ freq: this.vary(820, 1), vol: 0.02, dur: 0.05 })
  }

  playVictory(): void {
    this.duckMusic(0.2, 1.6)
    const notes = [261.63, 329.63, 392.0, 523.25] // C4, E4, G4, C5
    notes.forEach((freq, idx) => {
      this.tone({ freq, type: 'triangle', vol: 0.1, dur: 0.3, delay: idx * 0.1, reverb: 0.3 })
    })
  }

  playDefeat(): void {
    this.duckMusic(0.15, 2.2)
    const notes = [261.63, 220.0, 174.61, 130.81] // C4, A3, F3, C3
    notes.forEach((freq, idx) => {
      this.tone({ freq, type: 'triangle', vol: 0.12, dur: 0.4, delay: idx * 0.1, reverb: 0.3 })
    })
  }

  // Radar/sonar ping marking the start of a wave: soft rising blip + a quieter echo.
  playWaveStart(): void {
    this.duckMusic(0.55, 0.7)
    const shift = this.vary(1, 1)
    this.tone({ freq: 660 * shift, sweepTo: 880 * shift, sweepMode: 'lin', vol: 0.05, dur: 0.28, attack: 0.02, reverb: 0.3 })
    this.tone({ freq: 660 * shift, sweepTo: 880 * shift, sweepMode: 'lin', vol: 0.02, dur: 0.28, attack: 0.02, delay: 0.22, reverb: 0.4 })
  }

  // Menacing stinger for boss spawn: descending low sweep + dissonant minor-second pair.
  playBossSpawn(): void {
    this.duckMusic(0.25, 1.4)
    const shift = this.vary(1, 1)
    this.tone({ freq: 110 * shift, type: 'sawtooth', sweepTo: 55 * shift, sweepMode: 'exp', vol: this.jitterGain(0.25), dur: 0.6, reverb: 0.35 })
    this.tone({ freq: 233.08 * shift, type: 'sawtooth', vol: this.jitterGain(0.12), dur: 0.4 })
    this.tone({ freq: 246.94 * shift, type: 'sawtooth', vol: this.jitterGain(0.12), dur: 0.4 }) // minor second above
  }

  // Bright victory-star chime. Call once per earned star (caller staggers).
  playStar(): void {
    const shift = this.vary(1, 1)
    this.tone({ freq: 880 * shift, vol: this.jitterGain(0.15), dur: 0.3, reverb: 0.3 })
    this.tone({ freq: 1320 * shift, vol: this.jitterGain(0.08), dur: 0.3 })
  }

  // Urgent two-beep alarm for a base hit (throttled: leak bursts must not stack beeps).
  playBaseAlarm(): void {
    this.init()
    if (!this.canPlay('alarm', 0.4)) return
    this.duckMusic(0.4, 0.8)
    const shift = this.vary(1, 1)
    this.tone({ freq: 660 * shift, type: 'square', vol: this.jitterGain(0.2), dur: 0.08 })
    this.tone({ freq: 660 * shift, type: 'square', vol: this.jitterGain(0.2), dur: 0.08, delay: 0.1 })
  }
}

export const audioEngine = new AudioEngine()
