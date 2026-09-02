/* The inspect panel. Clicking a fighter outside of targeting opens their dossier:
   allies on the left of the stage, enemies on the right, so the panel always sits
   on the same side as the unit it describes. */

import { EL_ICON, elName, weakTo, strongAgainst, resists } from '../engine/elements.js';
import { statOf, ULT_FULL } from '../engine/combat.js';
import { tagOf } from '../engine/moves.js';
import { effectsOf } from '../data/effects.js';

const TIER_VI = { legend: 'HUYỀN THOẠI', elite: 'TINH NHUỆ', grunt: 'QUÂN THƯỜNG', boss: 'TRÙM' };
const STATS = [
  ['pwr', 'PWR', 'Sức mạnh — nhân vào mọi sát thương gây ra.'],
  ['grd', 'GRD', 'Giáp vật lý — giảm sát thương hệ ⚔️ Thép.'],
  ['wrd', 'WRD', 'Kháng nguyên tố — giảm sát thương của tám hệ còn lại.'],
  ['spd', 'SPD', 'Tốc độ — quyết định thứ tự trong dòng lượt.']
];

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chip = (icon, label, desc) =>
  `<span class="fx" data-tip="${esc(desc)}" title="${esc(desc)}"><i>${icon}</i>${esc(label)}</span>`;

function elBlock(era, u) {
  if (!u.el) return '';
  const weak = weakTo(u.el), strong = strongAgainst(u.el), soft = resists(u.el);
  const tag = (el) => `<span class="eltag" data-tip="${esc(elName(era, el))} (${el})">${EL_ICON[el]} ${esc(elName(era, el))}</span>`;
  return `
    <div class="sec">
      <div class="sec-hd">HỆ</div>
      <div class="el-self">${EL_ICON[u.el]} <b>${esc(elName(era, u.el))}</b> <span class="code">${u.el}</span></div>
      ${weak.length ? `<div class="el-line bad"><span>Sợ</span>${weak.map(tag).join('')}<em>×1.6 vào mình</em></div>` : ''}
      ${strong.length ? `<div class="el-line good"><span>Khắc</span>${strong.map(tag).join('')}<em>mình đánh ×1.6</em></div>` : ''}
      ${soft.length ? `<div class="el-line"><span>Chịu được</span>${soft.map(tag).join('')}<em>chỉ ×0.7 vào mình</em></div>` : ''}
      ${u.el === 'STEEL' ? `<div class="el-line"><em>Trung tính: không khắc ai và không sợ ai.</em></div>` : ''}
    </div>`;
}

export function renderInspect(el, u, era) {
  if (!u) { el.innerHTML = `<div class="ins-empty">Bấm vào một nhân vật để xem hồ sơ.</div>`; return; }

  const pct = Math.max(0, u.hp / u.max) * 100;
  const bar = pct < 25 ? 'low' : pct < 55 ? 'mid' : '';
  const fx = effectsOf(u);
  const bio = era.bios?.[u.baseName || u.n] || era.bios?.[u.n] || '';

  el.innerHTML = `
    <button class="ins-close" aria-label="Đóng">✕</button>
    <div class="ins-head">
      <div class="ins-face">${u.e}</div>
      <div class="ins-id">
        <div class="ins-name">${esc(u.n)}</div>
        <div class="ins-tier ${u.tier}">${TIER_VI[u.tier] || u.tier}</div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-hd">MÁU</div>
      <div class="ins-bar"><i class="${bar}" style="width:${pct}%"></i></div>
      <div class="ins-hp">${Math.max(0, Math.round(u.hp))} / ${u.max}${u.shield > 0 ? ` <span class="sh">+🛡️${Math.round(u.shield)}</span>` : ''}</div>
      ${u.ult ? `<div class="sec-hd sub">TUYỆT KỸ</div>
        <div class="ins-bar ult"><i style="width:${u.charge}%"></i></div>
        <div class="ins-hp">${Math.round(u.charge)} / ${ULT_FULL} — ${esc(u.ult.name)}</div>` : ''}
    </div>

    <div class="sec">
      <div class="sec-hd">TRẠNG THÁI</div>
      ${fx.length ? `<div class="fx-row">${fx.map(f => chip(f.icon, f.label, f.desc)).join('')}</div>`
                  : `<div class="ins-none">Không có hiệu ứng nào.</div>`}
    </div>

    ${elBlock(era, u)}

    <div class="sec">
      <div class="sec-hd">CHỈ SỐ</div>
      <div class="stat-grid">
        ${STATS.map(([k, label, desc]) => {
          const now = Math.round(statOf(u, k)), base = u[k];
          const cls = now > base ? 'up' : now < base ? 'down' : '';
          return `<div class="stat" data-tip="${esc(desc)}" title="${esc(desc)}">
            <span class="sk">${label}</span>
            <span class="sv ${cls}">${now}${now !== base ? `<em>(${base})</em>` : ''}</span></div>`;
        }).join('')}
      </div>
    </div>

    <div class="sec">
      <div class="sec-hd">CHIÊU THỨC</div>
      <div class="mv-list">
        ${u.mv.map(m => `<div class="mv-row"><b>${esc(m.name)}</b><span>${esc(tagOf(m, era))}</span></div>`).join('')}
        ${u.ult ? `<div class="mv-row ult"><b>★ ${esc(u.ult.name)}</b><span>${esc(tagOf(u.ult, era))}</span></div>` : ''}
      </div>
    </div>

    ${bio ? `<div class="sec"><div class="sec-hd">GIỚI THIỆU</div><p class="ins-bio">${esc(bio)}</p></div>` : ''}
  `;
}
