/* Every DOM panel in the game. Nothing here touches the simulation directly —
   it renders `save` plus whatever report it is handed, and calls back out. */

import { vnd, vndShort, BASE_CARRY, FOOD_COST_RATIO, OFFLINE_CAP_HOURS, OFFLINE_EFFICIENCY, clamp } from './config.js';
import { CATS, CLAIM_FEE, DISH, DISHES, FACADE, LEVELS, MENU_CATS, MISSIONS,
  NAME_SUGGESTIONS, SHOP, TUTORIAL_DAYS } from './data.js';
import {
  activeMission, canBuy, canBuyFacade, canLearn, derived, dishNeedsLevel,
  displayName, energyLimited, MAX_NAME, refreshEnergy, tierProgress, untilMidnight
} from './state.js';
import { MARKET_ROUNDS, MARKET_STALLS, makeMarketRound } from './street.js';
import * as Debug from './debug.js';
import { shiftTarget } from './sim.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const SCREENS = ['boot', 'hub', 'shop', 'missions', 'result', 'pause', 'rules',
  'ledger', 'settings', 'day', 'name', 'signs', 'market', 'cafe', 'debug'];

/* shop effect → a pill the player can read without a spreadsheet */
function effPills(item) {
  const e = item.eff || {};
  const out = [];
  const pct = v => Math.round(v * 100) + '%';
  if (e.tables)    out.push('+1 bàn 4 ghế');
  if (e.waiters)   out.push('+1 phục vụ tự động');
  if (e.chefs)     out.push('+1 bếp nấu song song');
  if (e.cookSpeed) out.push(`nấu nhanh hơn ${pct(e.cookSpeed)}`);
  if (e.carry)     out.push('+1 dĩa bưng một lượt');
  if (e.passSlots) out.push(`+${e.passSlots} ô để món`);
  if (e.comfort)   out.push(`khách kiên nhẫn +${pct(e.comfort)}`);
  if (e.charm)     out.push(`tiền tip +${pct(e.charm)}`);
  if (e.draw)      out.push(`khách ghé +${pct(e.draw)}`);
  if (e.menuSpeed) out.push(`chọn món nhanh +${pct(e.menuSpeed)}`);
  if (e.payFast)   out.push(`thanh toán nhanh +${pct(e.payFast)}`);
  if (e.autoPay)   out.push('khách tự ra quầy trả tiền');
  return out;
}

export function createUI(save, on) {
  const el = Object.fromEntries(SCREENS.map(k => [k, $('screen-' + k)]));
  const hud = {
    root: $('hud'), money: $('hud-money'), timer: $('hud-timer'),
    mode: $('hud-mode'), modeIcon: $('hud-mode-icon'),
    fill: $('hud-goal-fill'), mark: $('hud-goal-mark'),
    now: $('hud-goal-now'), target: $('hud-goal-target'),
    carry: $('hud-carry'), tray: $('hud-tray')
  };
  const prompt = $('prompt');
  const toasts = $('toasts');
  const orders = $('orders');
  let ordersKey = '';
  let shopCat = 'table';
  let marketKeyHandler = null;

  function hideAll() { for (const k of SCREENS) el[k].classList.remove('show'); }
  function show(k) { hideAll(); el[k].classList.add('show'); }
  function openScreen(k) { return el[k].classList.contains('show'); }
  function current() { return SCREENS.find(k => el[k].classList.contains('show')) || null; }
  /* Bring a panel back without rebuilding it — the guide has to be able to
     return to a ca result or a morning ledger it cannot regenerate. */
  function reopen(k) { if (SCREENS.includes(k) && el[k].innerHTML.trim()) { show(k); return true; } return false; }

  /* ── HUD ────────────────────────────────────────────────────────────────*/
  function setHudVisible(v) {
    hud.root.hidden = !v;
    if (!v) { orders.hidden = true; orders.innerHTML = ''; ordersKey = ''; }
  }

  function updateHud(sim, outside = false) {
    hud.money.textContent = vnd(save.money);
    const dead = sim.player.carry.filter(p => p.dead).length;
    hud.carry.textContent = `${sim.player.carry.length}/${sim.d.carry}` + (dead ? ` 🗑${dead}` : '');
    hud.tray.classList.toggle('full', sim.player.carry.length >= sim.d.carry);
    hud.tray.classList.toggle('spoiled', dead > 0);

    if (sim.mode === 'shift') {
      if (sim.closing) {
        /* the clock is done but the floor is not — say so plainly */
        hud.modeIcon.textContent = '🧹';
        hud.mode.textContent = 'HẾT GIỜ · PHỤC VỤ NỐT';
        const left = sim.busyTables();
        hud.timer.textContent = `${left} bàn`;
        hud.timer.className = 'timer closing';
      } else {
        hud.modeIcon.textContent = '🔥';
        hud.mode.textContent = 'CA PHỤC VỤ';
        const t = Math.max(0, sim.timeLeft);
        hud.timer.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
        hud.timer.className = 'timer' + (t < 20 ? ' crit' : t < 45 ? ' warn' : '');
      }
      const pct = Math.min(1, sim.stats.revenue / sim.target);
      hud.fill.style.width = (pct * 100) + '%';
      hud.mark.style.left = '100%';
      hud.now.textContent = vnd(sim.stats.revenue);
      hud.target.textContent = '/ ' + vnd(sim.target) + (sim.stats.angry ? `  😡${sim.stats.angry}` : '');
    } else if (outside) {
      hud.modeIcon.textContent = '🚶';
      hud.mode.textContent = 'ĐANG DẠO PHỐ';
      hud.timer.textContent = '∞';
      hud.timer.className = 'timer';
      hud.fill.style.width = '100%';
      hud.now.textContent = esc(displayName(save));
      hud.target.textContent = 'quán vẫn mở';
    } else {
      hud.modeIcon.textContent = '🌿';
      hud.mode.textContent = 'MỞ CỬA QUÁN';
      hud.timer.textContent = '∞';
      hud.timer.className = 'timer';
      hud.fill.style.width = '100%';
      hud.mark.style.left = '100%';
      const earned = sim.stats.revenue + sim.stats.tips - sim.stats.foodCost;
      const rate = sim.t > 60 ? earned / (sim.t / 60) : sim.d.idleNetPerMin;
      hud.now.textContent = `${sim.stats.groups} lượt · ${vndShort(earned)}`;
      hud.target.textContent = `+${vndShort(rate)}/phút`;
    }
  }

  /* What each occupied table is waiting on. Rebuilt only when it actually
     changes — this runs every frame otherwise. */
  const ORDER_STATES = {
    WANT_MENU:   { icon: '🙋', say: 'Chờ đưa menu' },
    READING:     { icon: '🤔', say: 'Đang chọn món' },
    ORDER_READY: { icon: '🎫', say: 'Chờ lấy phiếu' },
    WAIT_FOOD:   { icon: '🍳', say: 'Chờ món' },
    EATING:      { icon: '😋', say: 'Đang ăn' },
    WANT_BILL:   { icon: '💵', say: 'Đòi tính tiền' }
  };

  function updateOrders(sim) {
    const rows = [];
    for (const t of sim.world.tables) {
      const p = t.party;
      if (!p) continue;
      const meta = ORDER_STATES[p.state];
      if (!meta) continue;

      let urgency = '';
      if (p.waitMax && sim.mode === 'shift') {
        const left = 1 - p.wait / p.waitMax;
        urgency = left > 0.55 ? 'calm' : left > 0.22 ? 'soon' : 'urgent';
      }
      const dishes = p.members.flatMap(m => m.dishes);
      const showDishes = p.state === 'ORDER_READY' || p.state === 'WAIT_FOOD';
      const glyphs = showDishes ? dishes.map(id => DISH[id].emoji).join('') : meta.icon;
      const say = showDishes
        ? [...new Set(dishes)].map(id => DISH[id].name).join(', ')
        : meta.say;
      rows.push(`<div class="ord ${urgency}"><b>${t.id + 1}</b>` +
                `<span class="what">${glyphs}</span><span class="say">${esc(say)}</span></div>`);
    }
    const html = rows.join('');
    if (html === ordersKey) return;
    ordersKey = html;
    orders.hidden = !rows.length;
    orders.innerHTML = html;
  }

  function setPrompt(text) {
    if (!text) { prompt.hidden = true; return; }
    prompt.hidden = false;
    prompt.innerHTML = `<kbd>E</kbd>${esc(text)}`;
  }

  function toast(text, kind = '') {
    const n = document.createElement('div');
    n.className = 'toast ' + kind;
    n.innerHTML = text;
    toasts.appendChild(n);
    setTimeout(() => n.remove(), 3200);
  }

  /* ── shared fragments ───────────────────────────────────────────────────*/
  function tierBlock() {
    /* While you are still staff, the tier bar would sit at zero no matter how
       well you did — you cannot invest in someone else's quán. Show the thing
       that IS advancing instead. */
    if (!save.owner) {
      const day = save.tutorialDay || 0;
      const pct = clamp(day / TUTORIAL_DAYS, 0, 1) * 100;
      return `
        <div class="tier">
          <div class="tier-head">
            <b>👔 Đang học việc</b>
            <span>Ngày ${Math.min(day, TUTORIAL_DAYS)}/${TUTORIAL_DAYS} · mỗi ca là một ngày</span>
          </div>
          <div class="tier-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
        </div>`;
    }

    const d = derived(save);
    const tp = tierProgress(save);
    const nextLine = tp.next
      ? `Đã đầu tư ${vndShort(save.invested)} / ${vndShort(tp.next.invested)} → ${tp.next.emoji} ${tp.next.name}`
      : 'Đã đạt cấp cao nhất';
    /* The single most confusing thing about this bar is that it tracks money
       SPENT, not money held — so say so, right under it, until it has moved. */
    const note = tp.next && save.invested < tp.next.invested
      ? `<div class="tier-note">Thanh này chạy theo <b>tiền đã đầu tư vào quán</b>, không phải tiền trong két —
         mua bàn ghế, nhân sự, bếp hay công thức thì nó mới lên.</div>` : '';
    return `
      <div class="tier">
        <div class="tier-head">
          <b>${d.level.emoji} ${esc(d.level.name)}</b>
          <span>${esc(nextLine)}</span>
        </div>
        <div class="tier-bar"><i style="width:${(tp.pct * 100).toFixed(1)}%"></i></div>
        ${note}
      </div>`;
  }

  function energyBlock() {
    if (!energyLimited(save)) {
      return `
        <div class="row" style="align-items:center;gap:10px;margin-bottom:14px">
          <span class="hint">🔥 <b>Chạy ca thoải mái</b> — trong lúc còn học việc thì không
            giới hạn lượt.</span>
        </div>`;
    }
    const d = derived(save);
    const n = refreshEnergy(save);
    const pips = Array.from({ length: d.maxEnergy }, (_, i) =>
      `<i class="pip${i < n ? ' on' : ''}"></i>`).join('');
    const secs = untilMidnight();
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    return `
      <div class="row" style="align-items:center;gap:10px;margin-bottom:14px">
        <div class="pips">${pips}</div>
        <span class="hint">${n}/${d.maxEnergy} lượt ca hôm nay${n < d.maxEnergy ? ` · đầy lại sau ${h}g ${m}p` : ''}</span>
      </div>`;
  }

  /* ── boot ───────────────────────────────────────────────────────────────*/
  function showBoot(report) {
    const fresh = !save.seenIntro;
    let day = '';
    if (report && (report.days > 0 || report.offlineEarned > 0)) {
      const rows = [];
      if (report.offlineEarned > 0) {
        rows.push(`<tr><td>Nhân viên bán hàng lúc bạn vắng mặt (${Math.round(report.offlineMin)} phút)</td><td class="pos">+${vnd(report.offlineEarned)}</td></tr>`);
      }
      if (report.cost > 0) {
        rows.push(`<tr><td>Mặt bằng & điện nước${report.days > 1 ? ` (${report.days} ngày)` : ''}</td><td class="neg">−${vnd(report.overhead)}</td></tr>`);
        if (report.wages > 0) rows.push(`<tr><td>Lương nhân viên</td><td class="neg">−${vnd(report.wages)}</td></tr>`);
      }
      if (rows.length) {
        day = `<h2>🌅 Sáng hôm sau</h2><table class="ledger">${rows.join('')}
          <tr class="total"><td>Còn trong két</td><td>${vnd(save.money)}</td></tr></table><div style="height:16px"></div>`;
      }
    }

    el.boot.innerHTML = `
      <div class="card">
        <h1>🍜 Quán Ăn Của Tôi</h1>
        <p class="sub">${fresh
          ? 'Bạn là phục vụ ở một quán hai bàn. Chạy đủ số ca, gom đủ vốn, rồi sang tên quán và tự tay xây nó lên.'
          : `Chào mừng trở lại. ${derived(save).level.emoji} ${esc(derived(save).level.name)} đang đợi bạn.`}</p>
        ${day}
        <button class="btn wide" data-act="boot-go">${fresh ? 'BẮT ĐẦU CA ĐẦU TIÊN' : 'VÀO QUÁN'}</button>
        <div class="row end" style="margin-top:10px">
          <button class="btn sec" data-act="rules">Hướng dẫn</button>
          ${save.seenIntro ? '<button class="btn sec" data-act="settings">⚙️ Cài đặt</button>' : ''}
        </div>
      </div>`;
    show('boot');
  }

  /* ── hub ────────────────────────────────────────────────────────────────*/
  function showHub() {
    const d = derived(save);
    const metered = energyLimited(save);
    const n = metered ? refreshEnergy(save) : Infinity;
    const blocked = metered && n <= 0;
    const m = activeMission(save);
    const claimable = m && m.id === 'm9';

    const missionCard = m ? `
      <div class="mission on">
        <span class="mark">🎯</span>
        <div class="grow">
          <h3>${esc(m.title)}</h3>
          <p>${esc(m.desc)}</p>
        </div>
        ${m.reward ? `<span class="rw">+${vndShort(m.reward)}</span>` : ''}
      </div>` : `
      <div class="mission done"><span class="mark">✅</span>
        <div class="grow"><h3>Xong hết nhiệm vụ hướng dẫn</h3>
        <p>Giờ mục tiêu là nâng quán lên cấp kế tiếp.</p></div></div>`;

    el.hub.innerHTML = `
      <div class="card">
        <h1>${d.level.emoji} ${save.owner ? esc(displayName(save)) : esc(d.level.name)}</h1>
        <p class="sub">${save.owner
          ? `${esc(d.level.name)} · quán này là của bạn.`
          : 'Bạn đang làm thuê ở đây.'}</p>
        ${tierBlock()}

        <div class="stats">
          <div class="stat gold"><b>${vndShort(save.money)}</b><span>Tiền mặt</span></div>
          <div class="stat"><b>${d.tables}</b><span>Bàn</span></div>
          <div class="stat"><b>${d.waiters}</b><span>Phục vụ</span></div>
          <div class="stat"><b>${d.chefs}</b><span>Bếp</span></div>
          <div class="stat"><b>${d.menu.length}</b><span>Món</span></div>
        </div>

        ${energyBlock()}
        ${missionCard}

        <div class="row" style="margin-top:14px">
          <button class="btn grow" data-act="shift" ${blocked ? 'disabled' : ''}>
            ${blocked ? '😴 HẾT LƯỢT HÔM NAY' : '🔥 VÀO CA PHỤC VỤ'}
            <small>${blocked ? 'Đầy lại lúc 00:00'
              : `3,5 phút · ${metered ? 'tốn 1 lượt · ' : 'không tốn lượt · '}mục tiêu ${vndShort(shiftTarget(d))}`}</small>
          </button>
        </div>

        <div class="row" style="margin-top:8px">
          ${claimable ? `
            <button class="btn grow" data-act="claim" ${save.money < CLAIM_FEE ? 'disabled' : ''}>
              📝 SANG TÊN QUÁN<small>Phí sang nhượng ${vnd(CLAIM_FEE)}</small></button>` : ''}
          <button class="btn sec grow" data-act="idle" ${save.owner ? '' : 'disabled'}>
            🌿 Mở cửa quán<small>${save.owner ? 'Chơi thư giãn, không tốn lượt' : 'Cần sang tên quán trước'}</small></button>
          <button class="btn sec grow" data-act="shop" ${save.owner ? '' : 'disabled'}>
            🛒 Cửa hàng<small>${save.owner ? 'Bàn ghế · nhân sự · bếp · trang trí' : 'Cần sang tên quán trước'}</small></button>
        </div>

        <div class="row" style="margin-top:8px">
          <button class="btn sec grow" data-act="missions">📋 Nhiệm vụ</button>
          <button class="btn sec grow" data-act="ledger">📒 Sổ sách</button>
        </div>

        <div class="row" style="margin-top:8px">
          <button class="btn sec grow" data-act="rules">❓ Hướng dẫn</button>
          <button class="btn sec grow" data-act="settings">⚙️ Cài đặt</button>
        </div>
      </div>`;
    show('hub');
  }

  /* ── shop ───────────────────────────────────────────────────────────────*/
  function showShop(cat) {
    if (cat) shopCat = cat;
    const d = derived(save);
    const tabs = [...CATS, { id: 'menu', name: 'Món ăn', emoji: '🍜' }].map(c =>
      `<button class="tab${c.id === shopCat ? ' on' : ''}" data-act="shop-tab" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`
    ).join('');

    const items = shopCat === 'menu' ? menuItems(d) : shopItems(shopCat, d);

    el.shop.innerHTML = `
      <div class="card">
        <div class="row" style="align-items:baseline">
          <h1 class="grow">🛒 Cửa hàng</h1>
          <div class="chip money"><span>💰</span><b>${vnd(save.money)}</b></div>
        </div>
        ${tierBlock()}
        <div class="tabs">${tabs}</div>
        <div class="items${shopCat === 'menu' ? ' grouped' : ''}">${items || '<p class="hint">Chưa có gì để mua ở mục này.</p>'}</div>
        <div class="row end" style="margin-top:14px">
          <button class="btn sec" data-act="hub">Đóng</button>
        </div>
      </div>`;
    show('shop');
  }

  function shopItems(cat, d) {
    return SHOP.filter(it => it.cat === cat).map(it => {
      const why = canBuy(save, it);
      const owned = !!save.owned[it.id];
      const pills = effPills(it).map(p => `<em>${esc(p)}</em>`).join('')
        + (it.wage ? `<em class="wage">lương ${vnd(it.wage)}/ngày</em>` : '');
      return `
        <div class="item${owned ? ' owned' : why ? ' locked' : ''}">
          <div class="em">${it.emoji}</div>
          <div>
            <h3>${esc(it.name)}</h3>
            <p>${esc(it.note)}</p>
            <div class="eff">${pills}</div>
            <button class="buy" data-act="buy" data-id="${it.id}" ${why ? 'disabled' : ''}>
              ${owned ? '✅ Đã có' : why ? esc(why) : `Mua · ${vnd(it.price)}`}
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function menuItems(d) {
    const out = [];
    for (const c of MENU_CATS) {
      const list = DISHES.filter(x => x.cat === c.id && x.unlock > 0);
      if (!list.length) continue;
      const known = list.filter(x => save.recipes.includes(x.id)).length;
      out.push(`<h4 class="grp">${c.emoji} ${esc(c.name)} <i>${known}/${list.length}</i></h4>`);
      out.push(list.map(dishCard).join(''));
    }
    return out.join('');
  }

  function dishCard(x) {
    const why = canLearn(save, x);
    const known = save.recipes.includes(x.id);
    const side = x.kind === 'drink' ? 'Đồ uống' : x.kind === 'dessert' ? 'Tráng miệng' : null;
    return `
      <div class="item${known ? ' owned' : why ? ' locked' : ''}">
        <div class="em">${x.emoji}</div>
        <div>
          <h3>${esc(x.name)}</h3>
          <p>Bán <b>${vnd(x.price)}</b>${x.kind === 'main' ? ` · nấu ${x.cook.toFixed(1)}s` : ''} · tiền chợ ${vnd(x.price * FOOD_COST_RATIO)}</p>
          <div class="eff">
            <em>lãi ${vnd(x.price * (1 - FOOD_COST_RATIO))} mỗi dĩa</em>
            ${side ? `<em>${side} — khách gọi thêm, tính vào hoá đơn</em>` : ''}
            ${x.tier >= 2 ? `<em>cần quán cấp ${dishNeedsLevel(x)}</em>` : ''}
          </div>
          <button class="buy" data-act="learn" data-id="${x.id}" ${why ? 'disabled' : ''}>
            ${known ? '✅ Đã biết nấu' : why ? esc(why) : `Học công thức · ${vnd(x.unlock)}`}
          </button>
        </div>
      </div>`;
  }

  /* ── missions ───────────────────────────────────────────────────────────*/
  function showMissions() {
    const cur = activeMission(save);
    const list = MISSIONS.map(m => {
      const done = save.missionsDone.includes(m.id);
      const on = cur && cur.id === m.id;
      return `
        <div class="mission${done ? ' done' : on ? ' on' : ''}">
          <span class="mark">${done ? '✅' : on ? '🎯' : '🔒'}</span>
          <div class="grow"><h3>${esc(m.title)}</h3><p>${esc(m.desc)}</p></div>
          ${m.reward ? `<span class="rw">+${vndShort(m.reward)}</span>` : ''}
        </div>`;
    }).join('');

    const goals = save.owner ? LEVELS.slice(1).map(L => {
      const hit = save.invested >= L.invested;
      return `<div class="mission${hit ? ' done' : ''}">
        <span class="mark">${hit ? '✅' : L.emoji}</span>
        <div class="grow"><h3>${esc(L.name)}</h3>
        <p>Đầu tư tổng cộng ${vnd(L.invested)} vào quán.</p></div>
        <span class="rw">${vndShort(save.invested)}</span></div>`;
    }).join('') : '';

    el.missions.innerHTML = `
      <div class="card">
        <h1>📋 Nhiệm vụ</h1>
        <p class="sub">Làm theo thứ tự. Xong hết là quán về tay bạn.</p>
        ${list}
        ${goals ? `<h2 style="margin-top:20px">🏆 Mục tiêu dài hạn</h2>${goals}` : ''}
        <div class="row end" style="margin-top:14px"><button class="btn sec" data-act="hub">Đóng</button></div>
      </div>`;
    show('missions');
  }

  /* ── ledger ─────────────────────────────────────────────────────────────*/
  function showLedger() {
    const d = derived(save);
    const staff = SHOP.filter(it => save.owned[it.id] && it.wage);
    const staffRows = staff.length
      ? staff.map(s => `<tr><td>${s.emoji} ${esc(s.name)}</td><td class="neg">−${vnd(s.wage)}</td></tr>`).join('')
      : '<tr><td>Chưa thuê ai — bạn tự chạy hết</td><td>0₫</td></tr>';

    el.ledger.innerHTML = `
      <div class="card">
        <h1>📒 Sổ sách</h1>
        <p class="sub">Tiền ra mỗi ngày, và quán tự kiếm được bao nhiêu khi bạn không ngồi đây.</p>

        <h2>Chi phí mỗi ngày</h2>
        <table class="ledger">
          <tr><td>Mặt bằng, điện nước, gas (${d.level.name})</td><td class="neg">−${vnd(d.overhead)}</td></tr>
          ${staffRows}
          <tr class="total"><td>Tổng chi mỗi ngày</td><td class="neg">−${vnd(d.dailyCost)}</td></tr>
        </table>

        <h2 style="margin-top:20px">Quán tự chạy</h2>
        <table class="ledger">
          <tr><td>Nhân viên tự bán khi bạn mở cửa quán</td>
              <td class="${d.idleNetPerMin ? 'pos' : 'neg'}">${d.idleNetPerMin
                ? '+' + vnd(Math.round(d.idleNetPerMin)) + '/phút'
                : 'Chưa thuê ai — phải tự đứng bán'}</td></tr>
          <tr><td>Khi bạn đóng tab (tối đa ${OFFLINE_CAP_HOURS} giờ)</td>
              <td class="${d.offlineNetPerMin ? 'pos' : 'neg'}">${d.offlineNetPerMin
                ? '+' + vnd(Math.round(d.offlineNetPerMin * OFFLINE_EFFICIENCY)) + '/phút'
                : 'Không ai bán — quán đóng cửa'}</td></tr>
          <tr class="total"><td>Tổng vốn đã đầu tư</td><td>${vnd(save.invested)}</td></tr>
        </table>

        <h2 style="margin-top:20px">Đã qua</h2>
        <div class="stats">
          <div class="stat"><b>${save.stats.shifts}</b><span>Ca đã chạy</span></div>
          <div class="stat"><b>${save.progress.groups}</b><span>Lượt khách</span></div>
          <div class="stat"><b>${save.progress.plates}</b><span>Món đã bưng</span></div>
          <div class="stat gold"><b>${vndShort(save.stats.revenue)}</b><span>Doanh thu</span></div>
        </div>

        <div class="row end" style="margin-top:14px"><button class="btn sec" data-act="hub">Đóng</button></div>
      </div>`;
    show('ledger');
  }

  /* ── naming the quán ────────────────────────────────────────────────────*/
  function nameInput() {
    const el = document.getElementById('name-field');
    return el ? el.value : '';
  }

  function showName(rename) {
    const picks = [...NAME_SUGGESTIONS].sort(() => Math.random() - 0.5).slice(0, 6);
    el.name.innerHTML = `
      <div class="card">
        <h1>📛 ${rename ? 'Đổi tên quán' : 'Đặt tên cho quán'}</h1>
        <p class="sub">${rename
          ? 'Tên mới sẽ thay luôn chữ trên biển hiệu ngoài phố.'
          : 'Quán là của bạn rồi. Viết tên lên biển hiệu đi — cả phố sẽ đọc nó.'}</p>
        <input id="name-field" class="field" maxlength="${MAX_NAME}" autocomplete="off"
               placeholder="Tên quán của bạn" value="${esc(save.name || '')}" />
        <div class="tabs" style="margin-top:12px">
          ${picks.map(n => `<button class="tab" data-act="name-pick" data-value="${esc(n)}">${esc(n)}</button>`).join('')}
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn grow" data-act="name-save">${rename ? 'Lưu tên' : 'Treo biển lên'}</button>
        </div>
      </div>`;
    show('name');
    const f = document.getElementById('name-field');
    if (f) { f.focus(); f.select(); }
  }

  /* ── the sign shop ──────────────────────────────────────────────────────*/
  function showSigns() {
    const items = FACADE.map(it => {
      const why = canBuyFacade(save, it);
      const owned = !!save.facade[it.id];
      return `
        <div class="item${owned ? ' owned' : why ? ' locked' : ''}">
          <div class="em">${it.emoji}</div>
          <div>
            <h3>${esc(it.name)}</h3>
            <p>${esc(it.note)}</p>
            <div class="eff"><em>khách ghé +${Math.round(it.draw * 100)}%</em></div>
            <button class="buy" data-act="buy-facade" data-id="${it.id}" ${why ? 'disabled' : ''}>
              ${owned ? '✅ Đã treo' : why ? esc(why) : `Mua · ${vnd(it.price)}`}
            </button>
          </div>
        </div>`;
    }).join('');

    el.signs.innerHTML = `
      <div class="card">
        <div class="row" style="align-items:baseline">
          <h1 class="grow">🪧 Tiệm bảng hiệu</h1>
          <div class="chip money"><span>💰</span><b>${vnd(save.money)}</b></div>
        </div>
        <p class="sub">Mặt tiền của <b>${esc(displayName(save))}</b>. Mọi thứ mua ở đây đều
          nhìn thấy được từ ngoài phố, và kéo thêm khách vào.</p>
        <div class="items">${items}</div>
        <div class="row" style="margin-top:14px">
          <button class="btn sec grow" data-act="rename">📛 Đổi tên quán</button>
          <button class="btn grow" data-act="street-back">Ra phố</button>
        </div>
      </div>`;
    show('signs');
  }

  /* ── the wholesale market run ───────────────────────────────────────────*/
  function showMarket() {
    el.market.innerHTML = `
      <div class="card">
        <h1>🥬 Chợ đầu mối</h1>
        <p class="sub">Sáu sạp, ba sạp có hàng tươi. Giỏ chạy qua chạy lại — bấm
          <b>E</b> hoặc chạm để dừng đúng sạp rau tươi. ${MARKET_ROUNDS} lượt, càng về sau càng nhanh.</p>
        <p class="hint">Lấy được hàng tươi thì <b>tiền chợ rẻ hơn</b> trong vài ca tới.</p>
        <div class="row" style="margin-top:16px">
          <button class="btn grow" data-act="market-go">🧺 Bắt đầu đi chợ</button>
          <button class="btn sec" data-act="street-back">Thôi để mai</button>
        </div>
      </div>`;
    show('market');
  }

  /* Runs its own frame loop over a row of stalls and calls back with the hits.
     The DOM is built once and only classes change per frame — rebuilding the
     markup every frame detaches the button mid-click, which makes the game
     unplayable exactly when the player is trying to press it. */
  function runMarket(done) {
    let round = 0, hits = 0, raf = 0, pos = 0, dir = 1, frozen = false;
    let current = makeMarketRound();

    el.market.innerHTML = `
      <div class="card">
        <h1 id="mk-title">🥬 Lượt 1/${MARKET_ROUNDS}</h1>
        <p class="sub" id="mk-sub">Dừng giỏ ở sạp rau tươi.</p>
        <div class="stalls" id="mk-stalls">
          ${Array.from({ length: MARKET_STALLS }, () => '<div class="stall"><span>🧺</span></div>').join('')}
        </div>
        <button class="btn wide" id="mk-stop" style="margin-top:16px">DỪNG GIỎ</button>
      </div>`;
    show('market');

    const stalls = [...el.market.querySelectorAll('.stall')];
    const title = $('mk-title'), sub = $('mk-sub'), btn = $('mk-stop');

    const cleanup = () => {
      cancelAnimationFrame(raf);
      if (marketKeyHandler) { window.removeEventListener('keydown', marketKeyHandler); marketKeyHandler = null; }
    };

    const stop = () => {
      if (frozen) return;
      frozen = true;
      cancelAnimationFrame(raf);
      const idx = Math.round(pos);
      const good = current.fresh.includes(idx);
      if (good) hits++;
      stalls.forEach((s, i) => {
        const fresh = current.fresh.includes(i);
        s.classList.toggle('fresh', fresh);
        s.classList.toggle('wilt', !fresh);
        s.firstElementChild.textContent = fresh ? '🥬' : '🥀';
      });
      sub.textContent = good ? 'Rau tươi! Lấy luôn.' : 'Hàng héo mất rồi.';

      setTimeout(() => {
        round++;
        if (round >= MARKET_ROUNDS) { cleanup(); done(hits); return; }
        current = makeMarketRound();
        stalls.forEach(s => {
          s.classList.remove('fresh', 'wilt');
          s.firstElementChild.textContent = '🧺';
        });
        title.textContent = `🥬 Lượt ${round + 1}/${MARKET_ROUNDS}`;
        sub.textContent = `Dừng giỏ ở sạp rau tươi. Đang được ${hits} lượt.`;
        pos = 0; dir = 1; frozen = false; last = 0;
        raf = requestAnimationFrame(loop);
      }, 780);
    };

    let last = 0;
    const loop = (now) => {
      if (!last) last = now;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pos += dir * (3.4 + round * 1.5) * dt;
      if (pos > MARKET_STALLS - 1) { pos = MARKET_STALLS - 1; dir = -1; }
      if (pos < 0) { pos = 0; dir = 1; }
      const at = Math.round(pos);
      stalls.forEach((s, i) => s.classList.toggle('on', i === at));
      raf = requestAnimationFrame(loop);
    };

    btn.addEventListener('click', stop);
    marketKeyHandler = e => {
      if (!el.market.classList.contains('show')) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); stop(); }
    };
    window.addEventListener('keydown', marketKeyHandler);
    raf = requestAnimationFrame(loop);
  }

  function showMarketResult(hits, reward) {
    el.market.innerHTML = `
      <div class="card">
        <h1>${hits >= 4 ? '🧺 Chuyến chợ ngon lành' : hits >= 2 ? '🧺 Cũng được' : '🧺 Hàng héo hết'}</h1>
        <p class="sub">Lấy được <b>${hits}/${MARKET_ROUNDS}</b> mớ rau tươi.</p>
        ${reward.ca > 0
          ? `<div class="mission on"><span class="mark">💸</span><div class="grow">
               <h3>Tiền chợ rẻ hơn ${Math.round(reward.cut * 100)}%</h3>
               <p>Áp dụng cho ${reward.ca} ca phục vụ tới.</p></div></div>`
          : `<p class="hint">Không đủ hàng tươi để tiết kiệm được gì. Mai đi sớm hơn.</p>`}
        <div class="row" style="margin-top:14px">
          <button class="btn grow" data-act="street-back">Ra phố</button>
        </div>
      </div>`;
    show('market');
  }

  /* ── the pavement cafe ──────────────────────────────────────────────────*/
  function showCafe(visit) {
    el.cafe.innerHTML = `
      <div class="card">
        <h1>☕ Cà phê cóc</h1>
        <p class="sub">Ngồi ghế nhựa, nhìn xe chạy. Mười lăm phút cho đỡ mỏi chân.</p>
        <div class="mission on">
          <span class="mark">${visit.kind === 'tip' ? '💰' : visit.kind === 'trend' ? '🔥' : '💬'}</span>
          <div class="grow">
            <h3>${visit.kind === 'tip' ? `Được ${vnd(visit.amount)}`
                 : visit.kind === 'trend' ? `Món đang hot: ${esc(visit.dish.name)}`
                 : 'Chuyện hàng xóm'}</h3>
            <p>${esc(visit.text)}</p>
          </div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn grow" data-act="street-back">Ra phố</button>
        </div>
      </div>`;
    show('cafe');
  }

  /* ── morning briefing ───────────────────────────────────────────────────
     Shown before the ca, because whatever the old owner did overnight applies
     to the shift you are about to work — not the one you just finished. */
  function showDayBriefing(day, events) {
    const d = derived(save);
    el.day.innerHTML = `
      <div class="card">
        <h1>🌅 Ngày ${day}/${TUTORIAL_DAYS}</h1>
        <p class="sub">Sáng ra quán đã khác một chút. Ca hôm nay chạy với những thứ này.</p>
        ${events.map(e => `
          <div class="mission on"><span class="mark">${e.emoji}</span>
            <div class="grow"><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></div></div>`).join('')}
        <div class="stats">
          <div class="stat"><b>${d.tables}</b><span>Bàn</span></div>
          <div class="stat"><b>${d.menu.length}</b><span>Món</span></div>
          <div class="stat gold"><b>${vndShort(shiftTarget(d))}</b><span>Chỉ tiêu ca này</span></div>
        </div>
        <button class="btn wide" data-act="day-go" style="margin-top:6px">🔥 VÀO CA</button>
      </div>`;
    show('day');
  }

  /* ── settings ───────────────────────────────────────────────────────────*/
  function showSettings(muted) {
    const d = derived(save);
    el.settings.innerHTML = `
      <div class="card">
        <h1>⚙️ Cài đặt</h1>
        <p class="sub">Âm thanh và tiến trình. Tiến trình lưu trong trình duyệt này.</p>

        <div class="row" style="margin-bottom:16px">
          <button class="btn sec grow" data-act="mute">${muted ? '🔇 Bật tiếng' : '🔊 Tắt tiếng'}
            <small>Phím tắt: M</small></button>
          ${save.owner ? `<button class="btn sec grow" data-act="rename">📛 Đổi tên quán
            <small>${esc(displayName(save))}</small></button>` : ''}
        </div>

        <h2>Tiến trình hiện tại</h2>
        <div class="stats">
          <div class="stat gold"><b>${vndShort(save.money)}</b><span>Tiền mặt</span></div>
          <div class="stat"><b>${save.owner ? d.level.name : 'Học việc'}</b><span>Trạng thái</span></div>
          <div class="stat"><b>${save.stats.shifts}</b><span>Ca đã chạy</span></div>
          <div class="stat"><b>${save.recipes.length}</b><span>Công thức</span></div>
        </div>

        <h2 style="margin-top:20px">Chơi lại từ đầu</h2>
        <p class="hint">Xoá sạch tiền, bàn ghế, nhân viên, công thức và nhiệm vụ <b>Không hoàn tác được.</b></p>
        <div class="row" style="margin-top:12px">
          <button class="btn sec grow" data-act="wipe" style="border-color:var(--red);color:var(--red)">
            🗑️ Xoá tiến trình và chơi lại</button>
        </div>

        <div class="row end" style="margin-top:16px">
          <button class="btn" data-act="settings-back">Xong</button>
        </div>
      </div>`;
    show('settings');
  }

  /* ── result ─────────────────────────────────────────────────────────────*/
  function showResult(r, earnedMissions) {
    const stars = '★★★'.slice(0, r.stars).padEnd(3, '☆');
    const missionHtml = earnedMissions.length ? earnedMissions.map(m =>
      `<div class="mission done"><span class="mark">🎉</span>
        <div class="grow"><h3>${esc(m.title)}</h3><p>Nhiệm vụ hoàn thành${m.reward ? ` · thưởng ${vnd(m.reward)}` : ''}</p></div></div>`
    ).join('') : '';

    el.result.innerHTML = `
      <div class="card">
        <h1>${r.passed ? '🎉 Hết ca!' : '😮‍💨 Chưa đạt'}</h1>
        ${!save.owner ? `<p class="sub" style="margin-bottom:10px">Ngày ${Math.min(save.tutorialDay || 0, TUTORIAL_DAYS)}/${TUTORIAL_DAYS} đi làm</p>` : ''}
        <div class="stars">${stars}</div>
        <p class="sub">${r.passed
          ? `Doanh thu vượt mục tiêu ${vnd(r.target)}.`
          : `Cần ${vnd(r.target)} mới đạt mục tiêu. Ca sau gỡ lại.`}</p>

        <table class="ledger">
          <tr><td>Tiền món (${r.groups} lượt khách đã thanh toán)</td><td class="pos">+${vnd(r.revenue)}</td></tr>
          ${r.servedAfterBell > 0
            ? `<tr><td>— trong đó phục vụ nốt sau khi hết giờ</td><td>${r.servedAfterBell} bàn</td></tr>` : ''}
          <tr><td>Tiền tip</td><td class="pos">+${vnd(r.tips)}</td></tr>
          <tr><td>Tiền nguyên liệu</td><td class="neg">−${vnd(r.foodCost)}</td></tr>
          <tr class="total"><td>Vào két</td><td class="pos">+${vnd(r.net)}</td></tr>
        </table>

        <div class="stats">
          <div class="stat green"><b>${r.green}</b><span>Xanh</span></div>
          <div class="stat"><b>${r.yellow}</b><span>Vàng</span></div>
          <div class="stat red"><b>${r.red}</b><span>Đỏ</span></div>
          <div class="stat"><b>${r.plates}</b><span>Dĩa đã bưng</span></div>
          <div class="stat red"><b>${r.angry}</b><span>Bỏ đi</span></div>
          <div class="stat"><b>${r.lost}</b><span>Không có bàn</span></div>
        </div>

        ${missionHtml}

        <div class="row" style="margin-top:14px">
          <button class="btn grow" data-act="hub">Về quán</button>
        </div>
      </div>`;
    show('result');
  }

  /* ── pause & rules ──────────────────────────────────────────────────────*/
  function showPause(sim) {
    el.pause.innerHTML = `
      <div class="card">
        <h1>⏸ Tạm dừng</h1>
        <p class="sub">${sim.mode === 'shift'
          ? 'Đồng hồ đang dừng. Thoát giữa chừng là mất lượt ca này.'
          : 'Quán vẫn mở, không mất gì cả.'}</p>
        <div class="row">
          <button class="btn grow" data-act="resume">Chơi tiếp</button>
          <button class="btn sec grow" data-act="quit">${sim.mode === 'shift' ? 'Bỏ ca, về quán' : 'Đóng cửa, về quán'}</button>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn sec grow" data-act="rules">Hướng dẫn</button>
        </div>
      </div>`;
    show('pause');
  }

  function showRules() {
    el.rules.innerHTML = `
      <div class="card">
        <h1>❓ Cách chơi</h1>
        <div class="hint">
          <p><b>Di chuyển</b> bằng WASD hoặc phím mũi tên (trên điện thoại thì kéo cần gạt).
             <b>Tương tác</b> bằng phím <b>E</b>, <b>Space</b> hoặc nút TƯƠNG TÁC</p>

          <p><b>Một lượt khách đi qua sáu bước:</b></p>
          <ol>
            <li>Khách vào ngồi rồi <b>giơ tay 🙋</b> — lại bàn đưa menu.</li>
            <li>Khách <b>xem menu 🤔</b> rồi <b>hiện món họ chọn ngay trong bong bóng</b>.
                Mỗi bàn gọi <b>đúng một món</b>, cả bàn ăn chung. Lại bàn lấy phiếu 🎫.</li>
            <li>Mang phiếu tới ô <b>ĐẶT MÓN</b> ở quầy bếp, bấm E để báo bếp.</li>
            <li>Bếp nấu xong thì đầu bếp bưng ra ô <b>LẤY MÓN</b> — bạn lại lấy, tối đa
                ${BASE_CARRY} dĩa một lượt (mua xe đẩy và khay bưng để mang được nhiều hơn).</li>
            <li>Bưng ra cho <b>bất kỳ bàn nào đã gọi đúng món đó</b> — hai bàn cùng gọi bánh mì
                thì dĩa nào cũng được, khỏi cần nhớ dĩa này của bàn nào.</li>
            <li>Khách ăn xong <b>đòi tính tiền 💵</b> — lại bàn bấm E để thu. Bàn trống cho lượt sau.</li>
          </ol>

          <p><b>Vòng tròn quanh bong bóng là kiên nhẫn của khách.</b> Trong ca phục vụ:
             <span style="color:var(--green)">xanh +30% tip</span>,
             <span style="color:var(--gold)">vàng +10%</span>,
             <span style="color:var(--red)">đỏ không có tip</span>. Hết vòng là khách giận bỏ về,
             mất trắng cả bàn đó.</p>

          <p><b>Tiền:</b> mỗi dĩa mất ${Math.round(FOOD_COST_RATIO * 100)}% giá bán cho tiền chợ,
             và mỗi ngày quán trừ tiền mặt bằng, điện nước cùng lương nhân viên — xem
             <b>Sổ sách</b>. Thuê phục vụ thì quán vẫn bán được cả lúc bạn đóng tab.</p>
        </div>
        <div class="row end" style="margin-top:14px">
          <button class="btn" data-act="rules-back">Đã hiểu</button>
        </div>
      </div>`;
    show('rules');
  }

  /* ── debug ──────────────────────────────────────────────────────────────*/
  const dbg = $('dbg');

  function updateDebug(sim) {
    if (!Debug.state.on || !Debug.state.overlay || !sim) { dbg.hidden = true; return; }
    dbg.hidden = false;
    dbg.textContent = Debug.overlayLines(sim, save).join('\n');
  }

  function showDebug(playing) {
    const d = derived(save);
    const btn = (act, label, sub, extra = '') =>
      `<button class="btn sec grow" data-act="${act}" ${extra}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`;

    el.debug.innerHTML = `
      <div class="card">
        <div class="row" style="align-items:baseline">
          <h1 class="grow">🐞 Chế độ debug</h1>
          <div class="chip money"><span>💰</span><b>${vndShort(save.money)}</b></div>
        </div>
        <p class="sub">Để xem hết nội dung game mà không phải chơi hết ba mươi ngày.
          Mở bằng <code>?debug=1</code> trên URL, đóng/mở lại bằng phím <b>~</b>.
          <b>Những gì bấm ở đây ghi thẳng vào file lưu</b> — muốn quay lại bản sạch thì
          dùng <b>Cài đặt → Xoá tiến trình</b>.</p>

        <div class="stats">
          <div class="stat"><b>${save.owner ? 'Chủ quán' : 'Học việc'}</b><span>Trạng thái</span></div>
          <div class="stat"><b>${d.level.n}</b><span>Cấp quán</span></div>
          <div class="stat"><b>${d.tables}/${8}</b><span>Bàn</span></div>
          <div class="stat"><b>${save.recipes.length}/${DISHES.length}</b><span>Công thức</span></div>
        </div>

        <h2 style="margin-top:18px">Tiến trình</h2>
        <div class="row">
          ${btn('dbg-owner', '👑 Sang tên quán ngay', 'Xong hết nhiệm vụ, 5 bàn, có tên', save.owner ? 'disabled' : '')}
          ${btn('dbg-rich', Debug.state.richMode ? '💰 Tiền vô hạn: BẬT' : '💰 Tiền vô hạn: TẮT', 'Tự bơm lại sau mỗi lần mua')}
        </div>
        <div class="row" style="margin-top:8px">
          ${btn('dbg-money', '💵 +100 triệu', 'Cộng một lần')}
          ${btn('dbg-energy', '⚡ Đầy lượt ca', `Hiện có ${save.energy}`)}
        </div>

        <h2 style="margin-top:18px">Mở khoá</h2>
        <div class="row">
          ${btn('dbg-recipes', '🍜 Học hết công thức', `${DISHES.length} món`)}
          ${btn('dbg-shop', '🛒 Mua hết cửa hàng', 'Bàn, nhân sự, bếp, trang trí')}
          ${btn('dbg-facade', '🪧 Mua hết mặt tiền', 'Biển hiệu, mái hiên, đèn')}
        </div>

        <h2 style="margin-top:18px">Nhảy cấp quán</h2>
        <div class="tabs">
          ${LEVELS.map(L => `<button class="tab${d.level.n === L.n ? ' on' : ''}"
             data-act="dbg-tier" data-n="${L.n}">${L.emoji} ${esc(L.name)}</button>`).join('')}
        </div>

        <h2 style="margin-top:18px">Ngày học việc</h2>
        <div class="tabs">
          ${[0, 3, 5, 6, 7, TUTORIAL_DAYS].map(n => `<button class="tab${save.tutorialDay === n ? ' on' : ''}"
             data-act="dbg-day" data-n="${n}">ngày ${n}</button>`).join('')}
        </div>

        <h2 style="margin-top:18px">Trong ca</h2>
        <div class="tabs">
          ${Debug.SPEEDS.map(x => `<button class="tab${Debug.state.speed === x ? ' on' : ''}"
             data-act="dbg-speed" data-n="${x}">tốc độ ×${x}</button>`).join('')}
          <button class="tab${Debug.state.overlay ? ' on' : ''}" data-act="dbg-overlay">📊 hiện thông số</button>
        </div>
        <div class="row" style="margin-top:8px">
          ${btn('dbg-guest', '🙋 Gọi khách vào ngay', 'Thêm một nhóm', playing ? '' : 'disabled')}
          ${btn('dbg-endshift', '⏭️ Kết thúc ca ngay', 'Nhảy tới màn kết quả', playing ? '' : 'disabled')}
          ${btn('dbg-street', '🚶 Ra phố ngay', 'Không cần mở cửa quán', save.owner ? '' : 'disabled')}
        </div>

        <div class="row end" style="margin-top:18px">
          <button class="btn" data-act="dbg-back">Đóng</button>
        </div>
      </div>`;
    show('debug');
  }

  /* ── wiring ─────────────────────────────────────────────────────────────*/
  $('screens').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    if (btn.dataset.act === 'name-pick') {
      const f = document.getElementById('name-field');
      if (f) { f.value = btn.dataset.value; f.focus(); }
      return;
    }
    if (marketKeyHandler) {
      window.removeEventListener('keydown', marketKeyHandler);
      marketKeyHandler = null;
    }
    on(btn.dataset.act, btn.dataset);
  });

  /* Enter submits the name field */
  $('screens').addEventListener('keydown', e => {
    if (e.target.id === 'name-field' && e.key === 'Enter') {
      e.preventDefault();
      on('name-save', { value: e.target.value });
    }
  });

  return {
    show, hideAll, openScreen, current, reopen, setHudVisible, updateHud, updateOrders, setPrompt, toast,
    showBoot, showHub, showShop, showMissions, showLedger, showResult, showPause,
    showRules, showSettings, showDayBriefing, showName, nameInput,
    showSigns, showMarket, runMarket, showMarketResult, showCafe,
    showDebug, updateDebug,
    get shopCat() { return shopCat; }
  };
}
