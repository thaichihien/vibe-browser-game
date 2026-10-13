/* DOM HUD: turn banner, side panels, captured trays, toasts, end overlay, rules modal, and the
   start screen that picks 2 players or an AI level. Copy is the original game's, verbatim,
   except for the start screen and the vs-AI lines. */
import { ANIMALS } from './rules.js';

const MODE_LABEL = { pvp: '2 người', easy: 'Đấu với máy (Dễ)', normal: 'Đấu với máy (Thường)', hard: 'Đấu với máy (Khó)' };

export function createHud({ onRestart, onPlayAgain, onSoundToggle, onMusicVolume, onSfxVolume, onModeButton, onStart }) {
  const $ = id => document.getElementById(id);
  let turn = 'red';
  let aiSide = null;            // the side the computer plays, or null for 2 players
  let toastTimer = 0;

  $('restartBtn').addEventListener('click', onRestart);
  $('playAgainBtn').addEventListener('click', onPlayAgain);
  // Audio menu: the 🔊 button opens it; sliders report 0–1 while dragging, and the effects
  // slider plays a sample when let go so the new level can be heard.
  const panel = $('audioPanel');
  const soundBtn = $('soundBtn');
  function closePanel() {
    panel.hidden = true;
    soundBtn.setAttribute('aria-expanded', 'false');
  }
  soundBtn.addEventListener('click', e => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    soundBtn.setAttribute('aria-expanded', String(!panel.hidden));
  });
  document.addEventListener('click', e => { if (!panel.hidden && !panel.contains(e.target)) closePanel(); });
  $('muteBtn').addEventListener('click', onSoundToggle);
  $('musicVol').addEventListener('input', e => {
    $('musicVolVal').textContent = `${e.target.value}%`;
    onMusicVolume(e.target.value / 100, false);
  });
  $('sfxVol').addEventListener('input', e => {
    $('sfxVolVal').textContent = `${e.target.value}%`;
    onSfxVolume(e.target.value / 100, false);
  });
  $('sfxVol').addEventListener('change', e => onSfxVolume(e.target.value / 100, true));
  $('modeBtn').addEventListener('click', onModeButton);

  const rules = $('rulesModal');
  const closeRules = () => rules.classList.remove('show');
  $('toggleRules').addEventListener('click', () => rules.classList.add('show'));
  $('rulesClose').addEventListener('click', closeRules);
  $('rulesOk').addEventListener('click', closeRules);
  rules.addEventListener('click', e => { if (e.target === rules) closeRules(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeRules(); closeStart(); closePanel(); } });

  // Start screen. At boot and after a finished game it must be answered; opened from the mode
  // button mid-game it can be dismissed to carry on with the game in progress.
  const start = $('startMenu');
  let startClosable = false;
  function showStart(mode, closable) {
    startClosable = closable;
    $('startClose').hidden = !closable;
    document.querySelectorAll('#startMenu [data-mode]').forEach(btn => {
      btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
    });
    start.classList.add('show');
  }
  const hideStart = () => start.classList.remove('show');
  function closeStart() { if (startClosable) hideStart(); }
  $('startClose').addEventListener('click', closeStart);
  start.addEventListener('click', e => { if (e.target === start) closeStart(); });
  document.querySelectorAll('#startMenu [data-mode]').forEach(btn => {
    btn.addEventListener('click', () => { hideStart(); onStart(btn.dataset.mode); });
  });

  /** Reflect the mode: button face, and a robot crest on the side the AI plays. */
  function setMode(mode, side) {
    aiSide = mode === 'pvp' ? null : side;
    const modeBtn = $('modeBtn');
    modeBtn.textContent = aiSide ? '🤖' : '👥';
    modeBtn.title = `Chế độ: ${MODE_LABEL[mode]}`;
    modeBtn.setAttribute('aria-label', modeBtn.title);
    for (const p of ['red', 'blue']) $(`${p}Crest`).textContent = aiSide === p ? '🤖' : '🐾';
    setCurrent('red', null);
    setCurrent('blue', null);
  }

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

  /** Show the animal a side is moving (its emoji face, name, strength pips), or a prompt. */
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
      hint.textContent = player !== turn ? 'Đang chờ lượt'
        : player === aiSide ? 'Máy đang nghĩ…' : 'Chọn một quân';
      text.appendChild(hint);
      box.append(frame, text);
      return;
    }
    const a = ANIMALS[piece.type];
    const face = document.createElement('span');
    face.className = 'face';
    face.textContent = a.emoji;
    face.setAttribute('aria-label', a.name);
    frame.appendChild(face);
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
    title.textContent = !aiSide ? `${isRed ? '🔴 ĐỎ' : '🔵 XANH'} chiến thắng! 🏆`
      : player === aiSide ? '🤖 Máy thắng rồi!' : '🏆 Bạn đã thắng máy!';
    title.className = isRed ? 'win-red' : 'win-blue';
    $('overReason').textContent = reason;
    $('overlay').classList.add('show');
  }
  const hideWin = () => $('overlay').classList.remove('show');

  function setSound(muted) {
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.title = muted ? 'Âm thanh: TẮT' : 'Âm thanh';
    soundBtn.setAttribute('aria-label', soundBtn.title);
    $('muteBtn').textContent = muted ? '🔊 Bật tiếng' : '🔇 Tắt tiếng';
    panel.classList.toggle('muted', muted);
  }

  /** Put the stored volumes (0–1) on the sliders. */
  function setVolumes(music, sfx) {
    for (const [id, v] of [['musicVol', music], ['sfxVol', sfx]]) {
      const pct = Math.round(v * 100);
      $(id).value = String(pct);
      $(`${id}Val`).textContent = `${pct}%`;
    }
  }

  return { setTurn, setCounts, toast, setCurrent, showWin, hideWin, setSound, setVolumes, setMode, showStart, hideStart };
}
