// Keyboard + mouse input. Held keys give steering and movement; one-shot
// presses (enter car, punch, pause, reload, interact) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_CROUCH = 32;
export const ACTION_JUMP = 64;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const CROUCH = new Set(['KeyC']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDown = false;
  let mouseDownEdge = false;
  let lookDX = 0;
  let lookDY = 0;
  let pointerLocked = false;

  function press(code) {
    if (FORWARD.has(code) || BACK.has(code) || LEFT.has(code) || RIGHT.has(code) || SPRINT.has(code)) {
      held.add(code);
      return true;
    }
    if (CONFIRM.has(code)) { if (!actionsLocked(code)) actions |= ACTION_CONFIRM; return true; }
    if (PAUSE.has(code)) { actions |= ACTION_PAUSE; return true; }
    if (ENTER.has(code)) { actions |= ACTION_ENTER; return true; }
    if (PUNCH.has(code)) { actions |= ACTION_PUNCH; return true; }
    if (RELOAD.has(code)) { actions |= ACTION_RELOAD; return true; }
    if (CROUCH.has(code)) { actions |= ACTION_CROUCH; return true; }
    return false;
  }
  // Space doubles as jump on foot and handbrake in a car; the loop decides.
  let lastSpaceDown = 0;
  function actionsLocked() { return false; }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (press(event.code)) event.preventDefault();
    if (event.code === 'Space') {
      actions |= ACTION_JUMP;
      lastSpaceDown = performance.now();
    }
    if (event.code === 'KeyM') window.dispatchEvent(new CustomEvent('solmar-mute'));
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    mouseDownEdge = true;
    canvas.focus();
    // Pointer lock gives mouse-look; if the browser refuses, drag-look still works.
    if (canvas.requestPointerLock) {
      const p = canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    }
  });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  window.addEventListener('pointermove', (event) => {
    if (pointerLocked) { lookDX += event.movementX; lookDY += event.movementY; }
    else if (mouseDown) { lookDX += event.movementX; lookDY += event.movementY; }
  });

  function axis(positive, negative) {
    const p = [...positive].some((c) => held.has(c));
    const n = [...negative].some((c) => held.has(c));
    return (p ? 1 : 0) - (n ? 1 : 0);
  }

  return {
    /** Forward/back axis: +1 forward, -1 back. */
    throttle() { return axis(FORWARD, BACK); },
    /** Left/right axis: +1 right, -1 left. */
    steer() { return axis(RIGHT, LEFT); },
    sprint() { return [...SPRINT].some((c) => held.has(c)); },
    handbrake() { return held.has('Space'); },
    mouseHeld() { return mouseDown; },
    mousePressed() {
      const v = mouseDownEdge;
      mouseDownEdge = false;
      return v;
    },
    /** Mouse-look deltas since the last call, in pixels. */
    takeLook() {
      const dx = lookDX;
      const dy = lookDY;
      lookDX = 0;
      lookDY = 0;
      return { dx, dy };
    },
    /** One-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Used by scripted screenshot scenes to drive without a keyboard. */
    inject(key, down) {
      if (down) held.add(key);
      else held.delete(key);
    },
    lastSpaceDown() { return lastSpaceDown; },
  };
}
