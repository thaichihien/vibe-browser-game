/* DOM HUD: turn banner, side panels, captured trays, toasts, end overlay, rules modal.
   Copy is the original game's, verbatim. */
import { ANIMALS, SIDE_NAME } from './rules.js';

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
    const isRed = player === 'red';
    $('turnStatus').className = `status ${isRed ? 'red' : 'blue'}`;
    $('turnText').textContent = `Lượt: ${SIDE_NAME[player]}`;
    for (const [id, mine] of [['redTurn', isRed], ['blueTurn', !isRed]]) {
      $(id).textContent = mine ? 'ĐANG ĐI' : 'CHỜ';
      $(id).classList.toggle('idle', !mine);
    }
    setCurrent('red', null);
    setCurrent('blue', null);
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

  /** Show the animal a side is moving (portrait, name, strength), or a prompt when none. */
  function setCurrent(player, piece) {
    const box = $(player === 'red' ? 'redCurrent' : 'blueCurrent');
    box.innerHTML = '';
    if (!piece) {
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = player === turn ? 'Chọn một quân' : '';
      box.appendChild(hint);
      return;
    }
    const img = document.createElement('img');
    img.src = portraits[`${piece.type}:${piece.player}`] || '';
    img.alt = ANIMALS[piece.type].name;
    const text = document.createElement('div');
    const name = document.createElement('b');
    name.textContent = ANIMALS[piece.type].name;
    const rank = document.createElement('small');
    rank.textContent = `Sức mạnh ${ANIMALS[piece.type].rank}/8`;
    text.append(name, rank);
    box.append(img, text);
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

  function setSound(muted) { $('soundBtn').textContent = muted ? '🔇 Âm: TẮT' : '🔊 Âm: BẬT'; }

  return { setTurn, toast, setPortraits, setCurrent, showWin, hideWin, setSound };
}
