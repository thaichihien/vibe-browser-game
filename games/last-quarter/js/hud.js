/* Everything outside the bezel: the face, the comment feed and the keycaps.
 *
 * These three things are the only instruments the game gives you. Patience is
 * never drawn as a bar: the face reports where it stands, the picture falling
 * apart reports the misses that are taking it, and the keycaps show the call
 * you are about to answer or ignore.
 */

const FEED_MAX = 34;
const TYPE_CPS = 62;

export function initHud() {
  const hud = makeHud();
  /* Reading back through the log parks the feed; returning to the bottom
   * re-arms the follow. */
  hud.feed.addEventListener('scroll', () => {
    const gap = hud.feed.scrollHeight - hud.feed.scrollTop - hud.feed.clientHeight;
    hud.stick = gap < 24;
  });
  return hud;
}

function makeHud() {
  return {
    stick: true,
    face: document.getElementById('face'),
    head: document.getElementById('face-head'),
    hat: document.getElementById('face-hat'),
    acc: document.getElementById('face-acc'),
    body: document.getElementById('watcher'),
    name: document.getElementById('who-name'),
    tag: document.getElementById('who-tag'),
    feed: document.getElementById('feed'),
    caps: {
      left: document.getElementById('cap-left'),
      right: document.getElementById('cap-right'),
      jump: document.getElementById('cap-jump'),
    },
    /* your own presses are single-frame pulses now, so the cap has to hold the
     * marker open long enough to see */
    youFlash: { left: 0, right: 0, jump: 0 },
    pending: [],
    typing: null,
    lastFace: '',
    lastMood: '',
  };
}

export function setIdentity(hud, profile) {
  hud.name.textContent = profile.name;
  hud.tag.textContent = profile.tag;
  hud.head.textContent = profile.face;
  hud.hat.textContent = profile.hat || '';
  hud.acc.textContent = profile.acc || '';
  hud.lastFace = profile.face;
}

export function clearFeed(hud) {
  hud.feed.innerHTML = '';
  hud.pending.length = 0;
  hud.typing = null;
  hud.stick = true;
}

export function pushLine(hud, text, mood = 'neutral') {
  hud.pending.push({ text, mood });
  if (hud.pending.length > 6) hud.pending.splice(0, hud.pending.length - 6);
}

/* Patience is the number, but the face has to report two different things about
 * it: where it stands, and whether it is being taken by misses right now. So
 * recent divergence (`heat`) overrides the stages — someone mid-argument with a
 * cabinet does not look bored, they look annoyed. */
function faceFor(d) {
  if (d.heat > 0.78) return '😠';
  if (d.heat > 0.54) return '🤨';
  if (d.patience > 82) return '🤩';
  if (d.patience > 64) return '😀';
  if (d.patience > 46) return '🙂';
  if (d.patience > 30) return '😐';
  if (d.patience > 15) return '😒';
  return '🥱';
}

function postureFor(d) {
  if (d.heat > 0.54) return 'squint';
  if (d.patience > 70) return 'lean';
  if (d.patience < 32) return 'slump';
  return '';
}

export function updateHud(hud, d, human, you, dt) {
  /* face */
  const f = faceFor(d);
  if (f !== hud.lastFace) {
    hud.lastFace = f;
    hud.head.textContent = f;   // only the head swaps — the hat stays on
    hud.face.classList.remove('pop');
    void hud.face.offsetWidth;
    hud.face.classList.add('pop');
  }
  const posture = postureFor(d);
  if (posture !== hud.lastMood) {
    hud.lastMood = posture;
    hud.body.className = 'watcher ' + posture;
  }

  /* keycaps: filled = their hand, outlined = yours, hatched = a visible lie.
   * The bar underneath is the timing: amber filling = a press is on its way,
   * cyan draining = their press has landed and yours has to fall inside it. */
  const lag = human.lag || 0.3;
  const incoming = key => human.dueIn[key] === null ? -1 : 1 - Math.min(1, human.dueIn[key] / lag);

  for (const k of ['left', 'right', 'jump']) {
    if (you[k]) hud.youFlash[k] = 0.22;
    else if (hud.youFlash[k] > 0) hud.youFlash[k] = Math.max(0, hud.youFlash[k] - dt);
  }

  /* Every cap reads its own judging channel. On machines that hold a direction
   * rather than tapping it, the left and right channels stay inert and those
   * caps simply never light a window — same instrument, fewer moving parts. */
  const chan = key => {
    const c = d.chan[key];
    return {
      window: c.windowLeft > 0 ? c.windowLeft / c.windowTotal : -1,
      verdict: c.verdictT > 0 ? c.verdict : null,
    };
  };

  for (const k of ['left', 'right', 'jump']) {
    cap(hud.caps[k], {
      theirs: human.held[k], yours: hud.youFlash[k] > 0,
      tele: incoming(k), clash: d.clash[k] > 0, ...chan(k),
    });
  }

  drainComments(hud, d);
  typeStep(hud, dt);
}

function cap(el, s) {
  const window = s.window ?? -1;
  const tele = s.tele ?? -1;

  el.classList.toggle('human', !!s.theirs);
  el.classList.toggle('you', !!s.yours);
  el.classList.toggle('clash', !!s.clash);

  /* The open accept window outranks the incoming telegraph — once their press
   * has landed, "jump now" is the only thing worth saying. */
  el.classList.toggle('window', window >= 0);
  el.classList.toggle('tele', window < 0 && tele >= 0 && !s.theirs);
  el.style.setProperty('--p', String(window >= 0 ? window : Math.max(0, tele)));

  el.classList.toggle('hit', s.verdict === 'hit');
  el.classList.toggle('miss', s.verdict === 'miss');
}

function drainComments(hud, d) {
  while (d.feed.length) {
    const c = d.feed.shift();
    pushLine(hud, c.text, c.mood);
  }
}

function typeStep(hud, dt) {
  if (!hud.typing) {
    const next = hud.pending.shift();
    if (!next) return;
    const el = document.createElement('div');
    el.className = 'bubble ' + next.mood;
    hud.feed.appendChild(el);
    while (hud.feed.childElementCount > FEED_MAX) hud.feed.removeChild(hud.feed.firstChild);
    hud.typing = { el, text: next.text, i: 0 };
  }
  const t = hud.typing;
  t.i = Math.min(t.text.length, t.i + TYPE_CPS * dt);
  t.el.textContent = t.text.slice(0, Math.floor(t.i));

  /* Only follow the feed if the reader is already at the bottom. Pinning
   * scrollTop every frame made scrolling back through the log impossible. */
  if (hud.stick) hud.feed.scrollTop = hud.feed.scrollHeight;

  if (t.i >= t.text.length) hud.typing = null;
}
