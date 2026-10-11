import { physics, findLadder, overlap, GROUND } from './collision.js';
import { sfx, music } from './audio.js';
import { soldierSprite } from './sprites.js';
import { killEnemy, enemyBox } from './enemies.js';
import { playerFire, destroyMine, mineBox } from './weapons.js';

const SPEED = 1.25, JUMP_V = -3.4, GRAV = 0.2;

export function createPlayer(x) {
  return {
    x, y: GROUND, vx: 0, vy: 0, dir: 1, onGround: true, onLadder: null, tierY: GROUND,
    crouch: false, stabT: 0, stabCd: 0, fireCd: 0, anim: 0, moving: false,
    dead: false, deadT: 0, inv: 0, weapon: null, ammo: 0,
  };
}

export function playerBox(p) {
  if (p.crouch) return { x0: p.x - 4, x1: p.x + 4, y0: p.y - 14, y1: p.y };
  if (!p.onGround && !p.onLadder) return { x0: p.x - 4, x1: p.x + 4, y0: p.y - 20, y1: p.y - 3 };
  return { x0: p.x - 4, x1: p.x + 4, y0: p.y - 22, y1: p.y };
}

export function knifeBox(p) {
  let y0 = p.y - 20, y1 = p.y - 10;
  if (p.crouch) { y0 = p.y - 12; y1 = p.y - 1; }
  else if (!p.onGround) { y0 = p.y - 20; y1 = p.y - 6; }
  return p.dir > 0 ? { x0: p.x + 2, x1: p.x + 19, y0, y1 } : { x0: p.x - 19, x1: p.x - 2, y0, y1 };
}

export function killPlayer(g, cause = "?") {
  const p = g.player;
  if (p.dead || p.inv > 0 || g.invincible) return;
  g.deathCause = cause; p.dead = true; p.deadT = 0; p.onLadder = null; p.onGround = false; p.vy = -2; p.vx = 0; p.crouch = false;
  sfx.die(); music.stop();
  g.shake = 6; g.flash = 6;
}

function enterLadder(p, lad, d) {
  p.onLadder = lad; p.x = lad.x; p.y += d; p.vx = 0; p.vy = 0; p.onGround = false; p.stabT = 0; p.crouch = false;
}
function leaveLadder(p) { p.onLadder = null; p.onGround = true; p.tierY = p.y; }

export function updatePlayer(g, inp) {
  const p = g.player, L = g.level;
  if (p.dead) { p.deadT++; physics(p, L, GRAV); return; }
  if (p.inv > 0) p.inv--;
  if (p.stabT > 0) p.stabT--;
  if (p.stabCd > 0) p.stabCd--;
  if (p.fireCd > 0) p.fireCd--;
  p.moving = false;
  const h = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);

  if (p.onLadder) {
    const lad = p.onLadder;
    if (inp.up) { p.y -= 1; p.anim++; } else if (inp.down) { p.y += 1; p.anim++; }
    if (p.y <= lad.top) { p.y = lad.top; leaveLadder(p); }
    else if (p.y >= lad.bot) { p.y = lad.bot; leaveLadder(p); }
    return;
  }

  p.crouch = false;
  if (p.onGround) {
    if (inp.up) { const lad = findLadder(L, p.x, p.y, -1); if (lad) { enterLadder(p, lad, -1); return; } }
    if (inp.down) { const lad = findLadder(L, p.x, p.y, 1); if (lad) { enterLadder(p, lad, 1); return; } p.crouch = true; }
    if (inp.upP && !p.crouch) {
      p.onGround = false; p.vy = JUMP_V; p.vx = h * SPEED * 1.1; if (h) p.dir = h; sfx.jump();
    } else if (p.crouch || p.stabT > 0) {
      p.vx = 0; if (h) p.dir = h;
    } else {
      p.vx = h * SPEED;
      if (h) { p.dir = h; p.moving = true; p.anim++; }
    }
  } else if (h) p.dir = h;

  if (inp.fireP && p.stabCd === 0) { p.stabT = 12; p.stabCd = 15; sfx.stab(); }
  if (inp.specialP && p.weapon && p.fireCd === 0) { playerFire(g); p.fireCd = 28; }

  p.x += p.vx;
  const minX = g.cam + 6, maxX = Math.min(g.cam + 314, L.len - 8);
  if (p.x < minX) p.x = minX;
  if (p.x > maxX) p.x = maxX;
  physics(p, L, GRAV);
  if (p.landed) { p.landed = false; p.vx = 0; }
  if (p.onGround) p.tierY = p.y;

  if (p.stabT >= 4 && p.stabT <= 10) {
    const kb = knifeBox(p);
    for (const e of g.enemies) if (!e.dead && overlap(kb, enemyBox(e))) killEnemy(g, e);
    for (const m of g.mines) if (m.alive && overlap(kb, mineBox(m))) destroyMine(g, m);
  }
}

function poseOf(p) {
  if (p.dead) return p.deadT < 10 ? 'hit' : 'dead';
  if (p.onLadder) return Math.floor(p.anim / 8) % 2 ? 'climb1' : 'climb0';
  if (p.fireCd > 18) return p.lastFired === 'grenade' ? 'throw' : p.lastFired === 'bazooka' ? 'bazooka' : 'flame';
  if (!p.onGround) return p.stabT > 0 ? 'jumpStab' : 'jump';
  if (p.crouch) return p.stabT > 0 ? 'crouchStab' : 'crouch';
  if (p.stabT > 0) return 'stab';
  if (p.moving) return 'run' + (Math.floor(p.anim / 6) % 4);
  return 'stand';
}

export function drawPlayer(ctx, g) {
  const p = g.player;
  if (p.inv > 0 && p.inv % 6 < 3) return;
  const spr = soldierSprite('player', poseOf(p), p.dir);
  ctx.drawImage(spr, Math.round(p.x - g.cam - 12), Math.round(p.y - 24));
}
