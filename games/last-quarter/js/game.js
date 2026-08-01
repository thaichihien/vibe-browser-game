/* Loop, screens, input and progression. */
import { LEVELS } from './levels.js';
import { STORE_PROGRESS, DEBUG, TIME_SCALE } from './config.js';
import { buildWorld, stepWorld } from './physics.js';
import { makeHuman, humanReset, updateHuman } from './human.js';
import { makeDirector, updateDirector, directorEvent, reportFor, say } from './director.js';
import { initRenderer, drawFrame, burst } from './render.js';
import { initHud, setIdentity, clearFeed, updateHud } from './hud.js';
import { Sound } from './audio.js';

const S = {
  TITLE: 'title', BRIEF: 'brief', PLAY: 'play',
  PAUSE: 'pause', RULES: 'rules', REPORT: 'report',
};

const ENDINGS = {
  bored: {
    title: 'PLAYER WALKED AWAY',
    sub: 'you were not worth watching',
    body: 'They stopped caring before the level ran out. Coins, close calls and speed are what keep them at the cabinet — playing it safe is what empties the arcade.',
  },
  broken: {
    title: 'CABINET UNPLUGGED',
    sub: 'the attendant has been called',
    body: 'Too many presses that did nothing, and too many moves nobody asked for. They stopped believing the joystick was connected to anything.',
  },
  nohearts: {
    title: 'GAME OVER',
    sub: 'three lives, gone',
    body: 'They put the joystick down. Following a bad player exactly is how the character dies — you were always allowed to steer.',
  },
};

export function start() {
  const g = {
    state: S.TITLE,
    prev: S.TITLE,
    levelIndex: 0,
    world: null, human: null, dir: null,
    you: { left: false, right: false, jump: false, jumpPressed: false },
    jumpEdge: false,
    touch: { left: false, right: false, jump: false },
    last: 0,
    r: initRenderer(document.getElementById('screen')),
    hud: initHud(),
    overlay: document.getElementById('overlay'),
    progress: loadProgress(),
    report: null,
    ending: null,
  };

  wireInput(g);
  wireButtons(g);
  showTitle(g);
  requestAnimationFrame(t => { g.last = t; requestAnimationFrame(ts => loop(g, ts)); });
  if (DEBUG.meters) console.info('[last-quarter] debug overlay on');
  return g;
}

/* ── progression ─────────────────────────────────────────────────────── */
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_PROGRESS));
    if (p && typeof p.unlocked === 'number') return { unlocked: p.unlocked, stars: p.stars || {} };
  } catch { /* private mode */ }
  return { unlocked: 1, stars: {} };
}
function saveProgress(g) {
  try { localStorage.setItem(STORE_PROGRESS, JSON.stringify(g.progress)); } catch { /* private mode */ }
}

/* ── loop ────────────────────────────────────────────────────────────── */
function loop(g, now) {
  const dt = Math.min(0.05, (now - g.last) / 1000) * TIME_SCALE;
  g.last = now;

  if (g.state === S.PLAY) step(g, dt);
  if (g.world) drawFrame(g.r, g.world, g.dir, g.human, dt);

  requestAnimationFrame(ts => loop(g, ts));
}

function step(g, dt) {
  const { world, human, dir, you } = g;

  you.jumpPressed = g.jumpEdge;
  g.jumpEdge = false;

  updateHuman(human, world, dt);
  stepWorld(world, dt, you, (name, data) => onEvent(g, name, data));
  updateDirector(dir, world, human, you, dt);
  updateHud(g.hud, dir, human, you, dt);

  if (dir.ended) finish(g, dir.ended);
}

function onEvent(g, name, data) {
  const { world, r } = g;
  const p = world.player;
  switch (name) {
    case 'jump': Sound.jump(); break;
    case 'land': Sound.land(); break;
    case 'coin':
      Sound.coin();
      burst(r, data.x + data.w / 2, data.y + data.h / 2, '#fde047', 7, 90);
      break;
    case 'stomp':
      Sound.stomp();
      burst(r, data.x + data.w / 2, data.y + data.h / 2, world.theme.accent, 10, 130);
      break;
    case 'spring': Sound.spring(); break;
    case 'checkpoint': Sound.checkpoint(); break;
    case 'death':
      Sound.hurt();
      burst(r, p.x + p.w / 2, p.y + p.h / 2, '#f8536a', 16, 200);
      break;
    case 'respawn':
      humanReset(g.human);
      break;
    case 'goal': Sound.win(); break;
    default: break;
  }
  directorEvent(g.dir, name);
}

/* ── level lifecycle ─────────────────────────────────────────────────── */
function beginLevel(g, index) {
  g.levelIndex = index;
  const level = LEVELS[index];
  g.world = buildWorld(level);
  g.human = makeHuman(level.player);
  g.dir = makeDirector(level);
  g.you.left = g.you.right = g.you.jump = g.you.jumpPressed = false;
  g.jumpEdge = false;
  g.ending = null;
  g.report = null;

  clearFeed(g.hud);
  setIdentity(g.hud, level.player);
  say(g.dir, 'start', { mood: 'neutral', urgent: true });

  g.state = S.PLAY;
  hideOverlay(g);
}

function finish(g, ending) {
  g.ending = ending;
  g.report = reportFor(g.dir, g.world);
  g.state = S.REPORT;

  if (ending === 'win') {
    Sound.win();
    const id = LEVELS[g.levelIndex].id;
    g.progress.stars[id] = Math.max(g.progress.stars[id] || 0, g.report.stars);
    g.progress.unlocked = Math.max(g.progress.unlocked, Math.min(LEVELS.length, id + 1));
    saveProgress(g);
  } else if (ending === 'broken') {
    Sound.unplug();
  } else {
    Sound.lose();
  }
  showReport(g);
}

/* ── screens ─────────────────────────────────────────────────────────── */
function showOverlay(g, html) {
  g.overlay.innerHTML = `<div class="card">${html}</div>`;
  g.overlay.classList.add('on');
}
function hideOverlay(g) {
  g.overlay.classList.remove('on');
  g.overlay.innerHTML = '';
}

function showTitle(g) {
  g.state = S.TITLE;
  if (!g.world) {
    /* Something has to be on the screen behind the title card. */
    g.world = buildWorld(LEVELS[0]);
    g.human = makeHuman(LEVELS[0].player);
    g.dir = makeDirector(LEVELS[0]);
  }
  const stars = id => '★'.repeat(g.progress.stars[id] || 0).padEnd(3, '☆');
  showOverlay(g, `
    <h2>LAST QUARTER</h2>
    <p class="lede">You are the sprite. Someone else is holding the joystick,
    and they are not very good.</p>
    <div class="levels">
      ${LEVELS.map((L, i) => `
        <button class="lvl" data-action="play" data-index="${i}" ${L.id <= g.progress.unlocked ? '' : 'disabled'}>
          <span class="lvl-name">${L.id <= g.progress.unlocked ? L.code : '🔒'}</span>
          <span class="lvl-stars">${L.id <= g.progress.unlocked ? stars(L.id) : '·····'}</span>
        </button>`).join('')}
    </div>
    <div class="btns">
      <button class="btn" data-action="play" data-index="${Math.min(LEVELS.length, g.progress.unlocked) - 1}">START</button>
      <button class="btn ghost" data-action="rules">HOW TO PLAY</button>
    </div>
  `);
}

function showBrief(g, index) {
  g.state = S.BRIEF;
  g.levelIndex = index;
  const L = LEVELS[index];
  setIdentity(g.hud, L.player);
  showOverlay(g, `
    <h3>${L.code} · ${L.name}</h3>
    <h2>${L.player.name}</h2>
    <p class="lede">${L.player.hat}${L.player.face}${L.player.acc} ${L.blurb}</p>
    <p>Three hearts. Keep them entertained, keep them convinced.</p>
    <div class="btns">
      <button class="btn" data-action="go" data-index="${index}">PLAY</button>
      <button class="btn ghost" data-action="title">BACK</button>
    </div>
  `);
}

function showRules(g) {
  g.prev = g.state === S.RULES ? g.prev : g.state;
  g.state = S.RULES;
  showOverlay(g, `
    <h2>HOW TO PLAY</h2>
    <p class="lede">You control the character. The person at the cabinet only
    <i>thinks</i> they do — and the cabinet gets pulled if they stop believing it,
    or stop enjoying it.</p>
    <ul>
      <li><b>The keycaps</b> show their hand. Filled amber is what <b>they</b> press,
        the dashed outline is what <b>you</b> press. A hatched red cap means the
        difference is visible.</li>
      <li><b>Watch the bar under the jump cap.</b> Amber filling means a press is
        on its way — you can see it coming. When it turns <span class="keys">cyan</span>
        their press has landed and the window is open: jump inside it and you get a
        <span class="keys">✓</span>, which actively calms them down. Jump well before
        they press, or let the window run out, and you get a <span class="keys">✗</span>.</li>
      <li><b>Their face</b> is your boredom gauge. Bored people leave. Coins,
        near misses, stomps and speed are what hold them.</li>
      <li><b>The picture</b> is your suspicion gauge. Tearing and static mean they
        are starting to blame the machine. Get back in sync and it settles.</li>
      <li><b>Borrow their presses.</b> Jump on a frame they also pressed jump and it
        costs you nothing. Bad players mash — that is your budget.</li>
      <li><b>Springs, moving platforms and conveyors</b> move the character without
        the joystick, so anything you do while they carry you is free.</li>
      <li><b>Entertained people stop watching the buttons.</b> The more fun they are
        having, the more you can get away with.</li>
      <li><b>Three hearts.</b> Lose them all and they put the joystick down.</li>
    </ul>
    <p><span class="keys">← →</span> or <span class="keys">A D</span> move ·
       <span class="keys">↑ / W / SPACE</span> jump ·
       <span class="keys">ESC</span> pause · <span class="keys">M</span> mute</p>
    <div class="btns"><button class="btn" data-action="closerules">GOT IT</button></div>
  `);
}

function showPause(g) {
  g.state = S.PAUSE;
  showOverlay(g, `
    <h2>PAUSED</h2>
    <p>${LEVELS[g.levelIndex].code} · ${LEVELS[g.levelIndex].name}</p>
    <div class="btns">
      <button class="btn" data-action="resume">RESUME</button>
      <button class="btn ghost" data-action="rules">HOW TO PLAY</button>
      <button class="btn ghost" data-action="title">QUIT</button>
    </div>
  `);
}

function showReport(g) {
  const rep = g.report;
  const win = g.ending === 'win';
  const L = LEVELS[g.levelIndex];
  const end = ENDINGS[g.ending];
  const nextIndex = g.levelIndex + 1;

  const bar = (val, max, color) =>
    `<div class="meter"><i style="width:${Math.round(100 * val / max)}%;background:${color}"></i></div>`;

  showOverlay(g, `
    <h3>${L.code} · ${L.name}</h3>
    <h2>${win ? 'STILL PLUGGED IN' : end.title}</h2>
    <p>${win ? 'They put another quarter in.' : end.sub}</p>
    ${win ? `<div class="stars">${'★'.repeat(rep.stars)}${'☆'.repeat(3 - rep.stars)}</div>` : `<p>${end.body}</p>`}
    <div class="report">
      <div class="stat"><span>HOW ENTERTAINED</span><b>${rep.avgFun}%</b>${bar(rep.avgFun, 100, '#4ade80')}</div>
      <div class="stat"><span>HOW SUSPICIOUS</span><b>${rep.peakSus}%</b>${bar(rep.peakSus, 100, '#f8536a')}</div>
      <div class="stat"><span>JUMPS IN SYNC</span><b>${rep.hits}/${rep.calls}</b>${bar(rep.sync, 100, '#67e8f9')}</div>
      <div class="stat"><span>COINS · DEATHS</span><b>${rep.coins}/${rep.coinsTotal} · ${rep.deaths}</b></div>
    </div>
    <div class="btns">
      ${win && nextIndex < LEVELS.length ? `<button class="btn" data-action="brief" data-index="${nextIndex}">NEXT STAGE</button>` : ''}
      ${win && nextIndex >= LEVELS.length ? `<p class="lede">Every cabinet on the row is still running. That is the whole job.</p>` : ''}
      <button class="btn ${win ? 'ghost' : ''}" data-action="go" data-index="${g.levelIndex}">${win ? 'REPLAY' : 'TRY AGAIN'}</button>
      <button class="btn ghost" data-action="title">CABINET SELECT</button>
    </div>
  `);
}

/* ── wiring ──────────────────────────────────────────────────────────── */
function wireButtons(g) {
  g.overlay.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    Sound.resume();
    Sound.ui();
    const index = Number(el.dataset.index || 0);
    switch (el.dataset.action) {
      case 'play': showBrief(g, index); break;
      case 'go': beginLevel(g, index); break;
      case 'brief': showBrief(g, index); break;
      case 'rules': showRules(g); break;
      case 'closerules':
        if (g.prev === S.PAUSE || g.prev === S.PLAY) showPause(g);
        else if (g.prev === S.REPORT) showReport(g);
        else if (g.prev === S.BRIEF) showBrief(g, g.levelIndex);
        else showTitle(g);
        break;
      case 'resume': g.state = S.PLAY; hideOverlay(g); break;
      case 'title': showTitle(g); break;
      default: break;
    }
  });

  document.getElementById('btn-rules').addEventListener('click', () => { Sound.resume(); showRules(g); });
  const muteBtn = document.getElementById('btn-mute');
  muteBtn.addEventListener('click', () => {
    Sound.resume();
    muteBtn.textContent = Sound.toggleMute() ? '🔇' : '🔊';
  });
  muteBtn.textContent = Sound.muted ? '🔇' : '🔊';

  for (const b of document.querySelectorAll('[data-touch]')) {
    const key = b.dataset.touch;
    const on = e => { e.preventDefault(); Sound.resume(); setKey(g, key, true); };
    const off = e => { e.preventDefault(); setKey(g, key, false); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  }
}

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
};

function setKey(g, key, down) {
  if (key === 'jump') {
    if (down && !g.you.jump) g.jumpEdge = true;
    g.you.jump = down;
  } else {
    g.you[key] = down;
  }
}

function wireInput(g) {
  addEventListener('keydown', e => {
    Sound.resume();

    if (e.code === 'KeyM') {
      const btn = document.getElementById('btn-mute');
      btn.textContent = Sound.toggleMute() ? '🔇' : '🔊';
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      if (g.state === S.PLAY) showPause(g);
      else if (g.state === S.PAUSE) { g.state = S.PLAY; hideOverlay(g); }
      return;
    }

    if (g.state !== S.PLAY) {
      /* On a screen, Enter/Space activate whatever the primary button is. */
      if (e.code === 'Enter' || e.code === 'Space') {
        const btn = g.overlay.querySelector('.btn:not(.ghost)') || g.overlay.querySelector('.btn');
        if (btn) { e.preventDefault(); btn.click(); }
      }
      return;
    }

    const key = KEYMAP[e.code];
    if (!key) return;
    e.preventDefault();
    setKey(g, key, true);
  });

  addEventListener('keyup', e => {
    const key = KEYMAP[e.code];
    if (!key) return;
    setKey(g, key, false);
  });

  /* Alt-tabbing away should not count as you refusing to move. */
  addEventListener('blur', () => {
    g.you.left = g.you.right = g.you.jump = false;
    if (g.state === S.PLAY) showPause(g);
  });
}
