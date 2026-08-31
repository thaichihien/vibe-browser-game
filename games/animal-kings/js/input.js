/* Keyboard, mouse and touch, normalised into one poll-able object.
   Held state lives in `keys`; one-shot presses queue in `pressed` and are drained
   once per frame by whoever cares. */

export function makeInput(canvas) {
  const I = {
    keys: new Set(),
    pressed: [],
    mouse: { sx: 0, sy: 0, x: 0, y: 0, down: false, clicked: false },
    stick: { active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0 },
    touch: false,
    enabled: true,
    /* buttons the HUD lights up; the DOM layer pokes these */
    virtual: new Set()
  };

  const code = e => e.code || e.key;

  addEventListener('keydown', e => {
    if (!I.enabled) return;
    const c = code(e);
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    if (!I.keys.has(c)) I.pressed.push(c);
    I.keys.add(c);
  });
  addEventListener('keyup', e => I.keys.delete(code(e)));
  addEventListener('blur', () => { I.keys.clear(); I.stick.active = false; });

  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    I.mouse.sx = e.clientX - r.left;
    I.mouse.sy = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { I.mouse.down = true; I.mouse.clicked = true; }
  });
  addEventListener('mouseup', e => { if (e.button === 0) I.mouse.down = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  /* touch: left half drives the stick, right half is a tap-to-act zone */
  canvas.addEventListener('touchstart', e => {
    I.touch = true;
    for (const t of e.changedTouches) {
      const r = canvas.getBoundingClientRect();
      const x = t.clientX - r.left, y = t.clientY - r.top;
      if (x < r.width * 0.45 && !I.stick.active) {
        I.stick.active = true; I.stick.id = t.identifier; I.stick.ox = x; I.stick.oy = y;
        I.stick.dx = 0; I.stick.dy = 0;
      } else {
        I.mouse.sx = x; I.mouse.sy = y; I.mouse.down = true; I.mouse.clicked = true;
      }
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    const r = canvas.getBoundingClientRect();
    for (const t of e.changedTouches) {
      if (t.identifier !== I.stick.id) continue;
      const dx = (t.clientX - r.left) - I.stick.ox;
      const dy = (t.clientY - r.top) - I.stick.oy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 52) / d;
      I.stick.dx = dx * k; I.stick.dy = dy * k;
    }
    e.preventDefault();
  }, { passive: false });

  const endTouch = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === I.stick.id) {
        I.stick.active = false; I.stick.id = null; I.stick.dx = 0; I.stick.dy = 0;
      } else I.mouse.down = false;
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  /* ── queries ────────────────────────────────────────────────────────────── */

  I.axis = () => {
    let dx = 0, dy = 0;
    if (I.keys.has('KeyA') || I.keys.has('ArrowLeft'))  dx -= 1;
    if (I.keys.has('KeyD') || I.keys.has('ArrowRight')) dx += 1;
    if (I.keys.has('KeyW') || I.keys.has('ArrowUp'))    dy -= 1;
    if (I.keys.has('KeyS') || I.keys.has('ArrowDown'))  dy += 1;
    if (I.stick.active) { dx += I.stick.dx; dy += I.stick.dy; }
    const d = Math.hypot(dx, dy);
    return d > 1 ? { dx: dx / d, dy: dy / d } : { dx, dy };
  };

  I.took = codeWanted => {
    const i = I.pressed.indexOf(codeWanted);
    if (i < 0) return false;
    I.pressed.splice(i, 1);
    return true;
  };

  I.tookVirtual = name => {
    if (!I.virtual.has(name)) return false;
    I.virtual.delete(name);
    return true;
  };

  I.endFrame = () => { I.pressed.length = 0; I.mouse.clicked = false; I.virtual.clear(); };

  return I;
}
