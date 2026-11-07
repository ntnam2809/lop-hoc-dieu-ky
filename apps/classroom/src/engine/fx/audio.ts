import type { SoundName } from '../types';

/**
 * Âm thanh tổng hợp bằng WebAudio — không cần file, nhẹ, tất định, chạy
 * offline. Âm sắc mềm (sine/triangle, có đuôi vang) để hợp với lớp học trẻ
 * nhỏ; không có âm "sai" chói tai.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private musicTimer = 0;
  enabled = true;
  musicOn = false;

  private ensure(): AudioContext | null {
    if (!this.enabled && !this.musicOn) return null;
    // Trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người dùng.
    if (!this.ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(1.6);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.22;
      this.reverb.connect(wet).connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Gọi trong một thao tác người dùng để trình duyệt cho phép phát âm thanh. */
  unlock() {
    this.ensure();
  }

  suspend(paused: boolean) {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private impulse(sec: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  private tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; slide?: number; wet?: boolean } = {}) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, at);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), at + dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master!);
    if (opts.wet !== false) g.connect(this.reverb!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Chuông: sóng sine + bồi âm nhẹ. */
  private bell(freq: number, at: number, dur = 0.9, gain = 0.22) {
    this.tone(freq, at, dur, { gain });
    this.tone(freq * 2, at, dur * 0.6, { gain: gain * 0.35 });
    this.tone(freq * 3.01, at, dur * 0.3, { gain: gain * 0.12 });
  }

  private noise(at: number, dur: number, opts: { from: number; to: number; q?: number; gain?: number; type?: BiquadFilterType }) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.Q.value = opts.q ?? 1.2;
    f.frequency.setValueAtTime(opts.from, at);
    f.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.master!);
    g.connect(this.reverb!);
    src.start(at);
  }

  play(name: SoundName) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const N = (semi: number) => 523.25 * Math.pow(2, semi / 12); // C5
    switch (name) {
      case 'tap':
        this.tone(880, t, 0.09, { slide: 0.6, gain: 0.18, wet: false });
        break;
      case 'pop':
        this.tone(520, t, 0.12, { slide: 2.2, gain: 0.22 });
        break;
      case 'pickup':
        this.tone(N(0), t, 0.12, { slide: 1.5, type: 'triangle', gain: 0.18 });
        break;
      case 'drop':
        this.tone(N(7), t, 0.1, { type: 'triangle', gain: 0.18 });
        this.tone(N(12), t + 0.06, 0.18, { type: 'triangle', gain: 0.16 });
        break;
      case 'thud':
        this.tone(140, t, 0.18, { slide: 0.5, gain: 0.35, wet: false });
        break;
      case 'correct':
        [0, 4, 7, 12].forEach((s, i) => this.bell(N(s), t + i * 0.085, 0.9, 0.18));
        break;
      case 'chime':
        [7, 12].forEach((s, i) => this.bell(N(s), t + i * 0.1, 0.8, 0.16));
        break;
      case 'retry':
        // Hai nốt nhẹ đi xuống — mời thử lại, không phải tiếng "sai".
        this.tone(N(4), t, 0.22, { type: 'triangle', gain: 0.16 });
        this.tone(N(0), t + 0.16, 0.3, { type: 'triangle', gain: 0.14 });
        break;
      case 'splash':
        this.noise(t, 0.55, { from: 2400, to: 500, q: 0.8, gain: 0.45 });
        this.tone(320, t, 0.15, { slide: 0.4, gain: 0.25 });
        break;
      case 'plunk':
        this.tone(260, t, 0.25, { slide: 0.45, gain: 0.35 });
        this.noise(t, 0.25, { from: 1600, to: 400, gain: 0.2 });
        break;
      case 'bubble':
        for (let i = 0; i < 5; i++) this.tone(420 + i * 90, t + i * 0.09, 0.07, { slide: 2.4, gain: 0.12 });
        break;
      case 'whoosh':
        this.noise(t, 0.45, { from: 400, to: 3000, q: 0.7, gain: 0.22 });
        break;
      case 'page':
        this.noise(t, 0.35, { from: 3000, to: 900, q: 0.6, gain: 0.16 });
        break;
      case 'sparkle':
        [12, 16, 19, 24].forEach((s, i) => this.bell(N(s), t + i * 0.05, 0.4, 0.07));
        break;
      case 'hop':
        this.tone(330, t, 0.16, { slide: 2.1, type: 'sine', gain: 0.2 });
        break;
      case 'fanfare':
        [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => this.bell(N(s), t + i * 0.11, 1.1, 0.16));
        this.tone(N(-12), t, 1.4, { type: 'triangle', gain: 0.12 });
        break;
    }
  }

  /** Nhạc nền hộp nhạc ngũ cung, rất nhỏ; mặc định tắt. */
  setMusic(on: boolean) {
    this.musicOn = on;
    clearInterval(this.musicTimer);
    if (!on) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const scale = [0, 2, 4, 7, 9, 12, 14, 16];
    let step = 0;
    const pattern = [0, 2, 4, 5, 4, 2, 3, 1, 0, 2, 4, 7, 6, 4, 3, 2];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || this.ctx.state !== 'running') return;
      const t = this.ctx.currentTime + 0.02;
      const s = scale[pattern[step % pattern.length]];
      this.bell(392 * Math.pow(2, s / 12), t, 1.4, 0.05);
      if (step % 4 === 0) this.tone(196 * Math.pow(2, scale[pattern[step % 8] % 5] / 12), t, 1.8, { type: 'triangle', gain: 0.035 });
      step++;
    }, 420);
  }
}

export const sound = new SoundEngine();
