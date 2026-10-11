const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  KeyZ: 'fire', Space: 'fire', KeyJ: 'fire',
  KeyX: 'special', KeyK: 'special',
  Enter: 'start',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
};
const ACTIONS = ['left', 'right', 'up', 'down', 'fire', 'special', 'start', 'pause', 'mute'];

const held = new Set();
const queued = new Set();
const rawQueued = [];
let gpPrev = {};
const listeners = [];

export const input = {};
for (const a of ACTIONS) { input[a] = false; input[a + 'P'] = false; }

export function onAnyKey(fn) { listeners.push(fn); }

window.addEventListener('keydown', e => {
  listeners.forEach(fn => fn());
  const a = KEYMAP[e.code];
  if (a) {
    e.preventDefault();
    if (!held.has(a)) queued.add(a);
    held.add(a);
  }
  if (!e.repeat) rawQueued.push(e.code);
});
window.addEventListener('keyup', e => {
  const a = KEYMAP[e.code];
  if (a) held.delete(a);
});
window.addEventListener('blur', () => held.clear());

function readGamepad() {
  const out = {};
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && pads[0];
  if (!gp) return out;
  const b = i => gp.buttons[i] && gp.buttons[i].pressed;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  out.left = ax < -0.5 || b(14);
  out.right = ax > 0.5 || b(15);
  out.up = ay < -0.5 || b(12);
  out.down = ay > 0.5 || b(13);
  out.fire = b(0) || b(2);
  out.special = b(1) || b(3);
  out.start = b(9);
  out.pause = b(8);
  if (out.left || out.right || out.up || out.down || out.fire || out.start) listeners.forEach(fn => fn());
  return out;
}

// Called once per game tick.
export function pollInput() {
  const gp = readGamepad();
  for (const a of ACTIONS) {
    input[a] = held.has(a) || !!gp[a];
    input[a + 'P'] = queued.has(a) || (!!gp[a] && !gpPrev[a]);
  }
  queued.clear();
  gpPrev = gp;
}

export function takeRawKeys() {
  return rawQueued.splice(0, rawQueued.length);
}
