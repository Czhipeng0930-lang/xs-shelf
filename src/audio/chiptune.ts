/**
 * 极简芯片音乐合成器：方波主旋律 + 三角波贝斯 + 噪声鼓组。
 * 全部实时合成，不加载任何音频文件。
 */

export type Drum = '' | 'k' | 's' | 'h' | 'o';

export interface Track {
  id: string;
  name: string;
  bpm: number;
  /** 主旋律：MIDI 音高，0 = 休止 */
  lead: number[];
  /** 和声/琶音，可留空 */
  arp?: number[];
  bass: number[];
  drums: Drum[];
  /** 主旋律方波占空比 */
  duty?: number;
  gain?: number;
}

const waveCache = new Map<string, PeriodicWave>();

/** 按占空比合成方波，duty 0.5 = 标准方波，0.125 = 尖细的 NES 音色 */
function squareWave(ctx: AudioContext, duty: number): PeriodicWave {
  const key = duty.toFixed(3);
  const hit = waveCache.get(key);
  if (hit) return hit;
  const n = 24;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let i = 1; i < n; i++) imag[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  waveCache.set(key, wave);
  return wave;
}

function midiToFreq(m: number) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

let noiseBuffer: AudioBuffer | null = null;
function getNoise(ctx: AudioContext) {
  if (noiseBuffer && noiseBuffer.sampleRate === ctx.sampleRate) return noiseBuffer;
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x3fffffff) - 1;
  }
  noiseBuffer = buf;
  return buf;
}

export class Chiptune {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private track: Track | null = null;
  private step = 0;
  private nextTime = 0;
  private volume = 0.34;

  get playing() {
    return this.timer !== null;
  }

  get currentId() {
    return this.track?.id ?? null;
  }

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  /** 切歌；同一首正在放则什么都不做 */
  play(track: Track) {
    if (this.track?.id === track.id && this.timer) return;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    void ctx.resume();
    this.stop();
    this.track = track;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  dispose() {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }

  private schedule() {
    const ctx = this.ctx;
    const t = this.track;
    if (!ctx || !t || !this.master) return;
    // 16 分音符
    const stepDur = 60 / t.bpm / 4;
    const horizon = ctx.currentTime + 0.12;
    const len = Math.max(t.lead.length, t.bass.length, t.drums.length);
    while (this.nextTime < horizon) {
      const i = this.step % len;
      const when = this.nextTime;
      const lead = t.lead[i % t.lead.length];
      if (lead) this.tone(lead, when, stepDur * 1.7, 0.16 * (t.gain ?? 1), t.duty ?? 0.25);
      if (t.arp) {
        const a = t.arp[i % t.arp.length];
        if (a) this.tone(a, when, stepDur * 0.9, 0.065 * (t.gain ?? 1), 0.125);
      }
      const bass = t.bass[i % t.bass.length];
      if (bass) this.bassTone(bass, when, stepDur * 1.8, 0.2 * (t.gain ?? 1));
      const d = t.drums[i % t.drums.length];
      if (d) this.drum(d, when, t.gain ?? 1);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private tone(midi: number, when: number, dur: number, gain: number, duty: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(squareWave(ctx, duty));
    osc.frequency.setValueAtTime(midiToFreq(midi), when);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.008);
    g.gain.exponentialRampToValueAtTime(gain * 0.5, when + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(this.master!);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private bassTone(midi: number, when: number, dur: number, gain: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(midiToFreq(midi), when);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(this.master!);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private drum(kind: Drum, when: number, gain: number) {
    const ctx = this.ctx!;
    if (kind === 'k') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, when);
      osc.frequency.exponentialRampToValueAtTime(42, when + 0.11);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5 * gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
      osc.connect(g).connect(this.master!);
      osc.start(when);
      osc.stop(when + 0.18);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    let end = when + 0.16;
    if (kind === 's') {
      filter.type = 'bandpass';
      filter.frequency.value = 1900;
      filter.Q.value = 0.8;
      g.gain.setValueAtTime(0.32 * gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    } else {
      filter.type = 'highpass';
      filter.frequency.value = 7200;
      const dur = kind === 'o' ? 0.16 : 0.045;
      end = when + dur + 0.02;
      g.gain.setValueAtTime((kind === 'o' ? 0.16 : 0.12) * gain, when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    }
    src.connect(filter).connect(g).connect(this.master!);
    src.start(when);
    src.stop(end);
  }
}

export const chiptune = new Chiptune();
