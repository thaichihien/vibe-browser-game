/* Web Audio synth, carried over from games/jungle-game.html unchanged so the remake sounds
   exactly like the original. Mute persists under `coThu.muted`, shared with the original. */

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked: session-only */ } },
};

export const Sound = (() => {
  let ac = null, master = null;
  let muted = store.get('coThu.muted') === '1';

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.9;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
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
    osc.connect(g); g.connect(master);
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
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  return {
    ensure,
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      store.set('coThu.muted', muted ? '1' : '0');
      if (!muted) { ensure(); this.select(); }
      return muted;
    },
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
    // Thắng: hợp âm rải đi lên
    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
      notes.forEach((f, i) => {
        tone({ freq: f, type: 'triangle', dur: 0.5, gain: 0.16, when: i * 0.12 });
        tone({ freq: f * 2, type: 'sine', dur: 0.4, gain: 0.05, when: i * 0.12 });
      });
    },
  };
})();
