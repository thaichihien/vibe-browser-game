/* Warfield Chess — Web Audio synth, no files. Ambient wind and birdsong under everything; drums
   while a unit marches; a horn when orders are given; steel and shouting when units clash.
   Two buses under the master: effects (horns, drums, battle) and ambience (wind, birds), each
   with its own volume from the settings. Mute persists under `warfieldChess.muted`. */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

export const Sound = (() => {
  let ac = null, master = null, sfxBus = null, ambBus = null, noiseBuf = null, windGain = null;
  let vol = { sfx: 1, amb: 1 };
  let muted = store.get('warfieldChess.muted') === '1';
  let drumTimer = null, birdTimer = null, paused = false;

  function ensure() {
    if (ac) { if (ac.state === 'suspended' && !paused) ac.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    ambBus = ac.createGain(); ambBus.gain.value = vol.amb; ambBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startAmbience();
    return true;
  }

  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden || paused) ac.suspend(); else ac.resume();
  });

  function noise(dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.3, attack = 0.005, at = 0, bus = sfxBus } = {}) {
    const t = ac.currentTime + at;
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  function tone(freq, dur, { type = 'sine', gain = 0.2, at = 0, to = null, attack = 0.01, bus = sfxBus } = {}) {
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function startAmbience() {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 420;
    windGain = ac.createGain();
    windGain.gain.value = 0.05;
    const lfo = ac.createOscillator(), lfoG = ac.createGain();
    lfo.frequency.value = 0.09; lfoG.gain.value = 0.03;
    lfo.connect(lfoG).connect(windGain.gain);
    src.connect(f).connect(windGain).connect(ambBus);
    src.start(); lfo.start();
    const bird = () => {
      if (!muted && Math.random() < 0.7) {
        const base = 2400 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) tone(base, 0.09, { at: i * 0.13, to: base * (1.2 + Math.random() * 0.3), gain: 0.025, type: 'sine', bus: ambBus });
      }
      birdTimer = setTimeout(bird, 3000 + Math.random() * 6000);
    };
    birdTimer = setTimeout(bird, 2000);
  }

  function drum(at = 0, gain = 0.35) {
    tone(95, 0.35, { at, to: 48, gain, type: 'sine', attack: 0.004 });
    noise(0.12, { type: 'lowpass', freq: 600, gain: gain * 0.4, at });
  }

  return {
    get muted() { return muted; },
    unlock() { ensure(); },
    /** Pause menu open: everything falls silent until it closes. */
    setPaused(on) {
      paused = on;
      if (!ac) return;
      if (on) ac.suspend(); else if (!document.hidden) ac.resume();
    },
    /** Effects and ambience volumes, 0..1. */
    setVolumes(sfx, amb) {
      vol = { sfx, amb };
      if (!ac) return;
      sfxBus.gain.setTargetAtTime(sfx, ac.currentTime, 0.05);
      ambBus.gain.setTargetAtTime(amb, ac.currentTime, 0.05);
    },
    toggle() {
      muted = !muted;
      store.set('warfieldChess.muted', muted ? '1' : '0');
      if (ensure()) master.gain.setTargetAtTime(muted ? 0 : 0.8, ac.currentTime, 0.05);
      return muted;
    },
    select() { if (!ensure()) return; tone(520, 0.08, { type: 'triangle', gain: 0.12 }); tone(780, 0.1, { type: 'triangle', gain: 0.08, at: 0.05 }); },
    target() { if (!ensure()) return; tone(330, 0.12, { type: 'triangle', gain: 0.12 }); },
    refuse() { if (!ensure()) return; tone(140, 0.25, { type: 'sawtooth', gain: 0.08, to: 110 }); tone(147, 0.25, { type: 'square', gain: 0.03 }); },
    horn(gain = 0.13) {
      if (!ensure()) return;
      const play = (f, at, dur) => {
        tone(f, dur, { type: 'sawtooth', gain, at, attack: 0.08 });
        tone(f * 1.003, dur, { type: 'sawtooth', gain: gain * 0.6, at, attack: 0.1 });
      };
      play(196, 0, 0.5); play(262, 0.42, 0.9);
    },
    distantHorn() { this.horn(0.035); },
    marchStart() {
      if (!ensure()) return;
      clearInterval(drumTimer);
      let beat = 0;
      drum(0);
      drumTimer = setInterval(() => { if (!paused) drum(0, beat++ % 2 ? 0.22 : 0.35); }, 330);
    },
    marchStop() { clearInterval(drumTimer); drumTimer = null; },
    clash() {
      if (!ensure()) return;
      for (let i = 0; i < 14; i++) {
        const at = Math.random() * 1.4;
        noise(0.08, { type: 'highpass', freq: 3000 + Math.random() * 3000, gain: 0.12, at });
        tone(1800 + Math.random() * 2400, 0.18, { type: 'triangle', gain: 0.05, at });
      }
      noise(1.6, { type: 'bandpass', freq: 500, q: 0.6, gain: 0.12, attack: 0.15 });
      tone(200, 0.6, { type: 'sawtooth', gain: 0.04, to: 160, at: 0.1 });
    },
    farBattle() { if (!ensure()) return; noise(1.4, { type: 'lowpass', freq: 350, gain: 0.08, attack: 0.3 }); drum(0.2, 0.1); },
    alarm() { if (!ensure()) return; for (let i = 0; i < 3; i++) tone(440, 0.18, { type: 'square', gain: 0.05, at: i * 0.22 }); },
    victory() { if (!ensure()) return; [262, 330, 392, 523].forEach((f, i) => tone(f, 0.7, { type: 'sawtooth', gain: 0.07, at: i * 0.22, attack: 0.05 })); },
    defeat() { if (!ensure()) return; [392, 330, 262, 196].forEach((f, i) => tone(f, 0.8, { type: 'triangle', gain: 0.1, at: i * 0.3 })); },
  };
})();
