/* The shop modal: browse cubes and effects, spend what the runs earned.

   It builds its own DOM (the page only supplies the button), and it owns one
   small animated preview canvas that runs a throwaway fx buffer through the
   real effect callbacks — so what you see in the panel is exactly what the
   board will do. The preview loop only runs while the panel is open. */

import { SKINS, EFFECTS, Shop, drawCube, TIER_COLOR, REWARD } from './cosmetics.js';
import { makeFx, updateFx } from './fx.js';
import { Sound } from './audio.js';

const TRAIT_TEXT = {
  plain:   'Clean two-tone shell.',
  core:    'A pulsing core burning through the middle.',
  ring:    'A hard ring stamped into the face.',
  bars:    'Racing stripes, front to back.',
  checker: 'Quartered like a checker flag.',
  dots:    'Rivets at all four corners.',
  frame:   'Heavy border, industrial finish.',
  bolt:    'A live bolt fixed into the shell.',
  shard:   'Split diagonally, two materials.',
  glass:   'Translucent, with a hard highlight.',
  circuit: 'Etched traces and solder points.',
  prism:   'Never the same colour twice.'
};

const PREVIEW_CELLS = 4.7;   // how many board cells the preview canvas spans

export function createShopUI(onChange) {
  const root = document.createElement('div');
  root.className = 'shop';
  root.innerHTML = `
    <div class="shop-panel">
      <button class="rules-close" id="shop-close" aria-label="close">✕</button>
      <div class="shop-head">
        <h2>🛒 STORM SHOP</h2>
        <div class="wallet">⚡ <b id="shop-credits">0</b></div>
      </div>

      <div class="shop-tabs">
        <button class="stab on" data-tab="skin">CUBES <i id="tab-skin"></i></button>
        <button class="stab" data-tab="effect">EFFECTS <i id="tab-effect"></i></button>
      </div>

      <div class="shop-body">
        <aside class="shop-detail" id="shop-detail"></aside>
        <div class="shop-grid" id="shop-grid"></div>
      </div>

      <p class="shop-foot">
        Every run pays <b>${REWARD.perSecond} ⚡</b> per second survived and
        <b>${REWARD.perStorm} ⚡</b> per storm you lived through,
        <b>+${REWARD.bestBonus * 100}%</b> on a new best. Skins and effects are
        cosmetic — none of them change the odds.
      </p>
    </div>`;

  document.body.appendChild(root);

  const gridEl   = root.querySelector('#shop-grid');
  const detailEl = root.querySelector('#shop-detail');
  const creditEl = root.querySelector('#shop-credits');

  let tab = 'skin';
  let sel = { skin: Shop.skinId, effect: Shop.effectId };
  let raf = 0;

  const list = () => (tab === 'skin' ? SKINS : EFFECTS);
  const selected = () => list().find(d => d.id === sel[tab]) || list()[0];

  /* ── tiles ──────────────────────────────────────────────────────────── */

  function buildGrid() {
    gridEl.innerHTML = '';

    for (const def of list()) {
      const owned = Shop.owned(tab, def.id);
      const equipped = owned && def.id === (tab === 'skin' ? Shop.skinId : Shop.effectId);

      const tile = document.createElement('button');
      tile.className = 'tile' +
        (owned ? ' owned' : '') + (equipped ? ' on' : '') +
        (def.id === sel[tab] ? ' sel' : '');
      tile.style.setProperty('--tier', TIER_COLOR[def.tier]);
      tile.dataset.id = def.id;

      const art = document.createElement('div');
      art.className = 'tile-art';

      if (tab === 'skin') {
        const c = document.createElement('canvas');
        const px = 54, dpr = window.devicePixelRatio || 1;
        c.width = px * dpr; c.height = px * dpr;
        c.style.width = c.style.height = px + 'px';
        const cx = c.getContext('2d');
        cx.scale(dpr, dpr);
        // a still frame mid-cycle, so animated skins still show their colour
        drawCube(cx, px / 2, px / 2, px * 0.66, def, { t: 0.7, glowPx: 10 });
        art.appendChild(c);
      } else {
        art.textContent = def.emoji;
        art.classList.add('em');
      }

      tile.appendChild(art);

      const label = document.createElement('span');
      label.className = 'tile-name';
      label.textContent = def.name;
      tile.appendChild(label);

      const foot = document.createElement('span');
      foot.className = 'tile-foot';
      foot.textContent = equipped ? '● ON' : owned ? 'OWNED' : `⚡ ${def.price}`;
      tile.appendChild(foot);

      if (!owned) tile.classList.add('locked');
      gridEl.appendChild(tile);
    }
  }

  gridEl.addEventListener('click', ev => {
    const tile = ev.target.closest('.tile');
    if (!tile) return;
    sel[tab] = tile.dataset.id;
    gridEl.querySelectorAll('.tile').forEach(t => t.classList.toggle('sel', t === tile));
    buildDetail();
    resetPreview();
  });

  /* ── detail pane ────────────────────────────────────────────────────── */

  function buildDetail() {
    const def = selected();
    const owned = Shop.owned(tab, def.id);
    const equipped = owned && def.id === (tab === 'skin' ? Shop.skinId : Shop.effectId);
    const short = def.price - Shop.credits;

    const blurb = tab === 'skin'
      ? (TRAIT_TEXT[def.trait] || 'Standard issue.')
      : def.desc;

    const action = equipped ? '<button class="btn small" disabled>✔ EQUIPPED</button>'
      : owned ? '<button class="btn small" id="shop-act">EQUIP</button>'
      : short <= 0 ? `<button class="btn small" id="shop-act">BUY ⚡ ${def.price}</button>`
      : `<button class="btn small" disabled>⚡ ${short} SHORT</button>`;

    detailEl.innerHTML = `
      <canvas id="shop-preview" width="180" height="180"></canvas>
      <div class="det-name" style="--tier:${TIER_COLOR[def.tier]}">${def.name}</div>
      <div class="det-tier" style="--tier:${TIER_COLOR[def.tier]}">${def.tier.toUpperCase()}</div>
      <p class="det-blurb">${blurb}</p>
      ${action}`;

    const act = detailEl.querySelector('#shop-act');
    if (act) act.onclick = () => {
      if (Shop.owned(tab, def.id)) { Shop.equip(tab, def.id); Sound.step(); }
      else if (Shop.buy(tab, def.id)) Sound.pickup();
      else { Sound.warn(); return; }
      refresh();
    };

    bindPreview();
  }

  /* ── the live preview ───────────────────────────────────────────────── */

  let pv = null;

  function bindPreview() {
    const c = detailEl.querySelector('#shop-preview');
    if (!c) { pv = null; return; }

    /* the stylesheet owns the size (it shrinks on a phone), so measure the box
       rather than pinning it inline — an inline height with a CSS-clamped
       width is exactly how you end up with a stretched cube */
    const dpr = window.devicePixelRatio || 1;
    const size = Math.round(c.getBoundingClientRect().width) || 180;
    c.style.height = size + 'px';
    c.width = c.height = Math.round(size * dpr);

    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);

    pv = { ctx, size, cell: size / PREVIEW_CELLS,
           fx: makeFx(), scratch: {}, t: 0, step: 0, at: -0.45, last: 0 };
  }

  function resetPreview() { if (pv) { pv.fx = makeFx(); pv.scratch = {}; pv.step = 0; } }

  /* what the preview shows: the selected item plus whatever is equipped in the
     other slot, so you always see the pairing you would actually play */
  function previewPair() {
    const skin = tab === 'skin'
      ? (SKINS.find(s => s.id === sel.skin) || Shop.skin())
      : Shop.skin();
    const effect = tab === 'effect'
      ? (EFFECTS.find(e => e.id === sel.effect) || Shop.effect())
      : Shop.effect();
    return { skin, effect };
  }

  function loop(now) {
    if (!root.classList.contains('show')) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    if (!pv) return;

    const dt = Math.min(0.05, (now - pv.last) / 1000 || 0);
    pv.last = now;
    pv.t += dt;

    const { skin, effect } = previewPair();
    const cx = pv.size / 2, cy = pv.size / 2;

    // the cube paces back and forth so step-effects have something to fire on
    pv.step -= dt;
    if (pv.step <= 0) {
      pv.step = 0.62;
      pv.at = -pv.at;
      if (effect.step) effect.step(pv.fx, pv.at, 0, pv.scratch, pv.t);
    }
    if (effect.tick) effect.tick(pv.fx, pv.at, 0, pv.scratch, dt, pv.t);
    updateFx(pv.fx, dt);

    const { ctx, size, cell } = pv;
    ctx.clearRect(0, 0, size, size);

    const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, size * 0.7);
    bg.addColorStop(0, '#131f36');
    bg.addColorStop(1, '#080b14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, size, size);

    // a scrap of the board, so the cube is not floating in a void
    ctx.strokeStyle = '#1e2b45';
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * cell, 0); ctx.lineTo(cx + i * cell, size);
      ctx.moveTo(0, cy + i * cell); ctx.lineTo(size, cy + i * cell);
      ctx.stroke();
    }

    paintFx(ctx, pv.fx, cx, cy, cell, true);
    drawCube(ctx, cx + pv.at * cell, cy, cell * 0.78, skin, { t: pv.t, face: '🙂' });
    paintFx(ctx, pv.fx, cx, cy, cell, false);
  }

  /* the board renderer paints particles through its own cell-space toolkit;
     this is the same maths at preview scale */
  function paintFx(ctx, fx, cx, cy, cell, under) {
    for (const p of fx.items) {
      if ((p.kind === 'ring') !== under) continue;   // rings behind, sparks in front
      const k = Math.max(0, 1 - p.t / p.life);
      const x = cx + p.x * cell, y = cy + p.y * cell;

      ctx.save();
      ctx.globalAlpha = k;

      if (p.kind === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * (p.t / p.life);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, p.width * k);
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, r * cell), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.emoji) {
        ctx.translate(x, y);
        ctx.rotate(p.t * 6);
        ctx.font = `${p.size * 2.6 * cell}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, 0, 0);
      } else if (p.kind === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `700 ${p.size * cell}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, x, y);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, p.size * cell), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ── wiring ─────────────────────────────────────────────────────────── */

  function refresh() {
    const c = Shop.counts();
    creditEl.textContent = Shop.credits.toLocaleString();
    root.querySelector('#tab-skin').textContent = `${c.skin.owned}/${c.skin.total}`;
    root.querySelector('#tab-effect').textContent = `${c.effect.owned}/${c.effect.total}`;
    buildGrid();
    buildDetail();
    if (onChange) onChange();
  }

  root.querySelectorAll('.stab').forEach(b => {
    b.onclick = () => {
      tab = b.dataset.tab;
      root.querySelectorAll('.stab').forEach(x => x.classList.toggle('on', x === b));
      refresh();
      resetPreview();
    };
  });

  root.querySelector('#shop-close').onclick = close;
  root.addEventListener('click', ev => { if (ev.target === root) close(); });

  function open() {
    sel = { skin: Shop.skinId, effect: Shop.effectId };
    // shown first: the preview measures its own box, and a display:none box
    // measures zero — which is how it ends up square on desktop and stretched
    // on a phone
    root.classList.add('show');
    refresh();
    resetPreview();
    if (!raf) { pv && (pv.last = performance.now()); raf = requestAnimationFrame(loop); }
  }

  function close() {
    root.classList.remove('show');
    cancelAnimationFrame(raf);
    raf = 0;
  }

  return {
    open, close,
    toggle() { root.classList.contains('show') ? close() : open(); },
    isOpen: () => root.classList.contains('show'),
    refresh
  };
}
