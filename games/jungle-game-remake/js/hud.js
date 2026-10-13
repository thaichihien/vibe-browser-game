/* DOM HUD: turn banner, side panels, captured trays, toasts, end overlay, rules modal.
   Copy is the original game's, verbatim. */
import { ANIMALS } from './rules.js';

export function createHud({ onRestart, onSoundToggle }) {
  const $ = id => document.getElementById(id);
  let portraits = {};
  let turn = 'red';
  let toastTimer = 0;

  $('restartBtn').addEventListener('click', onRestart);
  $('playAgainBtn').addEventListener('click', onRestart);
  $('soundBtn').addEventListener('click', onSoundToggle);

  const rules = $('rulesModal');
  const closeRules = () => rules.classList.remove('show');
  $('toggleRules').addEventListener('click', () => rules.classList.add('show'));
  $('rulesClose').addEventListener('click', closeRules);
  $('rulesOk').addEventListener('click', closeRules);
  rules.addEventListener('click', e => { if (e.target === rules) closeRules(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeRules(); });

  function setTurn(player) {
    turn = player;
    for (const side of ['red', 'blue']) {
      const mine = side === player;
      $(`${side}Side`).classList.toggle('active', mine);
      $(`${side}Side`).classList.toggle('idle', !mine);
      $(`${side}Turn`).textContent = mine ? 'ĐANG ĐI' : 'CHỜ…';
      $(`${side}Turn`).classList.toggle('idle', !mine);
    }
    setCurrent('red', null);
    setCurrent('blue', null);
  }

  /** Pieces each side still has on the board. */
  function setCounts(pieces) {
    for (const side of ['red', 'blue']) {
      $(`${side}Count`).textContent = `${pieces.filter(p => p.player === side).length} quân`;
    }
  }

  function toast(text, type = 'info') {
    document.querySelectorAll('.toast').forEach(t => t.remove());
    clearTimeout(toastTimer);
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = text;
    document.body.appendChild(el);
    toastTimer = setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    }, 1800);
  }

  function setPortraits(map) { portraits = map; }

  /** Show the animal a side is moving (framed portrait, name, strength pips), or a prompt. */
  function setCurrent(player, piece) {
    const box = $(`${player}Current`);
    box.innerHTML = '';
    const frame = document.createElement('div');
    frame.className = 'portrait';
    const text = document.createElement('div');
    if (!piece) {
      frame.classList.add('empty');
      frame.textContent = '?';
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = player === turn ? 'Chọn một quân' : 'Đang chờ lượt';
      text.appendChild(hint);
      box.append(frame, text);
      return;
    }
    const a = ANIMALS[piece.type];
    const img = document.createElement('img');
    img.src = portraits[`${piece.type}:${piece.player}`] || '';
    img.alt = a.name;
    frame.appendChild(img);
    const name = document.createElement('b');
    name.textContent = a.name;
    const pips = document.createElement('div');
    pips.className = 'pips';
    pips.title = `Sức mạnh ${a.rank}/8`;
    for (let i = 1; i <= 8; i++) {
      const pip = document.createElement('i');
      if (i <= a.rank) pip.className = 'on';
      pips.appendChild(pip);
    }
    const label = document.createElement('small');
    label.textContent = `Sức mạnh ${a.rank}/8`;
    text.append(name, pips, label);
    box.append(frame, text);
  }

  function showWin(player, reason) {
    const isRed = player === 'red';
    $('overEmoji').textContent = isRed ? '🔴' : '🔵';
    const title = $('overTitle');
    title.textContent = `${isRed ? '🔴 ĐỎ' : '🔵 XANH'} chiến thắng! 🏆`;
    title.className = isRed ? 'win-red' : 'win-blue';
    $('overReason').textContent = reason;
    $('overlay').classList.add('show');
  }
  const hideWin = () => $('overlay').classList.remove('show');

  function setSound(muted) {
    const btn = $('soundBtn');
    btn.textContent = muted ? '🔇' : '🔊';
    btn.title = muted ? 'Âm: TẮT' : 'Âm: BẬT';
    btn.setAttribute('aria-label', btn.title);
  }

  return { setTurn, setCounts, toast, setPortraits, setCurrent, showWin, hideWin, setSound };
}
