import { physics, surfaceCross, surfacesAt, hasSurface, overlap, findLadder, GROUND } from './collision.js';
import { soldierSprite, dogSprite, misc } from './sprites.js';
import { sfx } from './audio.js';
import { addScore, popup, dropPickup, enemyShoot, lobShell, enemyFlame, dropBomb, boom } from './weapons.js';
import { killPlayer, playerBox } from './player.js';

const DEF = {
  runner:  { spd: 1.0, score: 150 },
  officer: { spd: 1.25, score: 300 },
  kicker:  { spd: 1.15, score: 200 },
  rifle:   { spd: 0.9, score: 200 },
  bazooka: { spd: 0.85, score: 300 },
  mortar:  { spd: 0.8, score: 300 },
  handler: { spd: 0.9, score: 250 },
  dog:     { spd: 2.0, score: 150 },
  para:    { spd: 1.0, score: 250 },
  flamer:  { spd: 0.9, score: 400 },
  heli:    { spd: 1.1, score: 1000 },
};

const HELI_ALT = 76;

export function enemyBox(e) {
  if (e.type === 'heli') return { x0: e.x - 10, x1: e.x + 10, y0: e.y - 26, y1: e.y - 15 };
  if (e.type === 'kicker' && e.state === 'kick') {
    const f = e.dir * 10;
    return { x0: e.x - 4 + Math.min(0, f), x1: e.x + 4 + Math.max(0, f), y0: e.y - 20, y1: e.y - 4 };
  }
  if (e.type === 'dog') return { x0: e.x - 7, x1: e.x + 7, y0: e.y - 10, y1: e.y };
  if (e.type === 'rifle' && e.state === 'aim' && e.crouchShot) return { x0: e.x - 4, x1: e.x + 4, y0: e.y - 14, y1: e.y };
  return { x0: e.x - 4, x1: e.x + 4, y0: e.y - 22, y1: e.y };
}

export function aliveCount(g, waveOnly = false) {
  let n = 0;
  for (const e of g.enemies) if (!e.dead && (!waveOnly || e.wave)) n++;
  return n;
}

export function spawnEnemy(g, type, o = {}) {
  const L = g.level;
  const side = o.side ?? (Math.random() < 0.72 ? 1 : -1);
  let x = o.x ?? (side > 0 ? g.cam + 336 : g.cam - 16);
  let y = o.y;
  if (y === undefined) {
    const ys = surfacesAt(L, x);
    y = (Math.random() < 0.45 || ys.length === 1) ? GROUND : ys[Math.floor(Math.random() * ys.length)];
  }
  const d = DEF[type];
  const e = {
    type, x, y, vx: 0, vy: 0, dir: o.dir ?? (side > 0 ? -1 : 1), onGround: true, onLadder: null, tierY: y,
    state: 'walk', t: 0, anim: Math.floor(Math.random() * 24), spd: d.spd * g.speedMul * (0.9 + Math.random() * 0.2),
    dead: false, deadT: 0, shots: 0, wave: !!o.wave, lastLadder: null, standoff: 90 + Math.random() * 70,
    cd: 0, crouchShot: false, entered: false, released: 0, throwT: 0,
  };
  if (type === 'para') {
    e.state = 'chute'; e.onGround = false;
    e.x = o.x ?? g.cam + 60 + Math.random() * 220;
    e.y = o.y ?? 20;
  }
  if (type === 'heli') {
    e.flying = true; e.onGround = false; e.state = 'hover';
    e.y = HELI_ALT; e.alt = HELI_ALT; e.cd = 60;
  }
  g.enemies.push(e);
  return e;
}

export function killEnemy(g, e) {
  if (e.dead) return;
  e.dead = true; e.deadT = 0; e.onLadder = null; e.onGround = false; e.vy = -1.6; e.vx = 0;
  const pts = DEF[e.type].score;
  addScore(g, pts); popup(g, e.x, e.y - 28, pts);
  sfx.kill();
  if (e.type === 'officer') dropPickup(g, e.x, e.y, e.wave ? g.def.wavePickup : undefined);
  if (e.type === 'heli') { boom(g, e.x, e.y - 20, 12); sfx.explode(); g.shake = Math.max(g.shake, 8); }
}

function walker(e, g, c) {
  if ((c.same || e.wave || e.state === 'charge') && e.t % 20 === 0) e.dir = c.sd;
  e.vx = e.dir * e.spd;
  e.anim++;
  if (e.onGround && !c.same && !g.player.dead && e.type !== 'dog') {
    const up = g.player.tierY < e.y;
    const lad = findLadder(g.level, e.x, e.y, up ? -1 : 1, 1.5);
    if (lad && lad !== e.lastLadder) {
      e.lastLadder = lad;
      if (Math.random() < 0.65) { e.onLadder = lad; e.ladDir = up ? -1 : 1; e.x = lad.x; e.vx = 0; e.onGround = false; }
    }
  }
}

function climb(e, g, sd) {
  const l = e.onLadder;
  e.y += e.ladDir * 0.8 * g.speedMul;
  e.anim++;
  const done = e.ladDir < 0 ? e.y <= l.top : e.y >= l.bot;
  if (done) {
    e.y = e.ladDir < 0 ? l.top : l.bot;
    e.onLadder = null; e.onGround = true; e.tierY = e.y; e.dir = sd;
  }
}

function think(e, g, c) {
  switch (e.type) {
    case 'para':
      if (e.state === 'chute') {
        const ny = e.y + 0.6;
        const s = surfaceCross(g.level, e.x, e.y, ny);
        e.x += Math.sin(e.t * 0.05) * 0.3;
        e.vx = 0;
        if (s !== null) { e.y = s; e.onGround = true; e.state = 'walk'; e.dir = c.sd; e.tierY = s; }
        else e.y = ny;
        return;
      }
      walker(e, g, c); return;
    case 'kicker': {
      // Karate fighter: closes in, squares up in a stance, then throws a
      // flying kick. He can also leap straight up onto the level above.
      if (e.state === 'kick' || e.state === 'leap') return;
      if (e.state === 'stance') {
        e.vx = 0; e.dir = c.sd; e.anim++;
        if (!c.same) { e.state = 'walk'; return; }
        if (e.t > e.stanceT) {
          e.state = 'kick'; e.vy = -2.6; e.vx = e.dir * 2.4 * g.speedMul; e.onGround = false; e.cd = 70;
          sfx.jump();
        }
        return;
      }
      walker(e, g, c);
      if (!e.onGround || e.onLadder || e.cd > 0) return;
      const p = g.player;
      if (c.same && c.adx < 78 && c.sd === e.dir) {
        e.state = 'stance'; e.t = 0; e.stanceT = (10 + Math.random() * 18) / g.speedMul;
      } else if (!p.dead && c.adx < 48 && e.y - p.tierY > 40 && e.y - p.tierY < 56) {
        const vx = Math.max(-1.2, Math.min(1.2, c.dx / 30));
        if (hasSurface(g.level, e.x + vx * 30, p.tierY)) {
          e.state = 'leap'; e.vy = -4.6; e.vx = vx; e.dir = c.sd; e.onGround = false; e.cd = 60;
        }
      }
      return;
    }
    case 'rifle': case 'bazooka':
      if (e.state === 'walk') {
        walker(e, g, c);
        if (c.onScreen && c.same && c.adx < e.standoff) { e.state = 'aim'; e.t = 0; e.crouchShot = e.type === 'rifle' && Math.random() < 0.4; }
        return;
      }
      if (e.state === 'aim') {
        e.vx = 0; e.dir = c.sd;
        if (!c.same) { e.state = 'walk'; return; }
        if (e.t === 25 || (e.t > 25 && (e.t - 25) % 85 === 0)) {
          enemyShoot(g, e, e.type === 'rifle' ? 'bullet' : 'rocket');
          e.shots++;
          if (e.shots >= 3) e.state = 'charge';
        }
        if ((e.t - 25) % 85 === 50) e.crouchShot = e.type === 'rifle' && Math.random() < 0.4;
        return;
      }
      walker(e, g, c); return;
    case 'mortar':
      if (e.throwT > 0) e.throwT--;
      if (e.state === 'walk') {
        walker(e, g, c);
        if (c.onScreen && c.adx < e.standoff + 30 && c.adx > 50) { e.state = 'aim'; e.t = 0; }
        return;
      }
      if (e.state === 'aim') {
        e.vx = 0; e.dir = c.sd;
        if (e.t === 30 || (e.t > 30 && (e.t - 30) % 100 === 0)) { lobShell(g, e); e.shots++; if (e.shots >= 3) e.state = 'charge'; }
        return;
      }
      walker(e, g, c); return;
    case 'handler':
      if (e.state === 'walk' && c.onScreen && c.adx < 230) { e.state = 'release'; e.t = 0; }
      if (e.state === 'release') {
        e.vx = 0; e.dir = c.sd;
        if (e.t % 25 === 10 && e.released < 2) {
          spawnEnemy(g, 'dog', { x: e.x + e.dir * 6, y: e.y, dir: e.dir, wave: e.wave });
          e.released++; sfx.bark();
        }
        if (e.released >= 2 && e.t > 50) e.state = 'charge';
        return;
      }
      walker(e, g, c); return;
    case 'flamer':
      if (e.state === 'prep') {
        e.vx = 0; e.dir = c.sd;
        if (e.t === 16) enemyFlame(g, e);
        if (e.t > 56) { e.state = 'walk'; e.cd = 90; }
        return;
      }
      walker(e, g, c);
      if (c.same && c.adx < 62 && e.cd === 0 && c.sd === e.dir) { e.state = 'prep'; e.t = 0; }
      return;
    case 'heli':
      heli(e, g, c); return;
    default:
      walker(e, g, c);
  }
}

// Hovers high up and bombs the player, then now and again dives to the
// player's level and sweeps across the screen. Crouch under it or knife it.
function heli(e, g, c) {
  const p = g.player;
  e.anim++;
  if (e.state === 'hover') {
    const tx = p.x + Math.sin(e.t * 0.02) * 130;
    e.vx = Math.max(-e.spd, Math.min(e.spd, (tx - e.x) * 0.03));
    if (Math.abs(e.vx) > 0.2) e.dir = Math.sign(e.vx);
    if (e.cd === 0 && c.adx < 10 && !p.dead) { dropBomb(g, e.x, e.y - 14); e.cd = Math.round(70 / g.speedMul); }
    if (e.t > 220 && !p.dead && c.adx > 60 && e.x > g.cam + 20 && e.x < g.cam + 300) {
      e.state = 'sweep'; e.alt = p.tierY; e.t = 0; e.dir = c.sd;
    }
  } else {
    e.vx = e.dir * e.spd * (Math.abs(e.y - e.alt) < 2 ? 1.8 : 0.4);
    if ((e.dir > 0 && e.x > g.cam + 300) || (e.dir < 0 && e.x < g.cam + 20)) { e.state = 'hover'; e.alt = HELI_ALT; e.t = 0; }
  }
  e.y += Math.max(-1.2, Math.min(1.2, e.alt - e.y));
  e.x += e.vx;
  if (e.entered) e.x = Math.max(g.cam + 12, Math.min(g.cam + 308, e.x));
}

export function updateEnemies(g) {
  const L = g.level, p = g.player;
  const pb = p.dead ? null : playerBox(p);
  for (const e of g.enemies) {
    if (e.dead) {
      e.deadT++;
      physics(e, L, 0.2);
      if (e.deadT > 45) e.remove = true;
      continue;
    }
    e.t++;
    if (e.cd > 0) e.cd--;
    const dx = p.x - e.x, adx = Math.abs(dx), sd = dx < 0 ? -1 : 1;
    const same = !p.dead && e.onGround && Math.abs(p.tierY - e.y) < 2;
    const onScreen = e.x > g.cam + 20 && e.x < g.cam + 300;
    if (onScreen) e.entered = true;

    if (e.onLadder) climb(e, g, sd);
    else think(e, g, { dx, adx, sd, same, onScreen });

    if (!e.onLadder && e.state !== 'chute' && !e.flying) {
      e.x += e.vx;
      physics(e, L, 0.2);
      if (e.landed) { e.landed = false; if (e.state === 'kick' || e.state === 'leap') { e.state = 'walk'; e.t = 0; } }
      if (e.onGround) e.tierY = e.y;
    }
    if (e.wave && e.entered && !e.flying) {
      if (e.x < g.cam + 8 && e.dir < 0 && e.state !== 'kick') e.dir = 1;
      if (e.x > g.cam + 312 && e.dir > 0 && e.state !== 'kick') e.dir = -1;
    }
    if (!e.wave && ((e.x < g.cam - 50 && e.vx <= 0) || (e.x > g.cam + 370 && e.vx >= 0 && e.entered))) e.remove = true;
    if (e.y > 230) e.remove = true;
    if (pb && !p.dead && overlap(pb, enemyBox(e))) killPlayer(g, 'touch:' + e.type);
  }
  g.enemies = g.enemies.filter(e => !e.remove);
}

function poseOf(e) {
  if (e.type === 'dog') return e.dead ? 'dead' : (Math.floor(e.anim / 4) % 2 ? 'run1' : 'run0');
  if (e.dead) return e.deadT < 8 ? 'hit' : 'dead';
  if (e.onLadder) return Math.floor(e.anim / 8) % 2 ? 'climb1' : 'climb0';
  if (e.state === 'chute') return 'hit';
  if (e.state === 'kick') return 'kick';
  if (e.state === 'stance') return Math.floor(e.anim / 8) % 2 ? 'stance1' : 'stance0';
  if (!e.onGround) return 'jump';
  if (e.state === 'aim') {
    if (e.type === 'rifle') return e.crouchShot ? 'aimCrouch' : 'aim';
    if (e.type === 'bazooka') return 'bazooka';
    if (e.type === 'mortar') return e.throwT > 0 ? 'throw' : 'stand';
  }
  if (e.state === 'prep') return 'flame';
  if (e.state === 'release') return 'stand';
  if (Math.abs(e.vx) > 0.01) return 'run' + (Math.floor(e.anim / 6) % 4);
  return 'stand';
}

export function drawEnemies(ctx, g) {
  // dead bodies first so the living are drawn on top
  for (const pass of [true, false]) {
    for (const e of g.enemies) {
      if (e.dead !== pass) continue;
      if (e.dead && e.deadT > 20 && e.deadT % 4 < 2) continue;
      if (e.type === 'heli') {
        const spr = misc.heli[e.dead ? 2 : (e.anim >> 1) % 2];
        ctx.drawImage(e.dir < 0 ? spr[1] : spr[0], Math.round(e.x - g.cam - 12), Math.round(e.y - 30));
        continue;
      }
      const pose = poseOf(e);
      const spr = e.type === 'dog' ? dogSprite(pose, e.dir) : soldierSprite(e.type, pose, e.dir);
      const sx = Math.round(e.x - g.cam - 12), sy = Math.round(e.y - 24);
      if (e.state === 'chute' && !e.dead) ctx.drawImage(misc.chute, sx, sy - 14);
      ctx.drawImage(spr, sx, sy);
    }
  }
}
