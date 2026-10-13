/* Camera debug panel — open the game with ?debug in the URL. Sliders edit the shared VIEW
   object live; the readout is the line to paste back as the new defaults in scene.js. */

const FIELDS = [
  { key: 'yaw', label: 'Yaw °', min: -180, max: 180, step: 1, fmt: v => v.toFixed(0) },
  { key: 'pitch', label: 'Pitch °', min: 15, max: 85, step: 0.5, fmt: v => v.toFixed(1) },
  { key: 'zoom', label: 'Zoom', min: 0.6, max: 2, step: 0.01, fmt: v => v.toFixed(2) },
  { key: 'panX', label: 'Pan X', min: -3, max: 3, step: 0.05, fmt: v => v.toFixed(2) },
  { key: 'panZ', label: 'Pan Z', min: -3, max: 3, step: 0.05, fmt: v => v.toFixed(2) },
];

export function createDebugPanel({ view, onChange }) {
  if (!new URLSearchParams(location.search).has('debug')) return;
  const defaults = { ...view };
  let scale = view.pixel ?? null;

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:90;' +
    'background:#fffdf3;border:3px solid #2b1d14;box-shadow:0 4px 0 #2b1d14;padding:10px 12px;' +
    'font:13px/1.4 ui-monospace,Consolas,monospace;color:#2b1d14;width:min(420px,calc(100vw - 32px))';
  panel.innerHTML = '<b>📷 Camera debug</b>';

  const inputs = {};
  for (const f of FIELDS) {
    const row = document.createElement('label');
    row.style.cssText = 'display:grid;grid-template-columns:64px 1fr 52px;gap:8px;align-items:center';
    row.innerHTML = `<span>${f.label}</span><input type="range" min="${f.min}" max="${f.max}" step="${f.step}"><output></output>`;
    const input = row.querySelector('input');
    input.value = view[f.key];
    input.addEventListener('input', () => { view[f.key] = Number(input.value); update(); });
    inputs[f.key] = { input, out: row.querySelector('output'), f };
    panel.appendChild(row);
  }

  const scaleRow = document.createElement('label');
  scaleRow.style.cssText = 'display:grid;grid-template-columns:64px 1fr;gap:8px;align-items:center';
  scaleRow.innerHTML = '<span>Pixel</span><select><option value="">auto</option><option>2</option><option>3</option><option>4</option><option>5</option></select>';
  const select = scaleRow.querySelector('select');
  select.value = scale ? String(scale) : '';
  select.addEventListener('change', () => { scale = select.value ? Number(select.value) : null; view.pixel = scale; update(); });
  panel.appendChild(scaleRow);

  const readout = document.createElement('code');
  readout.style.cssText = 'display:block;margin:8px 0;padding:6px;background:#fff1d6;word-break:break-all';
  panel.appendChild(readout);

  const buttons = document.createElement('div');
  buttons.style.cssText = 'display:flex;gap:8px';
  buttons.innerHTML = '<button type="button">📋 Copy</button><button type="button">↺ Reset</button>';
  const [copyBtn, resetBtn] = buttons.querySelectorAll('button');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard?.writeText(readout.textContent).then(() => { copyBtn.textContent = '✔ Copied'; },
      () => { copyBtn.textContent = '✖ Select the text'; });
    setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
  });
  resetBtn.addEventListener('click', () => {
    Object.assign(view, defaults);
    for (const { input, f } of Object.values(inputs)) input.value = view[f.key];
    scale = view.pixel ?? null;
    select.value = scale ? String(scale) : '';
    update();
  });
  panel.appendChild(buttons);
  document.body.appendChild(panel);

  function update() {
    for (const { out, f } of Object.values(inputs)) out.textContent = f.fmt(view[f.key]);
    const parts = FIELDS.map(f => `${f.key}: ${f.fmt(view[f.key])}`);
    readout.textContent = `{ ${parts.join(', ')}, pixel: ${scale ?? 'auto'} }`;
    onChange(scale);
  }
  update();
}
