/* The panels you get by walking up to someone, and the build ghost.

   Nothing here pauses the game. Shopping is a decision to stop watching the
   field, which is the tension the whole design leans on. */

import { RES_ICON, RES_NAME, RETINUE_STEP, RETINUE_MAX, KING, TILE, clamp } from './config.js';
import { unitStats } from './factions.js';
import {
  defsFor, defOf, placementError, placeBuilding, canTrain, enqueue
} from './buildings.js';
import { canAfford, spend } from './entities.js';
import { Sound } from './audio.js';

/* ── king items ───────────────────────────────────────────────────────────── */

export const ITEMS = {
  sword: {
    glyph: '⚔️', name: 'Kiếm Vua', max: 3, cost: { gold: 70 },
    desc: '+9 sát thương mỗi cấp', apply: k => { k.dmg += 9; }
  },
  shield: {
    glyph: '🛡️', name: 'Khiên Vua', max: 3, cost: { gold: 60 },
    desc: '+120 máu tối đa mỗi cấp', apply: k => { k.maxHp += 120; k.hp += 120; }
  },
  boots: {
    glyph: '👢', name: 'Giày Da', max: 3, cost: { gold: 55 },
    desc: '+16% tốc độ mỗi cấp', apply: k => { k.speed = Math.round(k.speed * 1.16); }
  },
  horn: {
    glyph: '🎺', name: 'Tù Và', max: 1, cost: { gold: 95 },
    desc: 'Tùy tùng quanh Vua +25% sát thương', apply: () => {}
  },
  potion: {
    glyph: '🧪', name: 'Thuốc Hồi', max: 9, cost: { gold: 28 },
    desc: 'Bấm Q: hồi 180 máu cho Vua', consumable: true
  },
  rations: {
    glyph: '🍖', name: 'Lương Khô', max: 9, cost: { gold: 40 },
    desc: 'Bấm Q: hồi 90 máu cho cả đoàn tùy tùng', consumable: true
  }
};

/* what the merchant will do with your surplus */
const TRADES = [
  { give: { wood: 100 }, get: { gold: 26 }, label: 'Bán gỗ' },
  { give: { food: 100 }, get: { gold: 24 }, label: 'Bán thức ăn' },
  { give: { gold: 40 },  get: { wood: 100 }, label: 'Mua gỗ' },
  { give: { gold: 38 },  get: { food: 100 }, label: 'Mua thức ăn' }
];

const UPGRADES = {
  weapon:  { name: 'Rèn Vũ Khí', glyph: '⚔️', max: 3, base: 60, desc: '+15% sát thương toàn quân' },
  armor:   { name: 'Giáp Trận',  glyph: '🛡️', max: 3, base: 60, desc: '+15% máu toàn quân' },
  retinue: { name: 'Uy Danh',    glyph: '👑', max: 4, base: 45, desc: `+${RETINUE_STEP} chỗ trong đoàn tùy tùng` }
};

const costOf = (up, tier) => ({ gold: Math.round(up.base * (1 + tier * 0.85)) });

/* ── panel ────────────────────────────────────────────────────────────────── */

export function makeUI(G, els) {
  const UI = { open: null, ghost: null };
  const kd = () => G.player;

  const money = cost => Object.entries(cost)
    .filter(([, v]) => v)
    .map(([k, v]) => `${RES_ICON[k]}${v}`).join(' ') || 'miễn phí';

  function show(title, glyph, html, foot = '') {
    els.panel.hidden = false;
    els.icon.textContent = glyph;
    els.title.textContent = title;
    els.body.innerHTML = html;
    els.foot.innerHTML = foot;
  }

  function close() {
    UI.open = null;
    els.panel.hidden = true;
  }
  UI.close = close;

  /* ── the three townspeople ──────────────────────────────────────────────── */

  function openBuilder() {
    UI.open = 'builder';
    const k = kd();
    const cards = defsFor(k).map(def => {
      const afford = canAfford(k, def.cost);
      return `<button class="card${afford ? '' : ' poor'}" data-build="${def.key}">
        <span class="card-glyph">${def.glyph}</span>
        <span class="card-name">${def.name}</span>
        <span class="card-cost">${money(def.cost)}</span>
        <span class="card-desc">${def.desc}</span>
      </button>`;
    }).join('');
    show('THỢ XÂY', '🔨', `<div class="cards">${cards}</div>`,
      'Chọn công trình rồi bấm xuống bản đồ để đặt. Chuột phải hoặc <b>Esc</b> để hủy. ' +
      'Thợ gần nhất sẽ tự tới dựng — đứng cạnh và giữ <b>Space</b> để Vua xây cùng.');
  }

  /* The merchant is the only gold sink in the game: the king's own gear, the
     army's upgrades, and a spread on the two resources you have too much of. */
  function openMerchant() {
    UI.open = 'merchant';
    const k = kd();
    const items = Object.entries(ITEMS).map(([key, it]) => {
      const owned = k.items[key] || 0;
      const maxed = owned >= it.max;
      const afford = canAfford(k, it.cost);
      return `<button class="card${maxed || !afford ? ' poor' : ''}" data-item="${key}" ${maxed ? 'disabled' : ''}>
        <span class="card-glyph">${it.glyph}</span>
        <span class="card-name">${it.name}${owned ? ` ×${owned}` : ''}</span>
        <span class="card-cost">${maxed ? 'Tối đa' : money(it.cost)}</span>
        <span class="card-desc">${it.desc}</span>
      </button>`;
    }).join('');

    const trades = TRADES.map((t, i) => {
      const afford = canAfford(k, t.give);
      return `<button class="card small${afford ? '' : ' poor'}" data-trade="${i}">
        <span class="card-name">${t.label}</span>
        <span class="card-cost">${money(t.give)} → ${money(t.get)}</span>
      </button>`;
    }).join('');

    const ups = Object.entries(UPGRADES).map(([key, up]) => {
      const tier = k.upgrades[key];
      const maxed = tier >= up.max;
      const cost = costOf(up, tier);
      return `<button class="card small${maxed || !canAfford(k, cost) ? ' poor' : ''}"
        data-upgrade="${key}" ${maxed ? 'disabled' : ''}>
        <span class="card-glyph">${up.glyph}</span>
        <span class="card-name">${up.name} ${'●'.repeat(tier)}${'○'.repeat(up.max - tier)}</span>
        <span class="card-cost">${maxed ? 'Tối đa' : money(cost)}</span>
        <span class="card-desc">${up.desc}</span>
      </button>`;
    }).join('');

    show('THƯƠNG NHÂN', '🛒',
      `<h4 class="sub">TRANG BỊ CỦA VUA</h4>
       <div class="cards">${items}</div>
       <h4 class="sub">NÂNG CẤP TOÀN QUÂN</h4>
       <div class="cards">${ups}</div>
       <h4 class="sub">ĐỔI CHÁC</h4>
       <div class="cards">${trades}</div>`,
      `Vàng chỉ ra từ mỏ — và mỏ thì có thú canh. Vàng mua <b>chất</b>;
       thức ăn và gỗ mua <b>lượng</b>. Tùy tùng: ${k.retinue.length}/${k.retinueCap}`);
  }

  /* walking up to a barracks opens that barracks, not the whole town */
  function openBuilding(b) {
    UI.open = 'building';
    const k = kd();
    const cards = (b.def.trains || []).map(cls => {
      const s = unitStats(k.faction.id, cls);
      const why = canTrain(k, b, cls, s);
      return `<button class="card${why ? ' poor' : ''}" data-train-here="${cls}" ${why ? 'disabled' : ''}>
        <span class="card-glyph">${s.glyph}<i class="badge">${s.badge}</i></span>
        <span class="card-name">${s.name}</span>
        <span class="card-cost">${money(s.cost)} · ${s.build.toFixed(0)}s · 👥${s.pop}</span>
        <span class="card-desc">${why || `${s.hp} máu · ${s.dmg} sát thương`}</span>
      </button>`;
    }).join('');

    const queue = b.queue.length
      ? b.queue.map(j => unitStats(k.faction.id, j.cls).glyph).join(' ')
      : '—';

    show(b.def.name.toUpperCase(), b.def.glyph,
      `<div class="cards">${cards}</div>`,
      `Hàng đợi: ${queue} · <button class="mini" data-rally="1">📍 Đặt điểm tập kết ở chỗ Vua</button>`);
    UI.building = b;
  }

  UI.openFor = function (target) {
    Sound.order();
    if (target.kind === 'npc') {
      if (target.ref.npc === 'builder') openBuilder();
      else openMerchant();
    } else if (target.kind === 'building') {
      openBuilding(target.ref);
    }
  };

  /* ── build ghost ────────────────────────────────────────────────────────── */

  function startGhost(key) {
    const def = defOf(kd(), key);
    if (!def) return;
    UI.ghost = { def };
    G.ghost = { def, tx: 0, ty: 0, error: 'Đưa chuột lên bản đồ' };
    close();
  }

  UI.cancelGhost = function () {
    UI.ghost = null;
    G.ghost = null;
  };

  /* Follows the cursor, or on touch sits a little ahead of the king so a thumb
     can still place buildings. */
  UI.tick = function () {
    if (!G.ghost) return;
    const I = G.input, k = G.player.king;
    let wx, wy;
    if (I.touch) {
      wx = k.x + Math.cos(k.face) * 110;
      wy = k.y + Math.sin(k.face) * 110;
    } else {
      wx = G.R.wx(I.mouse.sx);
      wy = G.R.wy(I.mouse.sy);
    }
    const def = G.ghost.def;
    const tx = Math.floor(wx / TILE) - Math.floor(def.foot / 2);
    const ty = Math.floor(wy / TILE) - Math.floor(def.foot / 2);
    G.ghost.tx = tx;
    G.ghost.ty = ty;
    G.ghost.error = placementError(G, kd(), def, tx, ty);
  };

  function tryPlace() {
    if (!G.ghost || G.ghost.error) { Sound.deny(); return; }
    const k = kd();
    const b = placeBuilding(G, k, G.ghost.def, G.ghost.tx, G.ghost.ty);
    if (!b) { Sound.deny(); return; }
    Sound.build();
    G.assignBuilders?.(b, 2);
    UI.cancelGhost();
  }
  UI.tryPlace = tryPlace;

  /* ── panel clicks ───────────────────────────────────────────────────────── */

  els.body.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    const k = kd();

    if (btn.dataset.build) { startGhost(btn.dataset.build); return; }

    if (btn.dataset.trainHere) {
      const cls = btn.dataset.trainHere;
      const b = UI.building;
      const s = unitStats(k.faction.id, cls);
      if (!b || canTrain(k, b, cls, s)) { Sound.deny(); return; }
      enqueue(k, b, cls, s);
      Sound.train();
      openBuilding(b);
      return;
    }

    if (btn.dataset.upgrade) {
      const key = btn.dataset.upgrade;
      const up = UPGRADES[key];
      const tier = k.upgrades[key];
      const cost = costOf(up, tier);
      if (tier >= up.max || !canAfford(k, cost)) { Sound.deny(); return; }
      spend(k, cost);
      k.upgrades[key]++;
      if (key === 'retinue') k.retinueCap = Math.min(RETINUE_MAX, k.retinueCap + RETINUE_STEP);
      /* upgrades reach the troops already on the field, not just the next batch */
      if (key === 'weapon') for (const u of k.units) u.dmg = Math.round(u.dmg * 1.15);
      if (key === 'armor') for (const u of k.units) {
        const f = u.hp / u.maxHp;
        u.maxHp = Math.round(u.maxHp * 1.15);
        u.hp = Math.round(u.maxHp * f);
      }
      Sound.done();
      openMerchant();
      return;
    }

    if (btn.dataset.item) {
      const key = btn.dataset.item;
      const it = ITEMS[key];
      const owned = k.items[key] || 0;
      if (owned >= it.max || !canAfford(k, it.cost)) { Sound.deny(); return; }
      spend(k, it.cost);
      k.items[key] = owned + 1;
      if (!it.consumable) it.apply(k.king);
      Sound.coin();
      openMerchant();
      return;
    }

    if (btn.dataset.trade) {
      const t = TRADES[+btn.dataset.trade];
      if (!canAfford(k, t.give)) { Sound.deny(); return; }
      spend(k, t.give);
      for (const [kind, v] of Object.entries(t.get)) G.credit(k, kind, v);
      Sound.coin();
      openMerchant();
      return;
    }
  });

  els.foot.addEventListener('click', e => {
    const btn = e.target.closest('button[data-rally]');
    if (!btn || !UI.building) return;
    UI.building.rally = { x: G.player.king.x, y: G.player.king.y };
    Sound.order();
    openBuilding(UI.building);
  });

  els.close.addEventListener('click', close);

  /* clicking the world places a pending building instead of swinging */
  G.canvas.addEventListener('mousedown', e => {
    if (!G.ghost) return;
    if (e.button === 2) { UI.cancelGhost(); return; }
    if (e.button === 0) tryPlace();
  });
  G.canvas.addEventListener('touchend', () => { if (G.ghost) tryPlace(); });

  return UI;
}
