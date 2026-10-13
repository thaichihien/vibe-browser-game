/* Web Audio synth. The effects from select() to rumble() are carried over from
   games/jungle-game.html unchanged, so the remake sounds like the original; win() and
   everything after it (animal cries, dice, deal, whoosh, chimes) and the music in music.js are
   the remake's own. Mute persists under `coThu.muted`, shared with the original; the two volume sliders
   under `coThu.musicVol` and `coThu.sfxVol` (0–1). */
import { createMusic } from './music.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: session-only */ } },
};

export const Sound = (() => {
  let ac = null, master = null, sfx = null, music = null;
  let muted = store.get('coThu.muted') === '1';
  const vol = (k, d) => { const v = parseFloat(store.get(k)); return v >= 0 && v <= 1 ? v : d; };
  let musicVol = vol('coThu.musicVol', 0.6);
  let sfxVol = vol('coThu.sfxVol', 1);
  let scene = null;           // 'menu' | 'game' once the player has picked a mode
  let aiSide = null;          // win() plays the losing jingle when this side wins

  // Music only plays when sound is on, its slider is above zero, and a game has been started.
  function syncMusic() {
    if (!ac) return;
    if (muted || musicVol === 0 || !scene) { music?.stop(); return; }
    music ??= createMusic(ac, master, musicVol);
    music.setVolume(musicVol);
    music.start();
    music.setIntensity(scene === 'game' ? 1 : 0);
  }

  // a background tab should not keep the jungle playing
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) ac.suspend();
    else ac.resume();
  });

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
      sfx = ac.createGain();          // every effect goes through here; music has its own bus
      sfx.gain.value = sfxVol;
      sfx.connect(master);
      syncMusic();
    }
    if (ac.state === 'suspended' && !document.hidden) ac.resume();
    return ac;
  }

  // Nốt từ oscillator, có thể trượt cao độ
  function tone({ freq = 440, type = 'sine', dur = 0.15, gain = 0.2, attack = 0.006, release = null, slideTo = null, when = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    const rel = release ?? dur;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + rel);
    osc.connect(g); g.connect(sfx);
    osc.start(t0); osc.stop(t0 + rel + 0.03);
  }

  // Tiếng ồn lọc (va chạm, nước, kim loại)
  function noise({ dur = 0.2, gain = 0.2, type = 'bandpass', freq = 1000, q = 1, freqTo = null, when = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ac.currentTime + when;
    const frames = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(); src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = type; filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t0);
    if (freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(sfx);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  // An animal-ish voice: an oscillator whose pitch follows `curve` (Hz, evenly spaced over
  // `dur`), with optional vibrato (fast = a growl) and a filter sweep for the mouth.
  function cry({ type = 'sawtooth', curve, dur, gain, vib = 0, vibDepth = 0, filter = 'lowpass',
    filterFreq = 2000, filterTo = null, q = 1, when = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(curve[0], t0);
    curve.slice(1).forEach((f, i) => osc.frequency.linearRampToValueAtTime(f, t0 + dur * (i + 1) / (curve.length - 1)));
    let lfo = null;
    if (vib) {
      lfo = ac.createOscillator();
      lfo.frequency.value = vib;
      const depth = ac.createGain();
      depth.gain.value = vibDepth;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.05);
    }
    const flt = ac.createBiquadFilter();
    flt.type = filter; flt.Q.value = q;
    flt.frequency.setValueAtTime(filterFreq, t0);
    if (filterTo) flt.frequency.exponentialRampToValueAtTime(filterTo, t0 + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.04, dur * 0.2));
    g.gain.setValueAtTime(gain, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(flt).connect(g).connect(sfx);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // One call per animal; `v` scales the volume (a pick is quieter than a capture).
  const CRIES = {
    rat(v) {
      [0, 0.07, 0.13].forEach(w => tone({ freq: 2300, type: 'sine', dur: 0.05, gain: 0.07 * v, slideTo: 3300, when: w }));
    },
    cat(v) {
      cry({ curve: [480, 760, 690, 430], dur: 0.38, gain: 0.08 * v, filter: 'bandpass', filterFreq: 1100, filterTo: 1700, q: 2, vib: 6, vibDepth: 10 });
    },
    dog(v) {
      [0, 0.15].forEach(w => {
        cry({ type: 'square', curve: [330, 420, 200], dur: 0.1, gain: 0.08 * v, filterFreq: 1300, when: w });
        noise({ dur: 0.06, gain: 0.05 * v, type: 'bandpass', freq: 900, when: w });
      });
    },
    wolf(v) {
      cry({ type: 'triangle', curve: [300, 520, 560, 500, 380], dur: 0.75, gain: 0.11 * v, filterFreq: 1600, vib: 5, vibDepth: 9 });
    },
    leopard(v) {
      cry({ curve: [180, 150, 120], dur: 0.32, gain: 0.09 * v, filterFreq: 900, filterTo: 400, vib: 28, vibDepth: 22 });
      noise({ dur: 0.25, gain: 0.05 * v, type: 'bandpass', freq: 1400, freqTo: 600, q: 1.2 });
    },
    tiger(v) {
      cry({ curve: [110, 170, 150, 85], dur: 0.6, gain: 0.13 * v, filterFreq: 800, filterTo: 260, vib: 24, vibDepth: 16 });
      noise({ dur: 0.55, gain: 0.08 * v, type: 'lowpass', freq: 900, freqTo: 200 });
    },
    lion(v) {
      cry({ curve: [85, 140, 120, 65], dur: 0.8, gain: 0.15 * v, filterFreq: 700, filterTo: 200, vib: 20, vibDepth: 14 });
      noise({ dur: 0.7, gain: 0.09 * v, type: 'lowpass', freq: 700, freqTo: 150 });
    },
    elephant(v) {
      cry({ curve: [380, 720, 760, 640], dur: 0.6, gain: 0.09 * v, filter: 'bandpass', filterFreq: 1300, q: 1.4, vib: 7, vibDepth: 28 });
      cry({ type: 'square', curve: [190, 360, 380, 320], dur: 0.6, gain: 0.03 * v, filterFreq: 1500, vib: 7, vibDepth: 14 });
    },
  };

  return {
    ensure,
    get muted() { return muted; },
    get musicVolume() { return musicVol; },
    get sfxVolume() { return sfxVol; },
    toggle() {
      muted = !muted;
      store.set('coThu.muted', muted ? '1' : '0');
      if (!muted) { ensure(); this.select(); }
      syncMusic();
      return muted;
    },
    setMusicVolume(v) {
      musicVol = Math.min(1, Math.max(0, v));
      store.set('coThu.musicVol', String(musicVol));
      ensure();
      syncMusic();
    },
    setSfxVolume(v) {
      sfxVol = Math.min(1, Math.max(0, v));
      store.set('coThu.sfxVol', String(sfxVol));
      if (ensure()) sfx.gain.setTargetAtTime(sfxVol, ac.currentTime, 0.03);
    },
    /** 'menu' = calm bed, 'game' = the full band. */
    setScene(next) {
      scene = next;
      if (next === 'game') music?.unsilence();
      syncMusic();
    },
    setAiSide(side) { aiSide = side; },
    // Chọn quân: blip nhẹ đi lên
    select() { tone({ freq: 560, type: 'triangle', dur: 0.08, gain: 0.11, slideTo: 820 }); },
    // Di chuyển: cú đáp mềm
    move() {
      tone({ freq: 210, type: 'triangle', dur: 0.13, gain: 0.15, slideTo: 130 });
      noise({ dur: 0.08, gain: 0.05, type: 'lowpass', freq: 800 });
    },
    // Ăn quân: thình + chém; thú lớn (rank cao) nghe nặng hơn
    capture(rank = 4) {
      const base = 260 - rank * 14;
      noise({ dur: 0.24, gain: 0.30, type: 'lowpass', freq: 460, freqTo: 110 });
      tone({ freq: base, type: 'square', dur: 0.2, gain: 0.22, slideTo: base * 0.4 });
      noise({ dur: 0.16, gain: 0.13, type: 'bandpass', freq: 2700, freqTo: 900, q: 0.8, when: 0.02 });
    },
    // Chuột bơi: nước bắn
    splash() {
      noise({ dur: 0.3, gain: 0.18, type: 'bandpass', freq: 700, freqTo: 2500, q: 0.6 });
      noise({ dur: 0.22, gain: 0.09, type: 'highpass', freq: 1300, when: 0.03 });
      tone({ freq: 900, type: 'sine', dur: 0.12, gain: 0.06, slideTo: 1500, when: 0.02 });
    },
    // Sập bẫy: tiếng "clack" kim loại
    trap() {
      noise({ dur: 0.06, gain: 0.30, type: 'highpass', freq: 2600 });
      tone({ freq: 190, type: 'square', dur: 0.05, gain: 0.18, slideTo: 80 });
      tone({ freq: 1500, type: 'square', dur: 0.04, gain: 0.10, when: 0.03 });
    },
    // Rung bàn cờ: tiếng ầm trầm; "heavy" sâu và to hơn "soft"
    rumble(intensity = 'heavy') {
      const heavy = intensity !== 'soft';
      noise({ dur: heavy ? 0.5 : 0.28, gain: heavy ? 0.34 : 0.15, type: 'lowpass', freq: heavy ? 260 : 200, freqTo: heavy ? 55 : 80 });
      tone({ freq: heavy ? 90 : 120, type: 'sine', dur: heavy ? 0.45 : 0.24, gain: heavy ? 0.22 : 0.11, slideTo: heavy ? 40 : 70 });
    },
    // Thắng: tiếng kêu của chính con thú vừa thắng, rồi kèn marimba rừng xanh trên nền trống
    // tay, kết bằng hợp âm ngân và tiếng chim. Khi máy thắng thì phát nhạc thua thay vào đó.
    win(player, type) {
      if (aiSide && player === aiSide) { this.lose(); return; }
      music?.silence(type ? 5 : 4.3);   // the whole fanfare, plus a moment of quiet after it
      if (type) CRIES[type]?.(1);
      const at = type ? 0.75 : 0.6;     // let the roar land first; the drum roll starts at at - 0.6
      // marimba: a sine plus a quick 4th partial for the wooden knock
      const mallet = (f, when, gain = 0.15, dur = 0.35) => {
        tone({ freq: f, type: 'sine', dur, gain, when });
        tone({ freq: f * 4, type: 'sine', dur: 0.06, gain: gain * 0.3, when });
      };
      // hand-drum roll that speeds up into the fanfare
      [0, 0.16, 0.29, 0.39, 0.47, 0.53, 0.58].forEach((w, i) => {
        tone({ freq: i % 2 ? 330 : 180, type: 'sine', dur: 0.12, gain: 0.1, slideTo: i % 2 ? 210 : 80, when: at - 0.6 + w });
      });
      // fanfare in G, the key of the music: G B D G, D G, then up to B
      const G4 = 392, B4 = 493.88, D5 = 587.33, G5 = 783.99, B5 = 987.77, D6 = 1174.66;
      [[G4, 0], [B4, 0.11], [D5, 0.22], [G5, 0.33], [D5, 0.55], [G5, 0.66], [B5, 0.77]]
        .forEach(([f, w]) => mallet(f, at + w));
      tone({ freq: 98, type: 'sine', dur: 0.5, gain: 0.18, slideTo: 60, when: at });      // low thump
      tone({ freq: 98, type: 'sine', dur: 0.6, gain: 0.18, slideTo: 60, when: at + 0.77 });
      // held G major chord, tremolo on the mallets, with a slow triangle swell under it
      const hold = at + 1.0;
      for (let k = 0; k < 10; k++) {
        const fade = 1 - k / 10;
        [G5, B5, D6].forEach(f => mallet(f, hold + k * 0.09, 0.07 * fade, 0.25));
      }
      [G4, B4, D5].forEach(f => tone({ freq: f, type: 'triangle', dur: 1.6, gain: 0.07, attack: 0.15, when: hold }));
      // birds answer from the trees
      for (let i = 0; i < 6; i++) {
        const f = 2400 + Math.random() * 1600;
        tone({ freq: f, type: 'sine', dur: 0.07, gain: 0.04, slideTo: f * 1.45, when: hold + 0.5 + i * 0.13 + Math.random() * 0.05 });
      }
    },

    // ---------- the remake's own sounds ----------
    /** The animal's own call: quiet when picked, full on a capture. */
    voice(type, v = 1) { CRIES[type]?.(v); },
    // Thua máy: ba nốt đi xuống, nốt cuối rung nhẹ
    lose() {
      music?.silence(3.5);
      [392, 349.23, 311.13].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.38, gain: 0.14, when: i * 0.3 }));
      cry({ type: 'triangle', curve: [261.63, 255, 261.63, 250], dur: 0.9, gain: 0.12, filterFreq: 1500, vib: 5, vibDepth: 6, when: 0.9 });
    },
    // Bốc thăm lượt đi: xúc xắc lăn lóc cóc rồi một tiếng "ding"
    dice() {
      [0, 0.06, 0.11, 0.17, 0.25, 0.36].forEach((w, i) => {
        noise({ dur: 0.03, gain: 0.12, type: 'bandpass', freq: 1800 + (i % 3) * 600, q: 3, when: w });
        tone({ freq: 700 + (i % 2) * 250, type: 'square', dur: 0.025, gain: 0.03, when: w });
      });
      tone({ freq: 1318.5, type: 'sine', dur: 0.45, gain: 0.1, when: 0.5 });
      tone({ freq: 1975.5, type: 'sine', dur: 0.35, gain: 0.04, when: 0.5 });
    },
    // Chia quân: tiếng "pốp" nhỏ, mỗi quân cao hơn quân trước một chút
    plop(i = 0) {
      tone({ freq: 260 + i * 22, type: 'sine', dur: 0.09, gain: 0.07, slideTo: 520 + i * 30 });
    },
    // Nhảy qua sông: tiếng gió vút
    whoosh() {
      noise({ dur: 0.45, gain: 0.12, type: 'bandpass', freq: 400, freqTo: 2400, q: 0.8 });
    },
    // Đến lượt bạn (khi đấu với máy): hai nốt chuông
    turn() {
      tone({ freq: 880, type: 'sine', dur: 0.18, gain: 0.07 });
      tone({ freq: 1174.7, type: 'sine', dur: 0.3, gain: 0.07, when: 0.11 });
    },
    // Nước đi không hợp lệ: tiếng "bụp" trầm
    error() {
      tone({ freq: 180, type: 'square', dur: 0.09, gain: 0.07, slideTo: 140 });
      tone({ freq: 150, type: 'square', dur: 0.12, gain: 0.07, slideTo: 110, when: 0.1 });
    },
  };
})();
