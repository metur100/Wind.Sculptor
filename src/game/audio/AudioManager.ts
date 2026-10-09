import type { MaterialId } from '../particles/ParticleMaterial';
import { clamp } from '../utils/MathUtils';

/**
 * All sound is synthesised with the Web Audio API – no audio files, nothing to license or download.
 *
 * - wind:     looping noise through a band-pass filter, volume and pitch follow the swipe speed
 * - rustle:   a second, brighter noise layer following how fast the particles move (per material)
 * - sfx:      button blips, star pops, completion chime, failure tones, splashes
 * - music:    a slow generative pentatonic pad + melody, scheduled with a look-ahead timer
 *
 * The context is created lazily on the first user gesture (browser autoplay rules) and every call
 * is a no-op while audio is unavailable or disabled, so the game never depends on sound.
 */

type AudioCtor = typeof AudioContext;

const PENTATONIC = [0, 2, 4, 7, 9];
const CHORDS = [
  [57, 64, 69, 72], // A minor add
  [53, 60, 65, 69], // F
  [55, 62, 67, 71], // G
  [52, 59, 64, 67], // E minor
];

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const RUSTLE: Record<MaterialId, { freq: number; q: number; level: number }> = {
  sand: { freq: 5200, q: 0.7, level: 0.3 },
  leaves: { freq: 3200, q: 1.2, level: 0.42 },
  snow: { freq: 6500, q: 0.5, level: 0.16 },
  confetti: { freq: 4200, q: 1.6, level: 0.32 },
  fireflies: { freq: 2400, q: 3, level: 0.1 },
  bubbles: { freq: 900, q: 4, level: 0.18 },
};

class AudioManagerImpl {
  soundEnabled = true;
  musicEnabled = true;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private musicBus!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private rustleGain!: GainNode;
  private rustleFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private ambienceRunning = false;
  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private lastSplash = 0;
  private rustleLevel = 0.3;
  private failed = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) this.create();
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
      this.syncMusic();
    } catch {
      this.failed = true;
      this.ctx = null;
    }
  }

  get available(): boolean {
    return this.ctx !== null;
  }

  private create(): void {
    const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
    if (!Ctor) {
      this.failed = true;
      return;
    }
    const ctx = new Ctor();
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 4;
    compressor.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(compressor);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.soundEnabled ? 0.8 : 0;
    this.sfx.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0;
    this.musicBus.connect(this.master);

    // 2 s of soft pink-ish noise, shared by every noise voice.
    const length = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.05) * 0.9;
    }
  }

  setSound(on: boolean): void {
    this.soundEnabled = on;
    if (this.ctx) this.sfx.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05);
    if (!on) this.setWind(0, 0);
  }

  setMusic(on: boolean): void {
    this.musicEnabled = on;
    this.syncMusic();
  }

  /** Pause everything (tab hidden / app backgrounded). */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ------------------------------------------------------------------ ambience (wind + rustle)

  /** Starts the wind and rustle layers for a material (silent until setWind is called). */
  startAmbience(material: MaterialId): void {
    const ctx = this.ctx;
    if (!ctx || this.ambienceRunning) {
      if (ctx && this.ambienceRunning) this.configureRustle(material);
      return;
    }
    this.ambienceRunning = true;
    const windSource = ctx.createBufferSource();
    windSource.buffer = this.noise;
    windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 500;
    this.windFilter.Q.value = 0.9;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    windSource.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    windSource.start();

    const rustleSource = ctx.createBufferSource();
    rustleSource.buffer = this.noise;
    rustleSource.loop = true;
    rustleSource.playbackRate.value = 1.37;
    this.rustleFilter = ctx.createBiquadFilter();
    this.rustleFilter.type = 'bandpass';
    this.rustleGain = ctx.createGain();
    this.rustleGain.gain.value = 0;
    rustleSource.connect(this.rustleFilter).connect(this.rustleGain).connect(this.sfx);
    rustleSource.start();
    this.configureRustle(material);
  }

  private configureRustle(material: MaterialId): void {
    const r = RUSTLE[material];
    this.rustleFilter.frequency.value = r.freq;
    this.rustleFilter.Q.value = r.q;
    this.rustleLevel = r.level;
  }

  /**
   * @param swipe01    current swipe strength 0..1
   * @param movement01 average particle movement 0..1
   */
  setWind(swipe01: number, movement01: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.ambienceRunning) return;
    const t = ctx.currentTime;
    const s = this.soundEnabled ? clamp(swipe01, 0, 1) : 0;
    const m = this.soundEnabled ? clamp(movement01, 0, 1) : 0;
    this.windGain.gain.setTargetAtTime(0.03 + s * 0.55, t, s > 0.05 ? 0.06 : 0.25);
    this.windFilter.frequency.setTargetAtTime(380 + s * 900, t, 0.1);
    this.rustleGain.gain.setTargetAtTime(m * this.rustleLevel, t, 0.15);
  }

  stopAmbience(): void {
    if (!this.ctx || !this.ambienceRunning) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0, t, 0.15);
    this.rustleGain.gain.setTargetAtTime(0, t, 0.15);
  }

  // ------------------------------------------------------------------ sound effects

  private tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number, glideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.soundEnabled) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(this.sfx);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noiseBurst(start: number, duration: number, freq: number, volume: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.soundEnabled) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(this.sfx);
    src.start(start, Math.random());
    src.stop(start + duration + 0.05);
  }

  button(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(620, t, 0.09, 'sine', 0.22, 880);
  }

  toggle(on: boolean): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(on ? 520 : 700, t, 0.08, 'triangle', 0.18, on ? 780 : 460);
  }

  /** A strong gust: a short whoosh. */
  gust(strength01: number): void {
    if (!this.ctx) return;
    this.noiseBurst(this.ctx.currentTime, 0.35, 700 + strength01 * 900, 0.12 + strength01 * 0.2);
  }

  splash(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastSplash < 0.12) return;
    this.lastSplash = now;
    this.noiseBurst(now, 0.18, 1400, 0.12);
    this.tone(300, now, 0.12, 'sine', 0.06, 160);
  }

  /** Reached a star threshold while playing. */
  starPop(index: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = [72, 76, 79][Math.max(0, Math.min(2, index))];
    this.tone(midiToHz(base), t, 0.25, 'triangle', 0.22);
    this.tone(midiToHz(base + 12), t + 0.06, 0.3, 'sine', 0.12);
  }

  chime(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.02;
    [72, 76, 79, 84, 88].forEach((m, i) => {
      this.tone(midiToHz(m), t + i * 0.09, 0.9, 'triangle', 0.2);
      this.tone(midiToHz(m + 12), t + i * 0.09 + 0.02, 0.6, 'sine', 0.06);
    });
  }

  failure(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(midiToHz(64), t, 0.35, 'triangle', 0.2, midiToHz(62));
    this.tone(midiToHz(60), t + 0.28, 0.6, 'triangle', 0.2, midiToHz(55));
  }

  // ------------------------------------------------------------------ music

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const on = this.musicEnabled;
    this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.6);
    if (on && this.musicTimer === null) {
      this.nextNoteTime = ctx.currentTime + 0.2;
      this.musicTimer = window.setInterval(() => this.scheduleMusic(), 120);
    } else if (!on && this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const beat = 0.62;
    while (this.nextNoteTime < ctx.currentTime + 0.5) {
      const t = this.nextNoteTime;
      const bar = Math.floor(this.step / 8);
      const chord = CHORDS[bar % CHORDS.length];
      if (this.step % 8 === 0) {
        for (const note of chord) this.pad(midiToHz(note - 12), t, beat * 8);
      }
      // Sparse melody from the pentatonic scale, deterministic but varied.
      const pattern = (this.step * 7 + bar * 3) % 11;
      if (pattern < 5) {
        const degree = PENTATONIC[(this.step * 3 + bar) % PENTATONIC.length];
        const octave = pattern < 2 ? 12 : 0;
        this.bell(midiToHz(69 + degree + octave), t);
      }
      this.nextNoteTime += beat;
      this.step++;
    }
  }

  private pad(freq: number, start: number, duration: number): void {
    const ctx = this.ctx!;
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.05, start + duration * 0.35);
      gain.gain.linearRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(this.musicBus);
      osc.start(start);
      osc.stop(start + duration + 0.1);
    }
  }

  private bell(freq: number, start: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.09, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.6);
    osc.connect(gain).connect(this.musicBus);
    osc.start(start);
    osc.stop(start + 1.7);
  }
}

export const AudioManager = new AudioManagerImpl();
