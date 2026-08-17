/* Web Audio synth — no assets, house convention. Mute flag lives in
   localStorage under `gridStorm.muted`, same shape as the other games. */

const KEY = 'gridStorm.muted';

export const Sound = {
  ctx: null,
  muted: false,

  init() {
    try { this.muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
  },

  /* browsers only hand out audio after a gesture, so this is called on start */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggle() {
    this.muted = !this.muted;
    try { localStorage.setItem(KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    return this.muted;
  },

  tone(freq, dur, type = 'square', gain = 0.06, slideTo = null) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);

    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(amp).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  },

  noise(dur = 0.25, gain = 0.09, filterFrom = 1800, filterTo = 200) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(filterFrom, t);
    filt.frequency.exponentialRampToValueAtTime(filterTo, t + dur);

    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filt).connect(amp).connect(this.ctx.destination);
    src.start(t);
  },

  /* named cues, so callers never think about waveforms */
  step()    { this.tone(420, 0.05, 'square', 0.025); },
  fire()    { this.tone(300, 0.09, 'sawtooth', 0.028, 140); },
  warn()    { this.tone(880, 0.10, 'triangle', 0.05); },
  charge()  { this.tone(180, 0.55, 'sawtooth', 0.045, 900); },
  blast()   { this.noise(0.35, 0.12); this.tone(90, 0.3, 'square', 0.05, 40); },
  /* a short metal hit — lighter than blast(), because the press lands 20 times */
  press()   { this.tone(160, 0.13, 'square', 0.05, 62); this.noise(0.12, 0.06, 900, 220); },
  hoof()    { this.tone(150, 0.09, 'triangle', 0.045, 72); this.noise(0.07, 0.045, 700, 180); },
  bloom()   { this.tone(660, 0.18, 'triangle', 0.05, 1200); },
  pickup()  { this.tone(760, 0.09, 'triangle', 0.07); setTimeout(() => this.tone(1140, 0.14, 'triangle', 0.06), 80); },
  event()   { this.tone(140, 0.5, 'sawtooth', 0.05, 520); this.noise(0.5, 0.05, 900, 300); },
  expand()  { this.tone(220, 0.9, 'triangle', 0.07, 880); },
  die()     { this.noise(0.7, 0.16, 1400, 60); this.tone(300, 0.8, 'sawtooth', 0.07, 45); }
};
