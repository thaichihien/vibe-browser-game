/* The DOM HUD around the canvas.
 *
 * Only player-owned information lives here — lives, stats, active cooldowns.
 * Everything about the *boss* is drawn on the boss itself in render.js, because
 * a number in the corner is a worse readout than watching it fill with water.
 *
 * Every stat and slot carries a `data-tip`, so the meaning of 🔥3 or ⚓ is one
 * hover away and none of it has to be memorised from the rules screen.
 *
 * `update()` runs every frame, so it must not rewrite innerHTML every frame:
 * replacing the node under the cursor sixty times a second means a tooltip can
 * never settle, and the element you are pointing at is gone before the browser
 * finishes deciding you hovered it. Each block is therefore written only when
 * its *signature* changes, and the one genuinely continuous value — a skill
 * cooldown — is pushed onto the existing node as a CSS variable instead.
 */

import { ITEMS, ACTIVES, MONSTER, CAP, BASE } from '../config.js';
import { fmt } from '../engine/rank.js';
import { KEYCAPS, SOLO_KEYCAP } from '../input.js';

const PLAYER_ICON = ['🐰', '🐱'];

/* Long-form explanations, shown on hover. Kept next to the HUD rather than in
 * config.js because they are copy, not tuning. */
const TIPS = {
  lives: (p) => `Mạng: ${p.lives}/${CAP.lives}. Chạm vào quái hay trùm là mất một mạng ` +
    `ngay lập tức. Dính nước thì chỉ bị nhốt — thoát kịp là không mất gì. Nhặt ❤️ để thêm.`,
  balloons: (p) => `Số bom đặt được cùng lúc: ${p.stats.balloons}/${CAP.balloons}. ` +
    `Bom đã nổ mới được đặt lại. Nhặt 💣 để tăng.`,
  power: (p) => `Tầm nước: ${p.stats.power}/${CAP.power} ô mỗi hướng. ` +
    `Vụ nổ hình chữ thập, phá đúng một thùng mỗi hướng rồi dừng. Nhặt 🔥 để tăng.`,
  speed: (p) => `Tốc độ: bậc ${p.stats.speedTier}/${CAP.speedTier} (khởi đầu ${BASE.speedTier}). ` +
    `Nhặt 👟 để tăng. Nhanh quá cũng dễ lao vào nước của chính mình.`,
  kick: 'Đá Bom 🦵: đi vào quả bom của mình để đẩy nó trượt đi tới khi chạm vật cản. ' +
    'Dùng để đẩy bom vào chỗ quái đang bị nhốt.',
  throw: 'Ném Bom 🤾: đứng trên quả bom của mình rồi bấm đặt để ném nó qua 5 ô, ' +
    'vượt cả tường. Đây là cách đánh vào lồng mà không cần phá tường.',
  empty: 'Ô kỹ năng trống. Nhặt 📌 🛡️ 💥 ⚓ rơi ra từ thùng gỗ để trang bị (tối đa 2).',
};

const ACTIVE_TIPS = {
  needle: 'Kim Chọc 📌: thoát bong bóng ngay lập tức. Dùng được cả khi đang bị nhốt.',
  shield: 'Khiên Nước 🛡️: chặn đúng một lần dính nước.',
  shockwave: 'Kích Nổ 💥: cho nổ ngay tất cả bom bạn đã đặt — ép nổ đúng nhịp thay vì chờ ngòi.',
  anchor: 'Neo Đá ⚓: đứng yên bất động 2 giây, không bị đẩy.',
};

let panels = [];
let topEl = null;
let topSig = '';

export function mount(root, top, solo = false) {
  topEl = top;
  topSig = '';
  root.innerHTML = '';
  panels = [];
  for (let i = 0; i < 2; i++) {
    const caps = solo ? SOLO_KEYCAP : KEYCAPS[i];
    const el = document.createElement('div');
    el.className = `pcard p${i + 1}`;
    el.innerHTML = `
      <div class="pcard-head">
        <span class="pcard-face">${PLAYER_ICON[i]}</span>
        <span class="pcard-name">${solo ? 'NGƯỜI CHƠI' : `NGƯỜI ${i + 1}`}</span>
        <span class="pcard-keys">${caps.move} · ${caps.place}</span>
      </div>
      <div class="lives" data-lives></div>
      <div class="stats" data-stats></div>
      <div class="slots" data-slots></div>
      <div class="pstate" data-state></div>`;
    root.appendChild(el);
    panels.push({
      el, caps, sig: {},
      lives: el.querySelector('[data-lives]'),
      stats: el.querySelector('[data-stats]'),
      slots: el.querySelector('[data-slots]'),
      state: el.querySelector('[data-state]'),
    });
  }
}

function pips(n, max, on, off) {
  let s = '';
  for (let i = 0; i < max; i++) s += `<i class="${i < n ? '' : 'dim'}">${i < n ? on : off}</i>`;
  return s;
}

const esc = (s) => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Rewrite `el` only when `sig` differs from last time. */
function ifChanged(panel, key, sig, build) {
  if (panel.sig[key] === sig) return false;
  panel.sig[key] = sig;
  panel[key].innerHTML = build();
  return true;
}

export function update(state) {
  for (let i = 0; i < panels.length; i++) {
    const p = state.players[i];
    const panel = panels[i];
    if (!p) { panel.el.classList.add('absent'); continue; }
    panel.el.classList.remove('absent');
    panel.el.classList.toggle('is-down', p.down);
    panel.el.classList.toggle('is-bubbled', !!p.bubble);

    ifChanged(panel, 'lives', `${p.lives}`, () =>
      `<span class="tip" data-tip="${esc(TIPS.lives(p))}">${pips(p.lives, CAP.lives, '❤️', '🤍')}</span>`);

    const st = p.stats;
    ifChanged(panel, 'stats', `${st.balloons}|${st.power}|${st.speedTier}|${st.kick}|${st.throw}`, () => [
      `<span class="stat tip" data-tip="${esc(TIPS.balloons(p))}">${ITEMS.balloon.icon}<b>${st.balloons}</b></span>`,
      `<span class="stat tip" data-tip="${esc(TIPS.power(p))}">${ITEMS.power.icon}<b>${st.power}</b></span>`,
      `<span class="stat tip" data-tip="${esc(TIPS.speed(p))}">${ITEMS.shoe.icon}<b>${st.speedTier}</b></span>`,
      st.kick ? `<span class="stat badge tip" data-tip="${esc(TIPS.kick)}">${ITEMS.kick.icon}</span>` : '',
      st.throw ? `<span class="stat badge tip" data-tip="${esc(TIPS.throw)}">${ITEMS.throw.icon}</span>` : '',
    ].join(''));

    /* Slots are rebuilt only when *which* skill sits in them changes. The
     * cooldown moves continuously, so it is written straight onto the surviving
     * node — that is what keeps a hovered slot from being yanked away. */
    ifChanged(panel, 'slots', p.actives.map(a => a.kind).join('|') || 'empty', () =>
      [0, 1].map(s => {
        const a = p.actives[s];
        const key = panel.caps.acts[s];
        if (!a) return `<span class="slot empty tip" data-tip="${esc(TIPS.empty)}"><em>${key}</em>·</span>`;
        return `<span class="slot tip" data-slot="${s}" style="--fill:0%"><em>${key}</em>${ACTIVES[a.kind].icon}</span>`;
      }).join(''));

    for (const node of panel.slots.querySelectorAll('[data-slot]')) {
      const a = p.actives[+node.dataset.slot];
      if (!a) continue;
      const spec = ACTIVES[a.kind];
      const cooling = a.cd > 0;
      node.style.setProperty('--fill', `${Math.round((1 - a.cd / spec.cd) * 100)}%`);
      node.classList.toggle('cooling', cooling);
      node.classList.toggle('ready', !cooling);
      node.dataset.tip = ACTIVE_TIPS[a.kind] +
        (cooling ? ` — còn ${a.cd.toFixed(1)}s hồi chiêu.` : ` Sẵn sàng: bấm ${panel.caps.acts[+node.dataset.slot]}.`);
    }

    const label = p.down ? 'HẾT MẠNG — chờ màn sau'
      : p.bubble ? 'KẸT! Bấm loạn hướng để thoát'
      : !p.alive ? 'Đang hồi sinh…' : '';
    if (panel.state.textContent !== label) panel.state.textContent = label;
  }

  if (!topEl) return;
  const ch = state.chapter;
  const boss = state.boss;
  const ss = ch.ss;
  const run = state.run;

  const counts = {};
  for (const m of state.monsters) if (!m.dead) counts[m.kind] = (counts[m.kind] || 0) + 1;
  if (boss && !boss.dead) counts.__boss = 1;

  /* The clock ticks every frame; rounding it to the second is what stops this
   * block rewriting itself sixty times a second and eating hovers. */
  const sig = `${ch.id}|${state.stageIndex}|${JSON.stringify(counts)}|${run.kills}|${Math.floor(run.time)}`;
  if (sig === topSig) return;
  topSig = sig;

  const goal = boss
    ? `<span class="goal boss">${boss.def.icon} ${boss.def.name}</span>`
    : `<span class="goal">${Object.entries(counts).map(([k, n]) =>
        `<span class="tip" data-tip="${esc(MONSTER[k].name)} — còn ${n} con">${MONSTER[k].icon}<b>${n}</b></span>`
      ).join(' ') || '✔'}</span>`;

  /* Kills and clock are the rank, and the rank is why you replay a raid — so
   * both live on screen the whole way, next to the target you are chasing. */
  const killOk = run.kills >= ss.kills;
  const timeOk = run.time <= ss.time;

  topEl.innerHTML = `
    <span class="chip">${ch.icon} ${ch.name}</span>
    <span class="chip">MÀN ${state.stageIndex + 1}/3</span>
    <span class="chip title">${ch.stages[state.stageIndex].title || ''}</span>
    <span class="chip score tip${killOk ? ' ok' : ''}"
      data-tip="Số quái đã diệt trong cả 3 màn. Cần ${ss.kills} để đạt hạng SS.">
      ☠ ${run.kills}<i>/${ss.kills}</i></span>
    <span class="chip score tip${timeOk ? ' ok' : ''}"
      data-tip="Tổng thời gian cả 3 màn. Dưới ${fmt(ss.time)} mới đạt hạng SS — màn 1 chậm thì gỡ lại ở màn 3.">
      ⏱ ${fmt(run.time)}<i>/${fmt(ss.time)}</i></span>
    ${goal}`;
}
