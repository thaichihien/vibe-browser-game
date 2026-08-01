/* Web Audio synth — no sample files, house convention across this repo.
 * Mute preference persists under `lastQuarter.muted`.
 */
import { STORE_MUTED } from './config.js';

let ctx = null;
let master = null;

export const Sound = {
  muted: false,

  init() {
    try {
      this.muted = JSON.parse(localStorage.getItem(STORE_MUTED)) === true;
    } catch { this.muted = false; }
  },

  /* Browsers block audio until a gesture, so the context is built lazily on
   * the first click/keypress rather than at load. */
  resume() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(STORE_MUTED, JSON.stringify(this.muted)); } catch { /* private mode */ }
    return this.muted;
  },

  /* One shaped oscillator. Everything below is a chord of these. */
  tone(freq, dur, { type = 'square', gain = 0.5, slide = 0, delay = 0, attack = 0.005 } = {}) {
    if (this.muted || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  noise(dur, { gain = 0.3, delay = 0, hp = 800 } = {}) {
    if (this.muted || !ctx) return;
    const t0 = ctx.currentTime + delay;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass';
    filt.frequency.value = hp;
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(filt).connect(env).connect(master);
    src.start(t0);
  },

  /* ── cues ── */
  jump()       { this.tone(360, 0.14, { slide: 300, gain: 0.35 }); },
  land()       { this.tone(150, 0.06, { type: 'triangle', gain: 0.2 }); },
  coin()       { this.tone(1050, 0.07, { type: 'square', gain: 0.3 });
                 this.tone(1560, 0.11, { type: 'square', gain: 0.26, delay: 0.06 }); },
  stomp()      { this.tone(220, 0.1, { slide: -140, gain: 0.4 }); this.noise(0.09, { gain: 0.18 }); },
  spring()     { this.tone(300, 0.22, { type: 'sine', slide: 620, gain: 0.4 }); },
  checkpoint() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', gain: 0.3, delay: i * 0.07 })); },
  hurt()       { this.tone(320, 0.32, { type: 'sawtooth', slide: -240, gain: 0.4 }); this.noise(0.2, { gain: 0.2, hp: 400 }); },
  ui()         { this.tone(680, 0.05, { type: 'triangle', gain: 0.25 }); },
  glitch()     { this.noise(0.16, { gain: 0.24, hp: 1600 }); this.tone(90, 0.16, { type: 'sawtooth', gain: 0.22 }); },
  win()        { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'square', gain: 0.32, delay: i * 0.1 })); },
  lose()       { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, { type: 'sawtooth', gain: 0.3, delay: i * 0.14 })); },
  unplug()     { this.tone(260, 0.8, { type: 'sawtooth', slide: -220, gain: 0.4 }); this.noise(0.5, { gain: 0.2, hp: 200 }); },
};
