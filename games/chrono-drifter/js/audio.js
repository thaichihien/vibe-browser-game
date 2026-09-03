/* Web Audio synth. No files, no network — same as every other game here.
   Mute lives in localStorage under chronoDrifter.muted. */

import { muted } from './state.js';

let ctx = null;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

function tone({ freq = 440, dur = .12, type = 'square', gain = .05, slide = 0, delay = 0 }) {
  if (muted.value) return;
  try {
    const c = ac();
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0); osc.stop(t0 + dur + .02);
  } catch { /* no audio available */ }
}

function noise({ dur = .18, gain = .06, delay = 0 }) {
  if (muted.value) return;
  try {
    const c = ac();
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = gain;
    src.connect(g).connect(c.destination);
    src.start(c.currentTime + delay);
  } catch { /* no audio available */ }
}

export const sfx = {
  select:  () => tone({ freq: 520, dur: .05, gain: .04 }),
  confirm: () => tone({ freq: 700, dur: .08, type: 'triangle', gain: .05 }),
  miss:    () => tone({ freq: 300, dur: .1, type: 'sine', slide: -120, gain: .035 }),
  hit:     () => { noise({ dur: .13, gain: .05 }); tone({ freq: 180, dur: .1, slide: -90, gain: .05 }); },
  crit:    () => { noise({ dur: .2, gain: .08 }); tone({ freq: 320, dur: .18, slide: -180, type: 'sawtooth', gain: .06 }); },
  heal:    () => { tone({ freq: 520, dur: .1, type: 'sine', gain: .05 }); tone({ freq: 780, dur: .12, type: 'sine', gain: .04, delay: .07 }); },
  buff:    () => tone({ freq: 400, dur: .14, type: 'sine', slide: 260, gain: .04 }),
  debuff:  () => tone({ freq: 300, dur: .16, type: 'sine', slide: -140, gain: .04 }),
  death:   () => tone({ freq: 220, dur: .38, type: 'sawtooth', slide: -170, gain: .05 }),
  ult:     () => { tone({ freq: 180, dur: .5, type: 'sawtooth', slide: 500, gain: .07 }); noise({ dur: .4, gain: .07, delay: .18 }); },
  win:     () => [0, .12, .24, .42].forEach((d, i) => tone({ freq: [523, 659, 784, 1047][i], dur: .3, type: 'triangle', gain: .06, delay: d })),
  lose:    () => [0, .16, .34].forEach((d, i) => tone({ freq: [392, 330, 247][i], dur: .42, type: 'triangle', gain: .06, delay: d })),
  coin:    () => { tone({ freq: 880, dur: .07, type: 'square', gain: .05 }); tone({ freq: 1320, dur: .12, type: 'square', gain: .04, delay: .06 }); }
};
