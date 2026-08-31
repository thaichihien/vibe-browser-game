/* Boot, screens and the frame pump.

   Fixed timestep: the simulation only ever sees 1/60 s, so combat and gathering
   behave the same on a 144 Hz monitor as on a struggling laptop. Rendering runs
   once per animation frame regardless. */

import { FACTIONS, roster } from './factions.js';
import { createGame } from './game.js';
import { makeUI, ITEMS } from './ui.js';
import { Sound } from './audio.js';
import { KING, DAY_LENGTH, clamp } from './config.js';
import { healEntity } from './entities.js';
import { currentDuty } from './duties.js';
import { report } from './messenger.js';
import { placementError, defOf, placeBuilding } from './buildings.js';
import { makeUnit } from './entities.js';
import { useAbility } from './combat.js';

const $ = id => document.getElementById(id);

const canvas   = $('board');
const hud      = $('hud');
const prompt   = $('prompt');
const screens  = {
  menu:  $('screen-menu'),
  rules: $('screen-rules'),
  pause: $('screen-pause'),
  over:  $('screen-over')
};

const SETUP_KEY = 'animalKings.setup';

const setup = loadSetup();
let G = null, UI = null;
let raf = 0, last = 0, acc = 0;
const STEP = 1 / 60;

/* ── setup screen ─────────────────────────────────────────────────────────── */

function loadSetup() {
  const base = { faction: 'pig', opponents: 1, difficulty: 1 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SETUP_KEY) || '{}') }; }
  catch { return base; }
}
function saveSetup() {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(setup)); } catch { /* ignore */ }
}

function buildFactionPicker() {
  const wrap = $('faction-picker');
  wrap.innerHTML = FACTIONS.map(f => `
    <button class="fac${f.id === setup.faction ? ' on' : ''}" data-fac="${f.id}">
      <span class="em">${f.emoji}</span>
      <span>${f.name.replace('Vương Quốc ', '')}</span>
    </button>`).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.fac');
    if (!btn) return;
    setup.faction = btn.dataset.fac;
    saveSetup();
    wrap.querySelectorAll('.fac').forEach(b => b.classList.toggle('on', b === btn));
    describeFaction();
    Sound.order();
  });
  describeFaction();
}

function describeFaction() {
  const f = FACTIONS.find(x => x.id === setup.faction);
  $('faction-desc').innerHTML = `
    <b>${f.emoji} ${f.name}</b> — ${f.blurb}<br>
    <b>${f.passive.icon} ${f.passive.name}</b> (nội tại): ${f.passive.desc}<br>
    <b>${f.ability.icon} ${f.ability.name}</b> (phím R): ${f.ability.desc}`;
}

function bindOptGroup(id, key, cast = Number) {
  const wrap = $(id);
  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.opt');
    if (!btn) return;
    setup[key] = cast(btn.dataset[key === 'opponents' ? 'opp' : 'diff']);
    saveSetup();
    wrap.querySelectorAll('.opt').forEach(b => b.classList.toggle('on', b === btn));
    Sound.order();
  });
  wrap.querySelectorAll('.opt').forEach(b => {
    const v = cast(b.dataset[key === 'opponents' ? 'opp' : 'diff']);
    b.classList.toggle('on', v === setup[key]);
  });
}

/* ── screens ──────────────────────────────────────────────────────────────── */

function show(name) {
  for (const [k, el] of Object.entries(screens)) el.hidden = k !== name;
  hud.hidden = name !== null;
  if (name === null) for (const el of Object.values(screens)) el.hidden = true;
}

function startMatch() {
  Sound.unlock();

  /* the AI takes whichever kingdoms the player did not */
  const pool = FACTIONS.map(f => f.id).filter(id => id !== setup.faction);
  const factions = [setup.faction];
  for (let i = 0; i < setup.opponents; i++) {
    factions.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }

  G = createGame(canvas, {
    seed: (Math.random() * 1e9) | 0,
    players: factions.length,
    factions,
    difficulty: setup.difficulty
  }, { onOver: showOver });

  UI = makeUI(G, {
    panel: $('panel'), icon: $('panel-icon'), title: $('panel-title'),
    body: $('panel-body'), foot: $('panel-foot'), close: $('panel-close')
  });
  G.hooks.onInteract = t => UI.openFor(t);
  G.hooks.onNotice = notice;
  G.hooks.onNews = news => {
    notice(`${news.icon} ${news.text}`);
    renderReports();
  };
  G.hooks.onDuty = (duty, finished) => {
    notice(`✅ ${duty.text} — ${duty.rewardText}`);
    const el = $('duty');
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    if (finished) setTimeout(() => { el.hidden = true; }, 2200);
  };

  /* One handle for headless verification and for poking at a live match from the
     devtools console. The game never reads any of it back. */
  window.__AK = { G, UI, placementError, defOf, placeBuilding, report, makeUnit, useAbility, roster };

  resize();
  G.start();
  show(null);
  hud.hidden = false;
  $('retinue').hidden = false;
  Sound.horn();

  last = performance.now();
  acc = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function showOver(over) {
  const won = over.winner === G.player;
  $('over-title').textContent = won ? '👑 CHIẾN THẮNG' : '💀 THẤT BẠI';
  $('over-text').textContent = won
    ? 'Vua địch đã ngã xuống. Vương quốc là của bạn.'
    : 'Vua của bạn đã ngã xuống. Không còn ai để ra lệnh nữa.';

  const s = G.player.stats;
  const mins = Math.floor(over.time / 60), secs = Math.floor(over.time % 60);
  $('over-report').innerHTML = `
    <div><span>Thời gian</span><b>${mins}:${String(secs).padStart(2, '0')}</b></div>
    <div><span>Quân đã luyện</span><b>${s.made}</b></div>
    <div><span>Quân đã mất</span><b>${s.lost}</b></div>
    <div><span>Hạ được</span><b>${s.killed}</b></div>
    <div><span>Công trình đã dựng</span><b>${s.built}</b></div>
    <div><span>Vua tự thu hoạch</span><b>${Math.round(s.kingGathered)}</b></div>`;

  hud.hidden = true;
  $('retinue').hidden = true;
  $('duty').hidden = true;
  $('reports').hidden = true;
  $('notice').hidden = true;
  screens.over.hidden = false;
  (won ? Sound.victory : Sound.defeat).call(Sound);
}

/* ── the frame ────────────────────────────────────────────────────────────── */

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  if (G) {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 5) { G.update(STEP); acc -= STEP; }
    UI?.tick();
    G.draw();
    updateHud();
  }
}

function updateHud() {
  if (!G || !G.player) return;
  const kd = G.player, k = kd.king;

  $('r-food').textContent = Math.floor(kd.res.food);
  $('r-wood').textContent = Math.floor(kd.res.wood);
  $('r-gold').textContent = Math.floor(kd.res.gold);
  $('r-pop').textContent = `${kd.pop}/${kd.popCap}`;

  const mins = Math.floor(G.time / 60), secs = Math.floor(G.time % 60);
  $('r-time').textContent = `${mins}:${String(secs).padStart(2, '0')}`;
  const phase = (G.time % DAY_LENGTH) / DAY_LENGTH;
  $('r-phase').textContent = phase < 0.42 ? '☀️' : phase < 0.55 ? '🌇' : phase < 0.94 ? '🌙' : '🌅';

  if (k) {
    $('king-portrait').textContent = kd.faction.king;
    $('m-hp').style.width = `${(k.hp / k.maxHp) * 100}%`;
    $('m-hp-txt').textContent = `${Math.ceil(k.hp)} / ${k.maxHp}`;
    $('m-st').style.width = `${(k.stamina / KING.staminaMax) * 100}%`;

    const ab = $('ability');
    $('ability-icon').textContent = kd.faction.ability.icon;
    const cd = clamp(k.abilityCd / KING.abilityCd, 0, 1);
    $('ability-cd').style.height = `${cd * 100}%`;
    ab.classList.toggle('ready', cd <= 0);
  }

  updateRetinue();
  updateDuty();

  /* the floating E prompt, positioned over whatever the king can reach */
  if (G.promptTarget) {
    prompt.hidden = false;
    prompt.style.left = `${G.R.sx(G.promptTarget.x)}px`;
    prompt.style.top  = `${G.R.sy(G.promptTarget.y) - 34}px`;
    $('prompt-text').textContent = G.promptTarget.label;
  } else prompt.hidden = true;
}

let noticeT = 0;
function notice(text) {
  const el = $('notice');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(noticeT);
  noticeT = setTimeout(() => { el.hidden = true; }, 2400);
}

/* the on-screen order buttons feed the same virtual-button queue the touch layer
   uses, so there is exactly one path from "player wanted this" to the game */
document.querySelectorAll('[data-vbtn]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (G && G.running) G.input.virtual.add(btn.dataset.vbtn);
  });
});

function renderReports() {
  const list = $('reports-list');
  const log = G.messages.log;
  list.innerHTML = log.length
    ? log.map(m => `
        <div class="rep">
          <span class="ic">${m.icon}</span>
          <span class="tx">${m.text}
            <span class="mt">tin đi mất ${m.travel.toFixed(0)} giây · lúc ${fmtTime(m.at)}</span>
          </span>
        </div>`).join('')
    : '<div class="rep empty">Chưa có tin nào tới nơi.</div>';
}

const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function updateDuty() {
  const duty = currentDuty(G.duties);
  const el = $('duty');
  if (!duty) { el.hidden = true; return; }
  if (el.dataset.id !== duty.id) {
    el.dataset.id = duty.id;
    $('duty-icon').textContent = duty.icon;
    $('duty-title').textContent = duty.text;
    $('duty-hint').textContent = duty.hint;
  }
  el.hidden = false;
}

function updateRetinue() {
  const kd = G.player;
  $('ret-count').textContent = `${kd.retinue.length}/${kd.retinueCap}`;
  const list = $('ret-list');
  const sig = kd.retinue.map(u => u.glyph).join('') + '|' + kd.retinue.length;
  if (list.dataset.sig !== sig) {
    list.dataset.sig = sig;
    list.innerHTML = kd.retinue.length
      ? kd.retinue.map(u => `<span title="${u.name}">${u.glyph}</span>`).join('')
      : '<span class="none">— trống —</span>';
  }
  const empty = kd.retinue.length === 0;
  document.querySelectorAll('.ord').forEach(b => { b.disabled = empty; });
  $('ret-hint').textContent = empty
    ? 'Tới gần quân và bấm E để chiêu mộ'
    : 'Ra lệnh rồi họ sẽ tự xoay xở';
}

/* ── chrome ───────────────────────────────────────────────────────────────── */

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = innerWidth, h = innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  if (G) G.resize(w, h, dpr);
}

function togglePause(force) {
  if (!G || !G.running) return;
  G.paused = force ?? !G.paused;
  screens.pause.hidden = !G.paused;
  if (G.input) G.input.enabled = !G.paused;
}

function setMuteLabel() { $('btn-mute').textContent = Sound.muted ? '🔇' : '🔊'; }

function buildRules() {
  $('rules-body').innerHTML = `
    <p>Bạn là <b>Vua</b>. Trận đấu chỉ kết thúc khi một trong hai Vua ngã xuống — mất căn cứ,
    mất sạch quân, vẫn chưa thua.</p>

    <h4>ĐÔI TAY CỦA VUA</h4>
    <p>Vua <b>quay mặt theo hướng đang đi</b> — không cần ngắm bằng chuột.
    <kbd>Space</kbd> là một nút duy nhất: trước mặt là địch thì chém, là cây thì chặt,
    là lúa thì gặt, là quặng thì đào, là nhà hỏng thì sửa.</p>
    <ul>
      <li>Vua thu hoạch <b>chậm hơn thợ</b>, nhưng <b>không phải gánh về</b> — vào thẳng kho.</li>
      <li>Chỉ Vua mới lấy được vàng ở mỏ <b>chưa có tiền đồn</b>.</li>
      <li>Mọi thứ đều tiêu <b>thể lực</b>: chạy, chém, thu hoạch dùng chung một thanh.</li>
    </ul>

    <h4>ĐI GẶP NGƯỜI CỦA MÌNH</h4>
    <ul>
      <li>🛒 <b>Thương nhân</b> — trang bị cho Vua, nâng cấp toàn quân, đổi tài nguyên.
          Vàng chỉ tiêu được ở đây.</li>
      <li>🔨 <b>Thợ xây</b> — mở bảng xây dựng.</li>
      <li>🛖 <b>Trại lính</b> — <b>nơi duy nhất ra quân</b>, kể cả thợ. Tới tận nơi bấm
          <kbd>E</kbd>. Mỗi trại là một hàng đợi riêng, nên nhiều trại là nhiều quân cùng lúc.
          Chưa có trại lính thì vương quốc không lớn lên được — hãy dựng nó trước tiên.</li>
    </ul>

    <h4>ĐOÀN TÙY TÙNG</h4>
    <p>Quân mới ra lò <b>đứng yên tại chỗ</b> — chúng chưa phải của bạn cho tới khi bạn
    đi tới và bấm <kbd>E</kbd>.</p>
    <ul>
      <li><kbd>1</kbd> ⚔ TẤN CÔNG · <kbd>2</kbd> 🛡 GIỮ · <kbd>3</kbd> 🏠 VỀ NHÀ · <kbd>4</kbd> 🔎 DO THÁM</li>
      <li><kbd>F</kbd> giải tán. Quân để lại ở chế độ GIỮ sẽ tự chiến đấu giữ đất.</li>
    </ul>

    <h4>KHÔNG CÓ BẢN ĐỒ NHỎ</h4>
    <p>Chuyện xảy ra ngoài màn hình không hiện ra thành thông báo. Một <b>liên lạc</b> 🐦 sẽ
    chạy từ chỗ đó về tận nơi bạn đứng. Nó có thể <b>bị giết dọc đường</b> — và khi đó bạn
    sẽ không bao giờ biết. Xem lại tin đã nhận bằng <kbd>Tab</kbd>.</p>

    <h4>PHÍM</h4>
    <p><kbd>WASD</kbd> đi (và đó cũng là hướng nhìn) · <kbd>Shift</kbd> chạy ·
    <kbd>Space</kbd> hành động ·
    <kbd>E</kbd> nói chuyện / chiêu mộ · <kbd>1-4</kbd> ra lệnh · <kbd>F</kbd> giải tán ·
    <kbd>R</kbd> kỹ năng · <kbd>Q</kbd> dùng vật phẩm · <kbd>Tab</kbd> tin báo ·
    <kbd>P</kbd> tạm dừng · <kbd>M</kbd> tắt tiếng</p>
    <p>Chuột chỉ dùng để bấm bảng và đặt công trình.</p>`;
}

/* ── wiring ───────────────────────────────────────────────────────────────── */

Sound.init();
setMuteLabel();
buildFactionPicker();
buildRules();
bindOptGroup('opp-picker', 'opponents');
bindOptGroup('diff-picker', 'difficulty');

$('btn-start').addEventListener('click', startMatch);
$('btn-again').addEventListener('click', () => { screens.over.hidden = true; show('menu'); });
$('btn-resume').addEventListener('click', () => togglePause(false));
$('btn-pause').addEventListener('click', () => togglePause());
$('btn-rules').addEventListener('click', () => { screens.rules.hidden = false; });
$('rules-close').addEventListener('click', () => { screens.rules.hidden = true; });
$('reports-close').addEventListener('click', () => { $('reports').hidden = true; });
$('btn-mute').addEventListener('click', () => { Sound.unlock(); Sound.toggle(); setMuteLabel(); });

/* Q spends a consumable. Potions keep the king alive; rations keep his retinue
   alive, which at some point matters more. */
function useItem() {
  if (!G || !G.running || !G.player.king.alive) return;
  const kd = G.player, k = kd.king;
  if ((kd.items.potion || 0) > 0 && k.hp < k.maxHp) {
    kd.items.potion--;
    healEntity(k, 180);
    Sound.done();
    return;
  }
  if ((kd.items.rations || 0) > 0 && kd.retinue.length) {
    kd.items.rations--;
    for (const u of kd.retinue) healEntity(u, 90);
    Sound.done();
    return;
  }
  Sound.deny();
}

addEventListener('keydown', e => {
  if (e.code === 'Tab' && !e.repeat) {
    e.preventDefault();
    const r = $('reports');
    r.hidden = !r.hidden;
    if (!r.hidden) renderReports();
  }
  if (e.code === 'KeyQ' && !e.repeat) useItem();
  if (e.code === 'KeyM' && !e.repeat) { Sound.toggle(); setMuteLabel(); }
  if (e.code === 'KeyP' && !e.repeat) togglePause();
  if (e.code === 'Escape') {
    if (!screens.rules.hidden) screens.rules.hidden = true;
    else if (G && G.ghost) UI.cancelGhost();
    else if (!$('reports').hidden) $('reports').hidden = true;
    else if (UI && UI.open) UI.close();
    else if (G && G.running) togglePause();
  }
});

addEventListener('resize', resize);
resize();
show('menu');
