import { C64 } from './palette.js';
import { makeCanvas, flipCanvas, disc } from './gfx.js';

// Colour sets for every soldier type. H = headgear, U = uniform, V = uniform shade,
// S = skin, B = boots, K = belt.
export const TYPES = {
  player:  { H: 5,  U: 13, V: 5,  S: 10, B: 0, K: 9, head: 'beret', carry: 'knife' },
  runner:  { H: 11, U: 12, V: 11, S: 10, B: 0, K: 0, head: 'helmet' },
  officer: { H: 2,  U: 1,  V: 15, S: 10, B: 0, K: 2, head: 'cap' },
  kicker:  { H: 0,  U: 1,  V: 15, S: 10, B: 10, K: 0, head: 'band' },
  rifle:   { H: 6,  U: 14, V: 6,  S: 10, B: 0, K: 0, head: 'helmet', carry: 'gun' },
  bazooka: { H: 11, U: 3,  V: 6,  S: 10, B: 0, K: 0, head: 'helmet', carry: 'bazooka' },
  mortar:  { H: 4,  U: 4,  V: 11, S: 10, B: 0, K: 0, head: 'helmet' },
  handler: { H: 9,  U: 8,  V: 9,  S: 10, B: 0, K: 0, head: 'cap' },
  flamer:  { H: 11, U: 7,  V: 8,  S: 10, B: 0, K: 0, head: 'helmet', carry: 'flame' },
  para:    { H: 5,  U: 15, V: 12, S: 10, B: 0, K: 0, head: 'helmet' },
  prisoner:{ H: 9,  U: 15, V: 12, S: 10, B: 9, K: 12, head: 'band' },
};

// Soldier sprites are 24x24 canvases. Body is drawn in a 16-wide local space
// offset by 4 so knives and guns can poke out. Feet touch the bottom row.
const POSES = {
  stand:      { legs: 'stand', arm: 'down', carry: true },
  run0:       { legs: 'runA', arm: 'swingF', carry: true },
  run1:       { legs: 'runB', arm: 'down', carry: true },
  run2:       { legs: 'runA', arm: 'swingB', carry: true },
  run3:       { legs: 'runC', arm: 'down', carry: true },
  stab:       { legs: 'runA', arm: 'stab' },
  crouch:     { legs: 'crouch', arm: 'down', dy: 7, carry: true },
  crouchStab: { legs: 'crouch', arm: 'stab', dy: 7 },
  jump:       { legs: 'jump', arm: 'swingF' },
  jumpStab:   { legs: 'jump', arm: 'stab' },
  climb0:     { legs: 'climbA', arm: 'up', back: true },
  climb1:     { legs: 'climbB', arm: 'upR', back: true },
  aim:        { legs: 'stand', arm: 'gun' },
  aimCrouch:  { legs: 'crouch', arm: 'gun', dy: 7 },
  kick:       { legs: 'kick', arm: 'chop' },
  stance0:    { legs: 'stance', arm: 'guard', dy: 2 },
  stance1:    { legs: 'stance', arm: 'guard', dy: 3 },
  throw:      { legs: 'stand', arm: 'throw' },
  hit:        { legs: 'stand', arm: 'hands' },
  bazooka:    { legs: 'stand', arm: 'bazooka' },
  flame:      { legs: 'stand', arm: 'flame' },
};

const LEGS = {
  stand(P, c) { P(5, 14, 3, 8, c.V); P(8, 14, 3, 8, c.U); P(5, 22, 3, 2, c.B); P(8, 22, 4, 2, c.B); },
  runA(P, c) {
    P(5, 14, 3, 3, c.V); P(4, 17, 2, 3, c.V); P(3, 20, 2, 2, c.V); P(1, 22, 4, 2, c.B);
    P(8, 14, 3, 3, c.U); P(10, 17, 2, 3, c.U); P(11, 20, 2, 2, c.U); P(11, 22, 4, 2, c.B);
  },
  runB(P, c) {
    P(7, 14, 3, 8, c.U); P(7, 22, 4, 2, c.B);
    P(5, 14, 2, 3, c.V); P(3, 17, 3, 2, c.V); P(2, 18, 2, 2, c.V); P(1, 20, 3, 2, c.B);
  },
  runC(P, c) {
    P(6, 14, 3, 8, c.V); P(6, 22, 4, 2, c.B);
    P(8, 14, 3, 3, c.U); P(10, 16, 2, 4, c.U); P(10, 20, 4, 2, c.B);
  },
  crouch(P, c) {
    P(4, 20, 3, 2, c.V); P(3, 22, 4, 2, c.B);
    P(6, 19, 6, 2, c.U); P(10, 21, 2, 1, c.U); P(10, 22, 4, 2, c.B);
  },
  stance(P, c) {
    P(4, 16, 3, 3, c.V); P(2, 19, 3, 3, c.V); P(1, 22, 4, 2, c.B);
    P(9, 16, 3, 3, c.U); P(11, 19, 3, 3, c.U); P(11, 22, 4, 2, c.B);
  },
  jump(P, c) { P(5, 14, 6, 3, c.U); P(7, 17, 5, 3, c.V); P(6, 20, 5, 2, c.B); },
  kick(P, c) { P(8, 13, 9, 3, c.U); P(17, 13, 3, 3, c.B); P(4, 14, 3, 4, c.V); P(2, 17, 3, 2, c.V); P(1, 19, 3, 2, c.B); },
  climbA(P, c) { P(5, 14, 3, 5, c.V); P(5, 19, 3, 2, c.B); P(8, 14, 3, 8, c.U); P(8, 22, 3, 2, c.B); },
  climbB(P, c) { P(5, 14, 3, 8, c.V); P(5, 22, 3, 2, c.B); P(8, 14, 3, 5, c.U); P(8, 19, 3, 2, c.B); },
};

const HEADS = {
  helmet(P, c, d) { P(6, 3 + d, 5, 3, c.S); P(9, 3 + d, 1, 1, 0); P(5, 0 + d, 6, 1, c.H); P(4, 1 + d, 8, 2, c.H); },
  beret(P, c, d) {
    P(6, 2 + d, 5, 4, c.S); P(9, 3 + d, 1, 1, 0); P(5, 3 + d, 1, 2, 9);
    P(4, 0 + d, 6, 1, c.H); P(4, 1 + d, 7, 1, c.H); P(5, 2 + d, 1, 1, c.H);
  },
  cap(P, c, d) { P(6, 2 + d, 5, 4, c.S); P(9, 3 + d, 1, 1, 0); P(5, 0 + d, 6, 2, c.H); P(10, 2 + d, 3, 1, 0); },
  band(P, c, d) {
    P(6, 3 + d, 5, 3, c.S); P(9, 3 + d, 1, 1, 0);
    P(6, 0 + d, 5, 2, c.H); P(5, 1 + d, 1, 3, c.H); P(5, 2 + d, 6, 1, 2); P(3, 2 + d, 2, 1, 2);
  },
  back(P, c, d) { P(6, 3 + d, 5, 3, 9); P(5, 0 + d, 7, 3, c.H); },
};

// Each arm returns the hand position (for drawing a carried knife), or null.
const ARMS = {
  down(P, c, d) { P(7, 8 + d, 2, 5, c.V); P(7, 13 + d, 2, 1, c.S); return [8, 13 + d]; },
  swingF(P, c, d) { P(8, 8 + d, 2, 3, c.V); P(10, 10 + d, 2, 2, c.V); P(12, 11 + d, 1, 2, c.S); return [12, 11 + d]; },
  swingB(P, c, d) { P(6, 8 + d, 2, 3, c.V); P(4, 10 + d, 2, 2, c.V); P(3, 11 + d, 2, 1, c.S); return [3, 11 + d]; },
  stab(P, c, d) { P(9, 8 + d, 4, 2, c.V); P(13, 8 + d, 2, 2, c.S); P(15, 8 + d, 4, 1, 1); P(15, 9 + d, 1, 1, 12); return null; },
  gun(P, c, d) { P(4, 9 + d, 3, 2, 9); P(7, 9 + d, 12, 1, 11); P(8, 10 + d, 4, 1, c.V); P(12, 10 + d, 1, 1, c.S); return null; },
  bazooka(P, c, d) { P(1, 6 + d, 18, 3, 11); P(1, 6 + d, 18, 1, 12); P(9, 9 + d, 3, 2, c.V); P(10, 11 + d, 2, 1, c.S); return null; },
  flame(P, c, d) { P(7, 10 + d, 10, 2, 9); P(17, 10 + d, 2, 2, 8); P(8, 9 + d, 3, 2, c.V); return null; },
  throw(P, c, d) { P(6, 4 + d, 2, 4, c.V); P(6, 3 + d, 2, 1, c.S); return null; },
  up(P, c, d) { P(4, 2 + d, 2, 6, c.V); P(4, 1 + d, 2, 1, c.S); P(10, 8 + d, 2, 5, c.V); return null; },
  upR(P, c, d) { P(10, 2 + d, 2, 6, c.V); P(10, 1 + d, 2, 1, c.S); P(4, 8 + d, 2, 5, c.V); return null; },
  guard(P, c, d) { P(9, 8 + d, 3, 2, c.V); P(12, 6 + d, 2, 3, c.S); P(6, 9 + d, 2, 3, c.V); P(8, 11 + d, 2, 2, c.S); return null; },
  chop(P, c, d) { P(4, 8 + d, 2, 2, c.V); P(1, 6 + d, 3, 2, c.V); P(0, 5 + d, 2, 1, c.S); P(10, 8 + d, 3, 2, c.V); P(13, 8 + d, 2, 1, c.S); return null; },
  hands(P, c, d) { P(4, 3 + d, 2, 5, c.V); P(10, 3 + d, 2, 5, c.V); P(4, 2 + d, 2, 1, c.S); P(10, 2 + d, 2, 1, c.S); return null; },
};

function bakeSoldier(cfg, pose) {
  const cv = makeCanvas(24, 24), x = cv.getContext('2d');
  const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px + 4, py, w, h); };
  if (pose === 'dead') {
    P(-3, 21, 3, 3, cfg.B); P(0, 21, 7, 3, cfg.V); P(7, 20, 7, 4, cfg.U);
    P(9, 19, 3, 1, cfg.V); P(14, 20, 4, 4, cfg.S); P(18, 20, 2, 4, cfg.H);
    return cv;
  }
  const def = POSES[pose];
  const dy = def.dy || 0;
  LEGS[def.legs](P, cfg);
  if (cfg.carry === 'flame') { P(2, 7 + dy, 3, 6, 11); P(2, 7 + dy, 3, 1, 12); }
  P(5, 7 + dy, 6, 6, cfg.U); P(5, 7 + dy, 1, 6, cfg.V); P(5, 13 + dy, 6, 1, cfg.K);
  P(7, 6 + dy, 3, 1, cfg.S);
  HEADS[def.back ? 'back' : cfg.head](P, cfg, dy);
  let arm = def.arm;
  if (def.carry && cfg.carry && cfg.carry !== 'knife') arm = cfg.carry;
  const hand = ARMS[arm](P, cfg, dy);
  if (cfg.carry === 'knife' && hand) { P(hand[0] + 1, hand[1], 3, 1, 1); }
  return cv;
}

function bakeDog(pose) {
  const cv = makeCanvas(24, 24), x = cv.getContext('2d');
  const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
  const body = 8, dark = 0;
  if (pose === 'dead') {
    P(3, 20, 15, 4, body); P(5, 20, 8, 1, dark); P(17, 19, 5, 4, body); P(20, 19, 1, 1, 0); P(0, 21, 3, 1, body);
    return cv;
  }
  if (pose === 'run0') {
    P(5, 14, 13, 4, body); P(6, 14, 9, 1, dark); P(17, 11, 5, 5, body); P(21, 13, 3, 2, body); P(23, 13, 1, 1, 0);
    P(17, 10, 2, 2, dark); P(2, 12, 3, 2, body); P(20, 12, 1, 1, 0); P(16, 14, 1, 3, 2);
    P(4, 17, 2, 3, body); P(2, 20, 2, 4, body); P(16, 17, 2, 3, body); P(18, 20, 2, 4, body);
  } else {
    P(5, 13, 13, 4, body); P(6, 13, 9, 1, dark); P(17, 10, 5, 5, body); P(21, 12, 3, 2, body); P(23, 12, 1, 1, 0);
    P(17, 9, 2, 2, dark); P(2, 11, 3, 2, body); P(20, 11, 1, 1, 0); P(16, 13, 1, 3, 2);
    P(7, 17, 2, 7, body); P(9, 18, 2, 6, body); P(13, 17, 2, 7, body); P(15, 18, 2, 6, body);
  }
  return cv;
}

const cache = new Map();
function pair(c) { return [c, flipCanvas(c)]; }

export function soldierSprite(type, pose, dir) {
  const k = type + '|' + pose;
  let s = cache.get(k);
  if (!s) { s = pair(bakeSoldier(TYPES[type], pose)); cache.set(k, s); }
  return dir < 0 ? s[1] : s[0];
}

export function dogSprite(pose, dir) {
  const k = 'dog|' + pose;
  let s = cache.get(k);
  if (!s) { s = pair(bakeDog(pose)); cache.set(k, s); }
  return dir < 0 ? s[1] : s[0];
}

export const misc = {};

export function initSprites() {
  // Army truck, facing left (cab on the left). 72x36.
  {
    const cv = makeCanvas(72, 36), x = cv.getContext('2d');
    const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
    P(22, 4, 48, 20, 5); P(22, 4, 48, 1, 13);
    for (let i = 30; i < 70; i += 10) P(i, 4, 1, 20, 13);
    P(68, 6, 2, 18, 9);
    P(4, 10, 18, 14, 12); P(4, 10, 18, 1, 15); P(6, 12, 9, 6, 14); P(6, 12, 9, 1, 1);
    P(0, 22, 6, 4, 11); P(1, 18, 3, 2, 7);
    P(4, 24, 66, 4, 11);
    for (const wx of [14, 50, 61]) { disc(x, wx, 29, 5, 0); disc(x, wx, 29, 2, 12); }
    misc.truck = cv;
    // Wrecked version
    const w = makeCanvas(72, 36), wx = w.getContext('2d');
    wx.drawImage(cv, 0, 0);
    wx.globalCompositeOperation = 'source-atop';
    wx.fillStyle = 'rgba(0,0,0,0.65)';
    wx.fillRect(0, 0, 72, 36);
    misc.wreck = w;
  }
  // Mines (two frames: light off / on). 8x5.
  misc.mine = [0, 1].map(on => {
    const cv = makeCanvas(8, 5), x = cv.getContext('2d');
    const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
    P(1, 2, 6, 3, 11); P(0, 4, 8, 1, 11); P(1, 2, 6, 1, 12); P(3, 1, 2, 1, on ? 2 : 9);
    if (on) P(3, 0, 2, 1, 10);
    return cv;
  });
  // Weapon pickups / HUD icons. 12x8.
  const icon = (fn) => { const cv = makeCanvas(12, 8), x = cv.getContext('2d'); fn((px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); }, x); return cv; };
  misc.pickups = {
    flame: icon(P => { P(0, 2, 4, 6, 2); P(1, 1, 2, 1, 12); P(0, 2, 1, 6, 10); P(4, 4, 6, 2, 11); P(10, 3, 2, 4, 8); }),
    bazooka: icon(P => { P(0, 2, 12, 3, 5); P(0, 2, 12, 1, 13); P(0, 1, 2, 5, 11); P(5, 5, 2, 3, 11); }),
    grenade: icon((P, x) => { disc(x, 5, 4, 3, 5); P(4, 2, 2, 1, 13); P(4, 0, 4, 1, 11); P(8, 0, 1, 3, 12); }),
  };
  // Parachute canopy. 24x16.
  {
    const cv = makeCanvas(24, 16), x = cv.getContext('2d');
    const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
    const rows = [[6, 12], [3, 18], [2, 20], [1, 22], [1, 22]];
    rows.forEach(([x0, w], i) => {
      for (let k = 0; k < w; k++) P(x0 + k, i, 1, 1, Math.floor((x0 + k) / 4) % 2 ? 1 : 2);
    });
    for (let k = 0; k < 11; k++) {
      P(1 + Math.floor(k * 0.7), 5 + k, 1, 1, 15);
      P(22 - Math.floor(k * 0.7), 5 + k, 1, 1, 15);
      P(11, 5 + k, 1, 1, 15);
    }
    misc.chute = cv;
  }
  // Helicopter, facing right: two rotor frames and a smoking wreck. 24x16.
  {
    const frame = (k) => {
      const cv = makeCanvas(24, 16), x = cv.getContext('2d');
      const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
      if (k < 2) P(k ? 1 : 5, 0, k ? 22 : 14, 1, 15);
      P(11, 1, 2, 3, 11);
      P(6, 4, 12, 7, 5); P(6, 4, 12, 1, 13); P(13, 5, 5, 4, 3); P(14, 5, 3, 1, 1);
      P(0, 6, 6, 2, 5); P(0, 4, 2, 4, 5); P(0, 3, 1, 2, k < 2 ? 15 : 11);
      P(8, 11, 1, 2, 11); P(15, 11, 1, 2, 11); P(5, 13, 14, 1, 11);
      if (k === 2) { x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(0, 0, 24, 16); }
      return pair(cv);
    };
    misc.heli = [frame(0), frame(1), frame(2)];
  }
  // Jet bomber, facing right. 32x10.
  {
    const cv = makeCanvas(32, 10), x = cv.getContext('2d');
    const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
    P(4, 4, 24, 3, 12); P(4, 4, 24, 1, 15); P(28, 5, 3, 1, 12); P(20, 4, 4, 1, 14);
    P(2, 0, 4, 4, 12); P(0, 4, 4, 2, 11); P(12, 6, 10, 2, 11); P(14, 8, 6, 1, 11);
    misc.jet = pair(cv);
  }
  // Life icon. 7x7.
  {
    const cv = makeCanvas(7, 7), x = cv.getContext('2d');
    const P = (px, py, w, h, ci) => { x.fillStyle = C64[ci]; x.fillRect(px, py, w, h); };
    P(1, 2, 5, 5, 10); P(0, 0, 6, 2, 5); P(0, 2, 1, 1, 5); P(4, 3, 1, 1, 0);
    misc.life = cv;
  }
}
