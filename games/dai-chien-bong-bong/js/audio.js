/* Web Audio synth. No asset files — every sound here is oscillators and noise,
 * same as the rest of the games in this repo. */

const KEY = 'daiChienBongBong.muted';

let ctx = null;
let master = null;
let muted = false;

try { muted = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);
  return ctx;
}

/* Browsers hold the context suspended until a gesture; the start button calls
 * this. Every sfx() also nudges it, so a stray sound never wedges the graph. */
export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  return muted;
}

function tone({ type = 'sine', from, to = from, dur = 0.12, gain = 0.2, delay = 0 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.25, gain = 0.18, delay = 0, hp = 300 }) {
  const c = ensure();
  if (!c || muted) return;
  const t0 = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'highpass';
  filt.frequency.value = hp;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filt).connect(g).connect(master);
  src.start(t0);
}

export const sfx = {
  place:   () => tone({ type: 'triangle', from: 660, to: 420, dur: 0.09, gain: 0.14 }),
  burst:   () => { noise({ dur: 0.3, gain: 0.2, hp: 220 }); tone({ type: 'sine', from: 300, to: 70, dur: 0.28, gain: 0.16 }); },
  bubble:  () => tone({ type: 'sine', from: 300, to: 900, dur: 0.2, gain: 0.18 }),
  escape:  () => tone({ type: 'square', from: 500, to: 1100, dur: 0.14, gain: 0.12 }),
  pop:     () => { tone({ type: 'square', from: 900, to: 160, dur: 0.16, gain: 0.16 }); noise({ dur: 0.14, gain: 0.12 }); },
  pickup:  () => { tone({ type: 'square', from: 880, dur: 0.07, gain: 0.12 }); tone({ type: 'square', from: 1320, dur: 0.09, gain: 0.12, delay: 0.07 }); },
  hurtBoss: () => tone({ type: 'sawtooth', from: 180, to: 120, dur: 0.1, gain: 0.1 }),
  saturate: () => { tone({ type: 'sine', from: 200, to: 1200, dur: 0.5, gain: 0.2 }); noise({ dur: 0.5, gain: 0.1, hp: 900 }); },
  phase:   () => { tone({ type: 'sawtooth', from: 110, to: 55, dur: 0.7, gain: 0.2 }); noise({ dur: 0.7, gain: 0.14, hp: 120 }); },
  telegraph: () => tone({ type: 'triangle', from: 1200, dur: 0.05, gain: 0.06 }),
  clear:   () => [0, 0.11, 0.22, 0.4].forEach((d, i) =>
    tone({ type: 'square', from: [523, 659, 784, 1047][i], dur: 0.22, gain: 0.15, delay: d })),
  fail:    () => [0, 0.14, 0.3].forEach((d, i) =>
    tone({ type: 'sawtooth', from: [392, 311, 233][i], dur: 0.3, gain: 0.16, delay: d })),
  ui:      () => tone({ type: 'square', from: 720, dur: 0.05, gain: 0.08 }),
};
