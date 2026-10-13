/* DOM HUD: turn banner, side panels, captured trays, toasts, end overlay, rules modal.
   Copy is the original game's, verbatim. */
import { ANIMALS, SIDE_NAME } from './rules.js';

export function createHud({ onRestart, onSoundToggle }) {
  const $ = id => document.getElementById(id);
  let portraits = {};
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
    const isRed = player === 'red';
    $('turnStatus').className = `status ${isRed ? 'red' : 'blue'}`;
    $('turnText').textContent = `Lượt: ${SIDE_NAME[player]}`;
    for (const [id, mine] of [['redTurn', isRed], ['blueTurn', !isRed]]) {
      $(id).textContent = mine ? 'ĐANG ĐI' : 'CHỜ';
      $(id).classList.toggle('idle', !mine);
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

  /** Add the lost piece to its side's tray; if `from` (viewport px) is given, fly it there. */
  function addCaptured(piece, from) {
    const tray = piece.player === 'red' ? $('redCaptured') : $('blueCaptured');
    const img = document.createElement('img');
    img.src = portraits[`${piece.type}:${piece.player}`] || '';
    img.alt = ANIMALS[piece.type].name;
    img.title = ANIMALS[piece.type].name;
    tray.appendChild(img);
    if (!from || !img.animate) return;
    const to = img.getBoundingClientRect();
    const fly = img.cloneNode();
    fly.className = 'cap-fly';
    fly.style.left = `${to.left}px`;
    fly.style.top = `${to.top}px`;
    document.body.appendChild(fly);
    img.style.visibility = 'hidden';
    fly.animate([
      { transform: `translate(${from.x - to.left - 20}px, ${from.y - to.top - 20}px) scale(1.6)` },
      { transform: 'translate(0, 0) scale(1)' },
    ], { duration: 700, easing: 'cubic-bezier(.3,.7,.3,1)' }).onfinish = () => {
      fly.remove();
      img.style.visibility = '';
    };
  }

  function clearCaptured() { $('redCaptured').innerHTML = ''; $('blueCaptured').innerHTML = ''; }

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

  return { setTurn, toast, setPortraits, addCaptured, clearCaptured, showWin, hideWin, setSound };
}
