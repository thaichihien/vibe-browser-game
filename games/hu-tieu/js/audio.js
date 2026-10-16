/* Web Audio synth: kitchen effects and a gentle ngũ cung (pentatonic) loop plucked like a đàn
   tranh. Mute persists under `huTieu.muted`. */

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

export const Sound = (() => {
  let ac = null, master = null, musicGain = null, noiseBuf = null, musicTimer = null;
  let muted = store.get('huTieu.muted') === '1';
  let wantMusic = false;

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ac.destination);
      musicGain = ac.createGain();
      musicGain.gain.value = 0.22;
      musicGain.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
    return ac;
  }

  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend(); else ac.resume();
  });

  function tone(freq, { type = 'sine', dur = 0.15, gain = 0.2, slide = null, when = 0, out = null } = {}) {
    if (!ensure()) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  function noise({ dur = 0.3, gain = 0.2, freq = 1200, q = 1, type = 'bandpass', sweep = null, when = 0 } = {}) {
    if (!ensure()) return;
    const t = ac.currentTime + when;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  const fx = {
    click: () => tone(660, { type: 'square', dur: 0.05, gain: 0.05 }),
    nope: () => { tone(180, { type: 'square', dur: 0.12, gain: 0.07 }); tone(140, { type: 'square', dur: 0.12, gain: 0.07, when: 0.08 }); },
    splash: () => noise({ dur: 0.45, gain: 0.25, freq: 2500, sweep: 500, q: 0.8 }),
    plop: () => { tone(320, { dur: 0.12, gain: 0.18, slide: 160 }); noise({ dur: 0.15, gain: 0.1, freq: 900 }); },
    pour: () => noise({ dur: 0.6, gain: 0.2, freq: 700, sweep: 1600, q: 2 }),
    squeeze: () => { noise({ dur: 0.25, gain: 0.15, freq: 400, q: 4 }); tone(120, { dur: 0.15, gain: 0.08, slide: 90 }); },
    topping: () => tone(880, { type: 'triangle', dur: 0.08, gain: 0.12, slide: 1200 }),
    select: () => tone(520, { type: 'triangle', dur: 0.06, gain: 0.08 }),
    ready: () => { tone(988, { type: 'triangle', dur: 0.12, gain: 0.12 }); tone(1319, { type: 'triangle', dur: 0.18, gain: 0.12, when: 0.1 }); },
    mushy: () => tone(200, { type: 'sawtooth', dur: 0.4, gain: 0.06, slide: 110 }),
    trash: () => { noise({ dur: 0.3, gain: 0.2, freq: 300, type: 'lowpass' }); tone(90, { dur: 0.2, gain: 0.15 }); },
    teaPour: () => { noise({ dur: 1.2, gain: 0.12, freq: 1800, sweep: 3200, q: 3 }); [0.5, 0.75, 1.0].forEach(w => tone(2400 + w * 500, { dur: 0.05, gain: 0.05, when: w })); },
    serve: () => { tone(784, { type: 'triangle', dur: 0.1, gain: 0.14 }); tone(1047, { type: 'triangle', dur: 0.16, gain: 0.14, when: 0.08 }); },
    cash: () => { tone(1568, { type: 'square', dur: 0.06, gain: 0.06 }); tone(2093, { type: 'square', dur: 0.2, gain: 0.06, when: 0.07 }); noise({ dur: 0.12, gain: 0.08, freq: 5000, when: 0.02 }); },
    arrive: () => { tone(1175, { dur: 0.25, gain: 0.08 }); tone(1480, { dur: 0.3, gain: 0.06, when: 0.12 }); },
    angry: () => { tone(300, { type: 'sawtooth', dur: 0.25, gain: 0.08, slide: 180 }); tone(240, { type: 'sawtooth', dur: 0.35, gain: 0.08, slide: 120, when: 0.2 }); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.3, gain: 0.14, when: i * 0.11 })),
    lose: () => [392, 349, 311, 262].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.35, gain: 0.12, when: i * 0.16 })),
    chop: () => { for (let i = 0; i < 8; i++) { tone(260 + (i % 2) * 40, { type: 'square', dur: 0.04, gain: 0.07, when: i * 0.15 }); noise({ dur: 0.05, gain: 0.12, freq: 2200, when: i * 0.15 }); } },
    chopped: () => tone(1320, { type: 'triangle', dur: 0.15, gain: 0.1 }),
    pepper: () => [0, 0.07, 0.14].forEach(w => noise({ dur: 0.06, gain: 0.12, freq: 6000, q: 2, when: w })),
    star: () => tone(1760, { type: 'triangle', dur: 0.25, gain: 0.12, slide: 2350 }),
  };

  /* Music: a slow walk over the Vietnamese pentatonic (hò, xự, xang, xê, cống), plucked. */
  const SCALE = [293.66, 349.23, 392, 440, 523.25, 587.33, 698.46, 784];
  let pos = 3;
  function pluck(f, when, gain = 0.5) {
    tone(f, { type: 'triangle', dur: 1.1, gain, when, slide: f * 0.995, out: musicGain });
    tone(f * 2, { type: 'sine', dur: 0.4, gain: gain * 0.25, when, out: musicGain });
  }
  function phrase() {
    if (!ac || muted || !wantMusic) return;
    const beat = 0.42;
    for (let i = 0; i < 8; i++) {
      if (Math.random() < 0.18) continue;
      pos = Math.max(0, Math.min(SCALE.length - 1, pos + [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)]));
      pluck(SCALE[pos], i * beat + (i % 2 ? 0.03 : 0), i % 4 === 0 ? 0.55 : 0.38);
      // the đàn tranh's signature bend on the long notes
      if (i === 7 && Math.random() < 0.6) tone(SCALE[pos], { type: 'triangle', dur: 0.7, gain: 0.18, when: i * beat + 0.2, slide: SCALE[pos] * 1.06, out: musicGain });
    }
    pluck(SCALE[0] / 2, 0, 0.35);
    pluck(SCALE[2] / 2, beat * 4, 0.3);
  }
  function startMusic() {
    wantMusic = true;
    if (musicTimer || !ensure()) return;
    phrase();
    musicTimer = setInterval(phrase, 0.42 * 8 * 1000);
  }
  function stopMusic() {
    wantMusic = false;
    clearInterval(musicTimer);
    musicTimer = null;
  }

  return {
    play(name) { if (!muted && fx[name]) fx[name](); },
    unlock: ensure,
    startMusic, stopMusic,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      store.set('huTieu.muted', muted ? '1' : '0');
      if (ensure()) master.gain.value = muted ? 0 : 0.8;
      return muted;
    },
  };
})();
