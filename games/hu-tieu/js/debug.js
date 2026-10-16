/* ?debug look panel: sliders for every value in look.js, applied live. The JSON box underneath
   is what to send back — it pastes straight over DEFAULTS in look.js. */
import { LOOK, DEFAULTS, saveLook, resetLook } from './look.js';

const SLIDERS = [
  ['Ánh sáng', [
    ['sky', 'Sky light (fill)', 0, 4, 0.05],
    ['sun', 'Sun light', 0, 4, 0.05],
    ['bands.0', 'Shade band: shadow', 0, 255, 1],
    ['bands.1', 'Shade band: mid', 0, 255, 1],
    ['bands.2', 'Shade band: lit', 0, 255, 1],
  ]],
  ['Màu (post)', [
    ['brightness', 'Brightness', 0.3, 1.6, 0.01],
    ['contrast', 'Contrast', 0.5, 1.8, 0.01],
    ['saturation', 'Saturation', 0, 2.5, 0.01],
    ['colorLevels', 'Colour levels', 3, 32, 1],
    ['dither', 'Dither', 0, 1, 0.01],
  ]],
  ['Nét & điểm ảnh', [
    ['outline', 'Outline darkness', 0, 1, 0.01],
    ['outlineDepth', 'Outline sensitivity', 0.001, 0.03, 0.0005],
    ['pixelRows', 'Pixel rows', 120, 720, 10],
  ]],
];

const get = path => path.split('.').reduce((o, k) => o[k], LOOK);
function set(path, v) {
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], LOOK)[last] = v;
}
const decimals = step => (String(step).split('.')[1] || '').length;

/** Build the panel. `onChange(path)` lets main.js react (resize on pixelRows, bands, …);
    `onLibrary()` opens the model library. */
export function createLookPanel(onChange, onLibrary) {
  const panel = document.createElement('div');
  panel.className = 'look-panel';
  panel.innerHTML = `<header><b>🎨 Look</b><button data-act="fold">–</button></header><div class="body"></div>`;
  const body = panel.querySelector('.body');

  const inputs = [];
  for (const [title, rows] of SLIDERS) {
    const h = document.createElement('h4');
    h.textContent = title;
    body.appendChild(h);
    for (const [path, label, min, max, step] of rows) {
      const row = document.createElement('label');
      row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
      const input = row.querySelector('input'), out = row.querySelector('output');
      const paint = () => { input.value = get(path); out.textContent = Number(get(path)).toFixed(decimals(step)); };
      input.addEventListener('input', () => {
        set(path, Number(input.value));
        out.textContent = Number(input.value).toFixed(decimals(step));
        saveLook();
        onChange(path);
        dump();
      });
      inputs.push(paint);
      body.appendChild(row);
    }
  }

  const json = document.createElement('textarea');
  json.readOnly = true;
  json.rows = 6;
  body.appendChild(json);
  const btns = document.createElement('div');
  btns.className = 'btns';
  btns.innerHTML = `<button data-act="copy">📋 Copy</button><button data-act="reset">↺ Reset</button><button data-act="lib">🧱 Models</button>`;
  body.appendChild(btns);

  function dump() {
    const changed = Object.keys(DEFAULTS).filter(k => JSON.stringify(LOOK[k]) !== JSON.stringify(DEFAULTS[k]));
    json.value = JSON.stringify(LOOK) + (changed.length ? `\n// changed: ${changed.join(', ')}` : '\n// = defaults');
  }
  const paintAll = () => { inputs.forEach(p => p()); dump(); };

  panel.addEventListener('click', e => {
    const act = e.target.dataset?.act;
    if (act === 'fold') { panel.classList.toggle('folded'); e.target.textContent = panel.classList.contains('folded') ? '+' : '–'; }
    if (act === 'copy') {
      json.select();
      navigator.clipboard?.writeText(JSON.stringify(LOOK)).catch(() => document.execCommand('copy'));
      e.target.textContent = '✓ Copied';
      setTimeout(() => { e.target.textContent = '📋 Copy'; }, 1200);
    }
    if (act === 'reset') { resetLook(); paintAll(); onChange('*'); }
    if (act === 'lib') onLibrary();
  });
  // keep game input (Escape, clicks) from leaking out of the panel
  panel.addEventListener('pointerdown', e => e.stopPropagation());

  paintAll();
  document.body.appendChild(panel);
  onChange('*');
  return panel;
}
