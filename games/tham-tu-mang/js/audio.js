/* Web Audio synth — không có tệp âm thanh nào, theo quy ước của repo. */

import { isMuted } from './storage.js';

let ac = null;

export function beep(kind) {
  if (isMuted()) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const now = ac.currentTime;

    const tone = { good: 660, bad: 130, void: 300 }[kind] ?? 300;
    osc.type = kind === 'bad' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(tone, now);
    if (kind === 'good') osc.frequency.exponentialRampToValueAtTime(tone * 1.5, now + 0.12);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch { /* audio is decoration; never let it break a run */ }
}
