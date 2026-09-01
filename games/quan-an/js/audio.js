/* Web Audio synth — no assets, house convention. Mute flag lives in
   localStorage under `quanAn.muted`, the same shape as the other games. */

import { MUTE_KEY } from './state.js';

export const Sound = {
  ctx: null, muted: false, master: null,

  init() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* private mode */ }
  },

  /* browsers only hand out audio after a gesture */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.45;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    return this.muted;
  },

  tone(freq, dur, type = 'square', gain = 0.05, slideTo = null, delay = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp); amp.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  chord(freqs, dur, type = 'triangle', gain = 0.04) {
    freqs.forEach((f, i) => this.tone(f, dur, type, gain, null, i * 0.06));
  },

  play(name) {
    switch (name) {
      case 'seat':    this.tone(420, 0.10, 'sine', 0.035, 560); break;
      case 'menu':    this.tone(660, 0.08, 'triangle', 0.04); break;
      case 'ticket':  this.tone(880, 0.07, 'square', 0.035, 1180); break;
      case 'handoff': this.tone(300, 0.10, 'sawtooth', 0.03, 220); break;
      case 'ding':    this.tone(1320, 0.16, 'sine', 0.05, 1760); break;
      case 'pickup':  this.tone(560, 0.07, 'triangle', 0.04, 760); break;
      case 'serve':   this.chord([660, 880], 0.12, 'triangle', 0.035); break;
      case 'pay':     this.chord([880, 1108, 1320], 0.18, 'sine', 0.04); break;
      case 'angry':   this.tone(200, 0.28, 'sawtooth', 0.05, 90); break;
      case 'lost':    this.tone(260, 0.14, 'sine', 0.025, 180); break;
      case 'waste':   this.tone(150, 0.18, 'square', 0.03, 100); break;
      case 'buy':     this.chord([523, 659, 784], 0.20, 'triangle', 0.045); break;
      case 'level':   this.chord([523, 659, 784, 1046], 0.34, 'sine', 0.05); break;
      case 'mission': this.chord([784, 988, 1174], 0.24, 'triangle', 0.045); break;
      case 'win':     this.chord([523, 659, 784, 1046, 1318], 0.42, 'triangle', 0.05); break;
      case 'lose':    this.chord([392, 330, 262], 0.36, 'sawtooth', 0.045); break;
      case 'step':    this.tone(120, 0.04, 'sine', 0.012); break;
    }
  }
};
