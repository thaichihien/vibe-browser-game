/* Web Audio synth — no assets, house convention. Mute flag lives in
   localStorage under `animalKings.muted`, the same shape as the other games. */

const KEY = 'animalKings.muted';

export const Sound = {
  ctx: null, muted: false, master: null,

  init() {
    try { this.muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
  },

  /* browsers only hand out audio after a gesture */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem(KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    return this.muted;
  },

  tone(freq, dur, type = 'square', gain = 0.05, slideTo = null) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  noise(dur = 0.2, gain = 0.07, from = 1600, to = 240) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(from, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(amp).connect(this.master);
    src.start(t);
  },

  /* ── the game's vocabulary ────────────────────────────────────────────── */
  swing()    { this.noise(0.13, 0.05, 2600, 700); },
  hit()      { this.noise(0.16, 0.09, 900, 130); this.tone(150, 0.1, 'square', 0.045, 70); },
  chop()     { this.noise(0.11, 0.06, 1100, 220); },
  reap()     { this.noise(0.1, 0.045, 2400, 900); },
  mine()     { this.tone(320, 0.08, 'square', 0.04, 190); this.noise(0.09, 0.04, 1400, 400); },
  coin()     { this.tone(880, 0.07, 'triangle', 0.05); this.tone(1320, 0.1, 'triangle', 0.04); },
  build()    { this.tone(240, 0.09, 'square', 0.05, 420); this.noise(0.14, 0.05, 900, 200); },
  done()     { [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.13, 'triangle', 0.05), i * 70)); },
  train()    { this.tone(440, 0.08, 'square', 0.04, 660); },
  enlist()   { this.tone(392, 0.09, 'triangle', 0.05); this.tone(587, 0.12, 'triangle', 0.04); },
  order()    { this.tone(300, 0.07, 'square', 0.045, 460); },
  horn()     { this.tone(196, 0.42, 'sawtooth', 0.055, 262); },
  courier()  { this.tone(740, 0.09, 'triangle', 0.05); this.tone(988, 0.12, 'triangle', 0.04); },
  deny()     { this.tone(180, 0.16, 'square', 0.05, 90); },
  ability()  { [330, 494, 660, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.05), i * 55)); },
  death()    { this.noise(0.5, 0.1, 700, 60); this.tone(140, 0.5, 'sawtooth', 0.05, 50); },
  victory()  { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.06), i * 130)); },
  defeat()   { [440, 392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.05), i * 170)); }
};
