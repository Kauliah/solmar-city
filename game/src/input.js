// Keyboard + mouse input. Held keys steer; one-shot presses (enter car, shoot,
// reload, punch, pause, confirm) queue as bit flags taken once by the loop, so a
// press between two frames is never lost and never counted twice. Mouse drag
// orbits the camera; click fires the current weapon.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_CROUCH = 32;
export const ACTION_MUTE = 64;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const JUMP = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const RELOAD = new Set(['KeyR']);
const CROUCH = new Set(['KeyC']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let lookDX = 0;
  let lookDY = 0;
  let firing = false;
  let firingEdge = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function keyDown(event) {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) ||
        RIGHT.has(event.code) || SPRINT.has(event.code) || JUMP.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(event.code)) actions |= ACTION_ENTER;
    else if (PUNCH.has(event.code)) actions |= ACTION_PUNCH;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (CROUCH.has(event.code)) actions |= ACTION_CROUCH;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  }
  function keyUp(event) {
    held.delete(event.code);
  }
  function blur() {
    held.clear();
    firing = false;
    dragging = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', blur);

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    firing = true;
    firingEdge = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    lookDX += event.clientX - lastX;
    lookDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointerup', () => {
    dragging = false;
    firing = false;
  });

  function anyHeld(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** -1..1 throttle (W/S), -1..1 steering (A/D). */
    drive() {
      return {
        throttle: (anyHeld(FORWARD) ? 1 : 0) - (anyHeld(BACK) ? 1 : 0),
        steer: (anyHeld(RIGHT) ? 1 : 0) - (anyHeld(LEFT) ? 1 : 0),
        brake: anyHeld(JUMP),
        boost: anyHeld(SPRINT),
      };
    },
    /** -1..1 strafe-forward pair for on-foot movement, camera-relative. */
    walk() {
      return {
        forward: (anyHeld(FORWARD) ? 1 : 0) - (anyHeld(BACK) ? 1 : 0),
        strafe: (anyHeld(RIGHT) ? 1 : 0) - (anyHeld(LEFT) ? 1 : 0),
        sprint: anyHeld(SPRINT),
        jump: anyHeld(JUMP),
        crouch: held.has('KeyC'),
      };
    },
    get firing() { return firing; },
    /** True once per click — semi-auto weapons fire on the edge, not the hold. */
    takeFiringEdge() {
      const e = firingEdge;
      firingEdge = false;
      return e;
    },
    /** Mouse-drag orbit deltas since the last call, in pixels. */
    takeLook() {
      const dx = lookDX;
      const dy = lookDY;
      lookDX = 0;
      lookDY = 0;
      return { dx, dy };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Test helper: pretend a key is held / pressed. */
    testHold(code, on) { if (on) held.add(code); else held.delete(code); },
    testAction(flag) { actions |= flag; },
  };
}
