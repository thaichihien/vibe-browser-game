/* Background music: a shuffled playlist with a beat of silence between tracks.

   This is the only part of the game that loads an asset. Everything is
   defensive about it — a missing or unplayable file just moves the playlist
   along, so the game never waits on audio it did not get. */

const KEY = 'gridStorm.musicOff';

const TRACKS = [
  'music/neon-static.mp3',
  'music/neon-static-2.mp3',
  'music/neon-pixel-rush.mp3'
];

const VOLUME = 0.27;         // 15% under the first pass; sound effects unchanged
const REST   = [1.0, 2.0];   // seconds of quiet between tracks
const FADE   = 1.2;          // seconds to fade a track in

export const Music = {
  off: false,        // the player's music toggle
  suspended: false,  // paused by the pause screen or a hidden tab
  master: false,     // the master mute (shared with the sound effects)
  wantPlay: false,   // has the run started at all
  resting: false,    // currently in the gap between two tracks

  els: [],
  order: [],
  pos: 0,
  current: null,
  restTimer: 0,
  fadeTimer: 0,

  init() {
    try { this.off = localStorage.getItem(KEY) === '1'; } catch { /* private mode */ }

    this.els = TRACKS.map(src => {
      const el = new Audio(src);
      el.preload = 'auto';
      el.volume = 0;

      el.addEventListener('ended', () => this._finished(el));
      el.addEventListener('error', () => this._finished(el));   // bad file? next one

      return el;
    });

    this._reshuffle();
  },

  /* called from the first real gesture — browsers refuse audio before one */
  begin() {
    if (this.wantPlay) return;
    this.wantPlay = true;
    this._refresh();
  },

  toggle() {
    this.off = !this.off;
    try { localStorage.setItem(KEY, this.off ? '1' : '0'); } catch { /* ignore */ }
    this._refresh();
    return this.off;
  },

  setMaster(muted) {
    this.master = muted;
    this._refresh();
  },

  /* pause/resume for the pause screen and for the tab going away */
  pause() {
    this.suspended = true;
    this._refresh();
  },

  resume() {
    this.suspended = false;
    this._refresh();
  },

  /* ── internals ──────────────────────────────────────────────────────── */

  _audible() {
    return this.wantPlay && !this.off && !this.master && !this.suspended;
  },

  _refresh() {
    if (this._audible()) {
      if (this.resting) {
        if (!this.restTimer) this._scheduleNext();
      } else if (!this.current) {
        this._playNext();
      } else if (this.current.paused) {
        this.current.play().catch(() => this._finished(this.current));
      }
      return;
    }

    if (this.current) this.current.pause();
    clearTimeout(this.restTimer);
    this.restTimer = 0;
  },

  _finished(el) {
    if (el !== this.current) return;
    this.resting = true;
    this.current = null;
    if (this._audible()) this._scheduleNext();
  },

  _scheduleNext() {
    clearTimeout(this.restTimer);
    const rest = (REST[0] + Math.random() * (REST[1] - REST[0])) * 1000;

    this.restTimer = setTimeout(() => {
      this.restTimer = 0;
      this.resting = false;
      if (this._audible()) this._playNext();
    }, rest);
  },

  _playNext() {
    if (this.pos >= this.order.length) this._reshuffle();

    const el = this.order[this.pos++];
    this.current = el;

    el.currentTime = 0;
    el.volume = 0;
    el.play().then(() => this._fadeIn(el)).catch(() => this._finished(el));
  },

  _fadeIn(el) {
    clearInterval(this.fadeTimer);
    const step = VOLUME / (FADE * 20);

    this.fadeTimer = setInterval(() => {
      if (el !== this.current) { clearInterval(this.fadeTimer); return; }
      el.volume = Math.min(VOLUME, el.volume + step);
      if (el.volume >= VOLUME) clearInterval(this.fadeTimer);
    }, 50);
  },

  /* shuffle, but never let a track follow itself across the wrap */
  _reshuffle() {
    const last = this.order[this.order.length - 1];
    const next = [...this.els];

    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    if (next.length > 1 && next[0] === last) [next[0], next[1]] = [next[1], next[0]];

    this.order = next;
    this.pos = 0;
  }
};
