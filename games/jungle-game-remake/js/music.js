/* Background music, synthesised like every other sound in the game — no audio files. A 16-bar
   loop in G major pentatonic at 100 BPM: soft pad and a kalimba arpeggio underneath, then a
   marimba melody, a bass and hand drums on top, plus birds calling now and then. The top layers
   fade in and out with `setIntensity` (0 = the calm bed for the start and end screens, 1 = a
   game in progress). Scheduling is the usual Web Audio look-ahead: a timer wakes every 25 ms
   and books every 16th note that falls inside the next 120 ms on the audio clock. */

const BPM = 100;
const STEP = 60 / BPM / 4;              // one 16th note, in seconds
const BAR = 16;
const midi = m => 440 * 2 ** ((m - 69) / 12);

// Chord per bar, as [bass root, pad voicing]. A: G Em C D, B: C G Am D.
const G = [43, [55, 59, 62]], Em = [40, [52, 55, 59]], C = [36, [48, 52, 55]];
const D = [38, [50, 54, 57]], Am = [45, [45, 48, 52]];
const SECTION_A = [G, Em, C, D], SECTION_B = [C, G, Am, D];

// Melody as [step within the 4-bar phrase, midi note, length in steps].
const PHRASE_A = [
  [0, 74, 2], [2, 71, 2], [4, 74, 2], [6, 79, 4], [10, 76, 2], [12, 74, 4],
  [16, 76, 2], [18, 79, 2], [20, 76, 2], [22, 74, 2], [24, 71, 4], [28, 69, 2], [30, 71, 2],
  [32, 67, 2], [34, 69, 2], [36, 71, 2], [38, 74, 2], [40, 76, 4], [44, 74, 2], [46, 76, 2],
  [48, 74, 6], [54, 69, 2], [56, 71, 2], [58, 69, 2],
];
// A again, but the last bar comes home to G
const PHRASE_A2 = [
  ...PHRASE_A.filter(([s]) => s < 48),
  [48, 69, 2], [50, 71, 2], [52, 74, 2], [54, 71, 2], [56, 67, 8],
];
const PHRASE_B = [
  [0, 76, 3], [3, 79, 3], [6, 76, 2], [8, 74, 4], [12, 71, 4],
  [16, 74, 3], [19, 71, 3], [22, 67, 2], [24, 69, 4], [28, 71, 4],
  [32, 69, 2], [34, 71, 2], [36, 74, 2], [38, 76, 2], [40, 79, 4], [44, 76, 2], [46, 74, 2],
  [48, 76, 2], [50, 74, 2], [52, 71, 2], [54, 69, 2], [56, 74, 8],
];
// The 16-bar form: A, A', B, A'
const FORM = [[SECTION_A, PHRASE_A], [SECTION_A, PHRASE_A2], [SECTION_B, PHRASE_B], [SECTION_A, PHRASE_A2]];
const LOOP = FORM.length * 4 * BAR;
const MELODY = new Map();
FORM.forEach(([, phrase], i) => phrase.forEach(([s, m, len]) => MELODY.set(i * 64 + s, [m, len])));
const chordAt = step => FORM[Math.floor(step / 64)][0][Math.floor(step / BAR) % 4];

// Hand drums per 16th: L = low drum, H = high drum, '.' = rest. Shaker plays every 16th.
const DRUMS = 'L..H..L.L.H.H..H';
const DRUM_FILL = 'L.H.L.H.LLHHLHLH';   // last bar of the loop

// `volume` is the player's music slider, 0–1. The default 0.6 keeps the music under the
// effects: its loudest bar then peaks around a third of full scale.
export function createMusic(ac, out, volume = 0.6) {
  const bus = ac.createGain();          // the player's volume, and start/stop fades
  bus.gain.value = 0;
  const hush = ac.createGain();         // silence under a win or lose jingle; separate from
  hush.connect(out);                    // `bus` so a volume change cannot cancel it
  bus.connect(hush);

  // a small generated room so the plucks do not sound bone dry
  const verb = ac.createConvolver();
  const len = Math.floor(ac.sampleRate * 1.6);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  verb.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.28;
  verb.connect(wet).connect(bus);

  const layer = gain => {
    const g = ac.createGain();
    g.gain.value = gain;
    g.connect(bus);
    g.connect(verb);
    return g;
  };
  const bed = layer(1);        // pad, arpeggio, birds: always on
  const top = layer(0);        // melody, bass, drums: faded in during a game

  const noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function osc(type, freq, t, stop, dest) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(stop);
    return o;
  }

  // marimba: a sine with a quickly fading 4th partial for the wooden knock
  function marimba(m, t, len, vel = 1) {
    const f = midi(m), decay = Math.min(1.1, 0.25 + len * STEP);
    const g = ac.createGain(); env(g, t, 0.16 * vel, 0.004, decay); g.connect(top);
    osc('sine', f, t, t + decay + 0.05, g);
    const k = ac.createGain(); env(k, t, 0.05 * vel, 0.002, 0.07); k.connect(top);
    osc('sine', f * 4, t, t + 0.1, k);
  }

  // kalimba: a short triangle tine with a faint inharmonic overtone
  function kalimba(m, t, vel = 1) {
    const f = midi(m);
    const g = ac.createGain(); env(g, t, 0.06 * vel, 0.003, 0.5); g.connect(bed);
    osc('triangle', f, t, t + 0.55, g);
    const k = ac.createGain(); env(k, t, 0.015 * vel, 0.002, 0.12); k.connect(bed);
    osc('sine', f * 5.95, t, t + 0.15, k);
  }

  function pad(notes, t) {
    const dur = BAR * STEP;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.6);
    g.gain.setValueAtTime(0.03, t + dur - 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.2);
    lp.connect(g).connect(bed);
    for (const m of notes) {
      for (const detune of [-6, 6]) osc('triangle', midi(m), t, t + dur + 0.3, lp).detune.value = detune;
    }
  }

  function bass(m, t, len) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = ac.createGain(); env(g, t, 0.2, 0.008, len * STEP * 0.9);
    lp.connect(g).connect(top);
    osc('triangle', midi(m), t, t + len * STEP + 0.05, lp);
  }

  function drum(high, t, vel = 1) {
    const g = ac.createGain(); env(g, t, (high ? 0.09 : 0.14) * vel, 0.002, high ? 0.12 : 0.22);
    g.connect(top);
    const o = osc('sine', high ? 340 : 150, t, t + 0.3, g);
    o.frequency.exponentialRampToValueAtTime(high ? 210 : 70, t + 0.12);
  }

  function shaker(t, vel) {
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = 0.5 + Math.random();
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6000;
    const g = ac.createGain(); env(g, t, 0.018 * vel, 0.004, 0.05);
    src.connect(hp).connect(g).connect(top);
    src.start(t, Math.random() * 0.8);
    src.stop(t + 0.08);
  }

  // a bird: two to four quick up-swoops, somewhere high in the trees
  function bird(t) {
    const base = 2200 + Math.random() * 1400, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const s = t + i * (0.09 + Math.random() * 0.05);
      const g = ac.createGain(); env(g, s, 0.018, 0.005, 0.07); g.connect(bed);
      const o = osc('sine', base, s, s + 0.1, g);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.4), s + 0.06);
    }
  }

  let timer = 0, step = 0, nextTime = 0, nextBird = 0, playing = false;

  function schedule(s, t) {
    const inBar = s % BAR, [root, voicing] = chordAt(s);
    if (inBar === 0) pad(voicing, t);
    // arpeggio on 8ths: root, fifth, third an octave up, fifth
    if (inBar % 2 === 0) {
      const arp = [voicing[0] + 12, voicing[2] + 12, voicing[1] + 24, voicing[2] + 12];
      kalimba(arp[(inBar / 2) % 4], t, inBar % 8 === 0 ? 1 : 0.7);
    }
    const note = MELODY.get(s);
    if (note) marimba(note[0], t, note[1], 0.85 + Math.random() * 0.15);
    if (inBar === 0) bass(root, t, 5);
    if (inBar === 6) bass(root, t, 2);
    if (inBar === 8) bass(root + 7, t, 4);
    if (inBar === 14) bass(root + 12, t, 2);
    const pattern = s >= LOOP - BAR ? DRUM_FILL : DRUMS;
    if (pattern[inBar] !== '.') drum(pattern[inBar] === 'H', t, inBar % 4 === 0 ? 1 : 0.75);
    shaker(t, inBar % 4 === 2 ? 1 : 0.45);
  }

  function tick() {
    // a throttled timer (background tab, busy frame) falls behind; skip ahead rather than
    // firing a burst of stale notes at once
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.12) {
      schedule(step, nextTime);
      if (nextTime >= nextBird) {
        bird(nextTime);
        nextBird = nextTime + 5 + Math.random() * 9;
      }
      step = (step + 1) % LOOP;
      nextTime += STEP;
    }
  }

  function fade(param, value, secs) {
    const t = ac.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    param.linearRampToValueAtTime(value, t + secs);
  }

  return {
    get playing() { return playing; },
    start() {
      if (playing) return;
      playing = true;
      step = 0;
      nextTime = ac.currentTime + 0.1;
      nextBird = nextTime + 3;
      fade(bus.gain, volume, 1.5);
      tick();
      timer = setInterval(tick, 25);
    },
    stop() {
      if (!playing) return;
      playing = false;
      fade(bus.gain, 0, 0.6);
      clearInterval(timer);
    },
    setVolume(v) {
      volume = v;
      if (playing) fade(bus.gain, volume, 0.15);
    },
    /** 0 = calm bed only, 1 = the full band. */
    setIntensity(level) { fade(top.gain, level, level ? 2 : 1.2); },
    /** Fade the music out for a jingle, keep it silent for `secs`, then fade it back in. */
    silence(secs) {
      const t = ac.currentTime;
      hush.gain.cancelScheduledValues(t);
      hush.gain.setValueAtTime(hush.gain.value, t);
      hush.gain.linearRampToValueAtTime(0, t + 0.4);
      hush.gain.setValueAtTime(0, t + secs);
      hush.gain.linearRampToValueAtTime(1, t + secs + 2.5);
    },
    /** End a silence early, e.g. a new game dealt while the fanfare is still ringing. */
    unsilence() { fade(hush.gain, 1, 0.8); },
  };
}
