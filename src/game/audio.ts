const BPM = 132;
const STEP = 60 / BPM / 4;

const HOOK_A = [293.66, 349.23, 392, 440, 523.25, 440, 392, 349.23];
const HOOK_B = [293.66, 349.23, 415.3, 392, 349.23, 392, 440, 293.66];
const BASS = [73.42, 55, 65.41, 87.31];

export class Music {
  enabled = true;
  wave = 0;
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private timer = 0;
  private next = 0;
  private step = 0;
  private running = false;

  attach(ctx: AudioContext) {
    if (this.ctx === ctx && this.bus) return;
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = this.enabled ? 0.2 : 0;
    this.bus.connect(ctx.destination);
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) {
      this.halt();
      return;
    }
    this.start();
  }

  start() {
    if (!this.enabled || !this.ctx || !this.bus || this.running) return;
    if (this.ctx.state !== "running") return;
    this.running = true;
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(0.2, t);
    this.next = t + 0.06;
    this.step = 0;
    this.timer = window.setInterval(() => this.pump(), 25);
  }

  stop() {
    this.halt();
  }

  private halt() {
    this.running = false;
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
    if (this.bus && this.ctx) {
      const t = this.ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(0, t);
    }
  }

  private pump() {
    if (!this.ctx || !this.bus || !this.running) return;
    const now = this.ctx.currentTime;
    if (this.next < now - 0.05) this.next = now + 0.05;
    const horizon = now + 0.22;
    while (this.next < horizon) {
      this.voice(this.next, this.step);
      this.step = (this.step + 1) % 64;
      this.next += STEP;
    }
  }

  private voice(time: number, step: number) {
    const bar = Math.floor(step / 16) % 4;
    const slot = step % 16;
    const thick = this.wave >= 2;
    if (slot === 0 || slot === 8 || (thick && slot === 14)) this.kick(time);
    if (slot === 4 || slot === 12) this.snare(time, slot === 12 ? 0.9 : 0.7);
    if (slot % 2 === 0) this.hat(time, slot % 4 === 0 ? 0.035 : 0.02);
    if (slot === 0) this.bass(time, BASS[(bar + this.wave) % BASS.length]);
    if (slot % 2 === 0) {
      const hook = (this.wave + bar) % 2 === 0 ? HOOK_A : HOOK_B;
      const note = hook[(slot / 2) % hook.length];
      this.mel(time, note, 0.055);
      if (this.wave >= 1 && bar === 2) this.mel(time, note * 2, 0.02);
    }
  }

  private env(gain: number, dur: number, time: number) {
    if (!this.ctx || !this.bus) return null;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    g.connect(this.bus);
    return g;
  }

  private osc(freq: number, type: OscillatorType, gain: number, dur: number, time: number, slide = 0) {
    if (!this.ctx) return;
    const g = this.env(gain, dur, time);
    if (!g) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), time + dur);
    o.connect(g);
    o.start(time);
    o.stop(time + dur + 0.02);
  }

  private kick(time: number) {
    this.osc(150, "sine", 0.42, 0.09, time, -105);
  }

  private snare(time: number, amp: number) {
    this.osc(190, "triangle", 0.06 * amp, 0.07, time, -80);
    this.hiss(time, 0.05 * amp, 0.06, 1800);
  }

  private hat(time: number, gain: number) {
    this.hiss(time, gain, 0.03, 6000);
  }

  private bass(time: number, freq: number) {
    this.osc(freq, "triangle", 0.11, 0.28, time);
  }

  private mel(time: number, freq: number, gain: number) {
    this.osc(freq, "triangle", gain, 0.16, time);
  }

  private noise: AudioBuffer | null = null;

  private hiss(time: number, gain: number, dur: number, freq: number) {
    if (!this.ctx || !this.bus) return;
    if (!this.noise) {
      const len = Math.floor(this.ctx.sampleRate * 0.12);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = freq;
    const g = this.env(gain, dur, time);
    if (!g) return;
    src.connect(filter);
    filter.connect(g);
    src.start(time);
    src.stop(time + dur);
  }
}

export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;
  private last = new Map<string, number>();
  private noise: AudioBuffer | null = null;

  context() {
    return this.ctx;
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private gate(name: string, ms: number) {
    const now = performance.now();
    if (now - (this.last.get(name) ?? 0) < ms) return false;
    this.last.set(name, now);
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slide = 0, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(40, freq), t);
    const target = Math.max(40, freq + slide);
    if (target !== freq) o.frequency.exponentialRampToValueAtTime(target, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, gain: number, from: number, to: number) {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    if (!this.noise) {
      const len = Math.floor(ctx.sampleRate * 0.35);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shoot() {
    if (this.gate("s", 70)) this.tone(620, 0.045, "square", 0.028, -220);
  }
  wave() {
    if (!this.gate("w", 90)) return;
    this.hiss(0.16, 0.07, 1400, 220);
    this.tone(240, 0.12, "sawtooth", 0.03, -90);
  }
  knife() {
    if (this.gate("k", 55)) this.tone(860, 0.05, "triangle", 0.03, -380);
  }
  slash() {
    if (this.gate("sl", 80)) this.tone(210, 0.08, "sawtooth", 0.03, 160);
  }
  hit() {
    if (!this.gate("h", 40)) return;
    this.tone(180, 0.04, "square", 0.03, -60);
    this.hiss(0.04, 0.03, 900, 300);
  }
  die() {
    if (this.gate("d", 28)) this.tone(110, 0.07, "triangle", 0.035, -70);
  }
  big() {
    this.tone(80, 0.18, "sawtooth", 0.05, -40);
  }
  pickup() {
    if (this.gate("p", 45)) this.tone(880, 0.04, "square", 0.02, 240);
  }
  coin() {
    if (!this.gate("c", 80)) return;
    this.tone(988, 0.05, "square", 0.03, 40);
    this.tone(1318, 0.08, "square", 0.028, 0, 0.05);
  }
  level() {
    this.tone(523, 0.08, "square", 0.045);
    this.tone(659, 0.08, "square", 0.04, 0, 0.07);
    this.tone(784, 0.14, "square", 0.045, 0, 0.14);
  }
  warn() {
    this.tone(150, 0.18, "sawtooth", 0.045);
    this.tone(96, 0.26, "square", 0.04);
  }
  hurt() {
    if (this.gate("hu", 180)) this.tone(86, 0.1, "sawtooth", 0.05, -30);
  }
  death() {
    this.tone(220, 0.2, "sawtooth", 0.05, -80);
    this.tone(146, 0.45, "triangle", 0.05, -90, 0.08);
  }
  revive() {
    this.tone(392, 0.08, "triangle", 0.04);
    this.tone(523, 0.1, "triangle", 0.04, 0, 0.08);
    this.tone(784, 0.16, "triangle", 0.045, 0, 0.16);
  }
  lucky() {
    this.tone(440, 0.05, "square", 0.035, 120);
  }
  click() {
    this.tone(480, 0.03, "square", 0.025);
  }
}
