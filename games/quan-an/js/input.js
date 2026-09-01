/* Keyboard on desktop, thumb stick on touch. Both produce the same two things:
   a movement axis and an edge-triggered interact. */

const KEYS = {
  ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r'
};

export function createInput(canvas, stick) {
  const held = new Set();
  const st = { ax: 0, ay: 0, interact: false, pauseHit: false };
  let touch = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };

  const onKey = (e, down) => {
    const dir = KEYS[e.code];
    if (dir) { down ? held.add(dir) : held.delete(dir); e.preventDefault(); return; }
    if (!down) return;
    if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') { st.interact = true; e.preventDefault(); }
    if (e.code === 'Escape' || e.code === 'KeyP') st.pauseHit = true;
  };

  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);
  window.addEventListener('blur', () => held.clear());

  /* the stick lives under the left thumb, the interact button under the right */
  const rect = () => stick.getBoundingClientRect();
  const startTouch = e => {
    for (const t of e.changedTouches) {
      if (touch.id !== null) break;
      const r = rect();
      touch = { id: t.identifier, ox: r.left + r.width / 2, oy: r.top + r.height / 2, dx: 0, dy: 0 };
    }
    e.preventDefault();
  };
  const moveTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.id) continue;
      const max = rect().width / 2;
      let dx = t.clientX - touch.ox, dy = t.clientY - touch.oy;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      touch.dx = dx / max; touch.dy = dy / max;
      stick.style.setProperty('--nx', dx.toFixed(1) + 'px');
      stick.style.setProperty('--ny', dy.toFixed(1) + 'px');
    }
    e.preventDefault();
  };
  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier !== touch.id) continue;
      touch = { id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
      stick.style.setProperty('--nx', '0px');
      stick.style.setProperty('--ny', '0px');
    }
  };
  stick.addEventListener('touchstart', startTouch, { passive: false });
  stick.addEventListener('touchmove', moveTouch, { passive: false });
  stick.addEventListener('touchend', endTouch);
  stick.addEventListener('touchcancel', endTouch);

  return {
    axis() {
      let ax = (held.has('r') ? 1 : 0) - (held.has('l') ? 1 : 0);
      let ay = (held.has('d') ? 1 : 0) - (held.has('u') ? 1 : 0);
      if (!ax && !ay && touch.id !== null) {
        const dead = 0.18;
        if (Math.hypot(touch.dx, touch.dy) > dead) { ax = touch.dx; ay = touch.dy; }
      }
      return { ax, ay };
    },
    tapInteract() { st.interact = true; },
    consumeInteract() { const v = st.interact; st.interact = false; return v; },
    consumePause()    { const v = st.pauseHit; st.pauseHit = false; return v; },
    destroy() {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    }
  };
}
