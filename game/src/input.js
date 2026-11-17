// Keyboard + mouse input. Held keys steer; one-shot presses queue as bit flags taken once
// by the loop, so a press between frames is never lost or counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_RELOAD = 16;
export const ACTION_HORN = 32;
export const ACTION_MUTE = 64;
export const ACTION_CLICK = 128;

const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'jump',
  KeyE: 'enter', KeyF: 'punch', KeyR: 'reload',
  KeyC: 'crouch', KeyM: 'mute', KeyH: 'horn',
  KeyP: 'pause', Escape: 'pause',
};

export function createInput(canvas) {
  const held = {};
  let actions = 0;
  let mouseDown = false;
  let mouseDX = 0;
  let mouseDY = 0;
  let pointerLocked = false;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (!name) return;
    if (name === 'enter' && !event.repeat) actions |= ACTION_ENTER;
    else if (name === 'punch' && !event.repeat) actions |= ACTION_PUNCH;
    else if (name === 'reload' && !event.repeat) actions |= ACTION_RELOAD;
    else if (name === 'horn' && !event.repeat) actions |= ACTION_HORN;
    else if (name === 'mute' && !event.repeat) actions |= ACTION_MUTE;
    else if (name === 'pause' && !event.repeat) actions |= ACTION_PAUSE;
    held[name] = true;
    if (name !== 'mute') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  });
  window.addEventListener('blur', () => {
    for (const k of Object.keys(held)) held[k] = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    if (event.button === 0 && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  window.addEventListener('pointerup', () => { mouseDown = false; });
  document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (event) => {
    if (pointerLocked) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    }
  });
  canvas.addEventListener('click', () => {
    actions |= ACTION_CONFIRM | ACTION_CLICK;
  });

  return {
    held(name) { return !!held[name]; },
    get mouseDown() { return mouseDown; },
    takeMouseDelta() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
