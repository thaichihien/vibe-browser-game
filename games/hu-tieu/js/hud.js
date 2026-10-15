/* DOM overlays pinned to the 3D view: order bubbles over customers, cooking timers, the money
   bar, hover labels and floating "+45.000đ" text. */
import { iconImg } from './icons.js';
import { NOODLES, STYLES, TOPPINGS, EXTRAS, basketState, COOK_TIME, HOLD_TIME, TEA_TIME, CHOP_TIME, formatVnd, LEVELS } from './game.js';

const $ = id => document.getElementById(id);

export function createHud() {
  const layer = $('pins');
  const bubbles = new Map();          // customer id → element
  const timers = [];                  // basket/glass rings
  const hover = $('hoverTag');

  function bubbleHtml(c) {
    const items = c.items.map((it, k) => {
      const done = c.served[k] ? ' done' : '';
      if (it.kind === 'tea') return `<div class="item tea${done}">${iconImg('tra', 'Trà đá')}</div>`;
      const tops = it.tops.map(t => iconImg(t, TOPPINGS[t].name)).join('');
      // hành and giá are the default: show them, crossed out when the customer says "không";
      // tiêu and ớt only appear when asked for
      const extras = ['hanh', 'gia'].map(k => (it[k]
        ? `<span class="ex">${iconImg(k, EXTRAS[k].name)}</span>`
        : `<span class="ex no" title="Không ${EXTRAS[k].name.toLowerCase()}">${iconImg(k, 'Không ' + EXTRAS[k].name.toLowerCase())}</span>`)).join('') +
        ['tieu', 'ot'].filter(k => it[k]).map(k => `<span class="ex want">${iconImg(k, EXTRAS[k].name)}</span>`).join('');
      const nos = ['hanh', 'gia'].filter(k => !it[k]).map(k => `không ${EXTRAS[k].name.toLowerCase()}`);
      return `<div class="item${done}">
        <div class="base">${iconImg(it.style === 'kho' ? 'kho' : it.noodle, NOODLES[it.noodle].name)}
          <span>${NOODLES[it.noodle].name}<b class="${it.style}">${STYLES[it.style].name}</b></span></div>
        <div class="tops">${tops}</div>
        <div class="extras">${extras}</div>${nos.length ? `<div class="nos">${nos.join(', ')}</div>` : ''}</div>`;
    }).join('');
    return `<div class="items">${items}</div><div class="patience"><i></i></div>`;
  }

  function timer() {
    const el = document.createElement('div');
    el.className = 'timer';
    layer.appendChild(el);
    return el;
  }

  return {
    update(s, project, anchors) {
      // order bubbles
      const live = new Set();
      s.seats.forEach((c, i) => {
        if (!c || c.phase === 'leave') return;
        live.add(c.id);
        let el = bubbles.get(c.id);
        const sig = c.served.join();
        if (!el) {
          el = document.createElement('div');
          el.className = 'bubble';
          layer.appendChild(el);
          bubbles.set(c.id, el);
        }
        if (el.dataset.sig !== sig) { el.innerHTML = bubbleHtml(c); el.dataset.sig = sig; }
        const p = project(anchors.head(i));
        // hangs beside the face (left of it for the right-most seat, so it stays on screen)
        const flip = p.x > window.innerWidth - 190;
        const q = flip ? project(anchors.head(i).setX(anchors.head(i).x - 4.0)) : p;
        el.style.transform = `translate(${q.x}px, ${q.y}px) translate(${flip ? '-100%' : '0'}, -50%)`;
        el.classList.toggle('flip', flip);
        el.classList.toggle('entering', c.phase === 'enter');
        const k = c.patience / c.maxPatience;
        const bar = el.querySelector('.patience i');
        bar.style.width = `${k * 100}%`;
        bar.className = k > 0.6 ? 'ok' : k > 0.3 ? 'meh' : 'bad';
      });
      for (const [id, el] of bubbles) if (!live.has(id)) { el.remove(); bubbles.delete(id); }

      // basket and glass timers
      const rings = [];
      s.baskets.forEach((b, i) => {
        const st = basketState(b);
        if (st === 'empty') return;
        const k = st === 'cooking' ? b.t / COOK_TIME : st === 'ready' ? 1 - (b.t - COOK_TIME) / HOLD_TIME : 1;
        rings.push({ p: anchors.basket(i), k, cls: st });
      });
      if (s.scallion.chopT != null) rings.push({ p: anchors.board(), k: s.scallion.chopT / CHOP_TIME, cls: 'cooking' });
      if (s.lv.tea) s.glasses.forEach((g, i) => {
        if (g.state === 'filling') rings.push({ p: anchors.glass(i), k: g.t / TEA_TIME, cls: 'cooking' });
      });
      while (timers.length < rings.length) timers.push(timer());
      timers.forEach((el, i) => {
        const r = rings[i];
        el.hidden = !r;
        if (!r) return;
        const p = project(r.p);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.className = `timer ${r.cls}`;
        el.style.setProperty('--k', Math.max(0, Math.min(1, r.k)));
        el.textContent = r.cls === 'mushy' ? '!' : r.cls === 'ready' ? '✓' : '';
      });

      // how many bowls' worth of chopped hành are left
      const pile = $('pileTag');
      const pp = project(anchors.hanh());
      pile.hidden = false;
      pile.style.transform = `translate(${pp.x}px, ${pp.y}px) translate(-50%, -100%)`;
      pile.textContent = s.scallion.pile ? `×${s.scallion.pile}` : 'Cắt hành!';
      pile.classList.toggle('empty', !s.scallion.pile);

      // money bar
      const [t1, , t3] = s.targets;
      const max = t3 * 1.08;
      $('moneyFill').style.width = `${Math.min(1, s.money / max) * 100}%`;
      $('moneyText').textContent = formatVnd(s.money);
      s.targets.forEach((t, i) => {
        const star = $(`star${i}`);
        star.style.left = `${(t / max) * 100}%`;
        star.classList.toggle('got', s.money >= t);
      });
      $('goalText').textContent = `Mục tiêu ${formatVnd(t1)}`;
      const left = s.queue.length + s.seats.filter(c => c && c.phase !== 'leave').length;
      $('custText').textContent = `${left}/${s.lv.customers}`;
    },

    setHover(label, x, y) {
      hover.hidden = !label;
      if (!label) return;
      hover.textContent = label;
      hover.style.transform = `translate(${x}px, ${y}px) translate(-50%, -140%)`;
    },

    float(text, p, cls = '') {
      const el = document.createElement('div');
      el.className = `float ${cls}`;
      el.textContent = text;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    },

    clear() {
      for (const el of bubbles.values()) el.remove();
      bubbles.clear();
      timers.forEach(t => { t.hidden = true; });
      layer.querySelectorAll('.float').forEach(e => e.remove());
    },

    dayIntro(levelIdx, targets) {
      const lv = LEVELS[levelIdx];
      $('introDay').textContent = `Ngày ${levelIdx + 1}`;
      $('introTip').textContent = lv.tip;
      const names = [...lv.noodles.map(n => [n, NOODLES[n].name]), ...lv.styles.map(st => [st === 'kho' ? 'kho' : 'nuoc', STYLES[st].name]),
        ...lv.tops.map(t => [t, TOPPINGS[t].name]), ...(lv.tea ? [['tra', 'Trà đá']] : [])];
      $('introMenu').innerHTML = names.map(([k, n]) => `<span>${iconImg(k, n)}${n}</span>`).join('');
      $('introGoal').textContent = `${lv.customers} khách · mục tiêu ${formatVnd(targets[0])}`;
    },
  };
}
