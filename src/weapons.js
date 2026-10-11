import { physics, surfaceCross, overlap, GROUND } from './collision.js';
import { sfx } from './audio.js';
import { fill, disc, drawText } from './gfx.js';
import { misc } from './sprites.js';
import { killEnemy, enemyBox, spawnEnemy } from './enemies.js';
import { killPlayer, playerBox } from './player.js';

// ---------------- score / popups / fx ----------------
export function addScore(g, n) {
  g.score += n;
  while (g.score >= g.nextLife) {
    g.nextLife += 20000; g.lives++;
    sfx.extra(); popup(g, g.player.x, g.player.y - 36, '1UP', 7);
  }
  if (g.score > g.hi) g.hi = g.score;
}

export function popup(g, x, y, text, col = 1) { g.popups.push({ x, y, text: String(text), t: 0, col }); }
export function boom(g, x, y, r = 12) { g.fx.push({ kind: 'boom', x, y, r, t: 0 }); }
function smoke(g, x, y) { g.fx.push({ kind: 'smoke', x, y, t: 0 }); }

export function explodeAt(g, x, y, r, owner) {
  boom(g, x, y - 4, r * 0.7);
  sfx.explode();
  g.shake = Math.max(g.shake, 6);
  if (owner === 'player') {
    for (const e of g.enemies) if (!e.dead && Math.hypot(e.x - x, (e.y - 10) - (y - 6)) < r + 4) killEnemy(g, e);
    for (const m of g.mines) if (m.alive && Math.abs(m.x - x) < r && Math.abs(GROUND - y) < 8) destroyMine(g, m);
    for (const tr of g.trucks) if (tr.state !== 'wreck' && x > tr.x - r && x < tr.x + 72 + r && y > 140) wreckTruck(g, tr);
  } else if (owner === 'enemy') {
    const p = g.player;
    if (!p.dead && Math.hypot(p.x - x, (p.y - 10) - (y - 6)) < r + 2) killPlayer(g, 'blast');
  }
}

// ---------------- player weapons ----------------
export const AMMO = { flame: 3, bazooka: 3, grenade: 3 };

export function playerFire(g) {
  const p = g.player;
  const by = p.crouch ? p.y - 8 : p.y - 15;
  p.lastFired = p.weapon;
  if (p.weapon === 'flame') { g.pproj.push({ kind: 'flame', x: p.x + p.dir * 8, y: p.y, dir: p.dir, t: 0, len: 0, y0: 20, y1: 0 }); sfx.flame(); }
  else if (p.weapon === 'bazooka') { g.pproj.push({ kind: 'rocket', x: p.x + p.dir * 12, y: by, vx: p.dir * 4.5 }); sfx.rocket(); }
  else if (p.weapon === 'grenade') { g.pproj.push({ kind: 'grenade', x: p.x + p.dir * 4, y: p.y - 20, vx: p.dir * 2.4, vy: -3.2 }); sfx.jump(); }
  p.ammo--;
  if (p.ammo <= 0) { p.weapon = null; p.ammo = 0; }
}

// ---------------- enemy weapons ----------------
export function enemyShoot(g, e, kind) {
  if (kind === 'bullet') {
    g.eproj.push({ kind: 'bullet', x: e.x + e.dir * 12, y: e.y - (e.crouchShot ? 8 : 16), vx: e.dir * 2.2 * g.speedMul });
    sfx.shot();
  } else {
    g.eproj.push({ kind: 'rocket', x: e.x + e.dir * 14, y: e.y - 15, vx: e.dir * 2.8 * g.speedMul });
    sfx.rocket();
  }
}

export function lobShell(g, e) {
  const dx = g.player.x - e.x, T = 56;
  const vx = Math.max(-3, Math.min(3, dx / T));
  g.eproj.push({ kind: 'shell', x: e.x + e.dir * 4, y: e.y - 22, vx, vy: -3.36 });
  e.throwT = 12;
  sfx.thump();
}

// Straight-down bomb from a helicopter or the jet; reuses the mortar shell.
export function dropBomb(g, x, y) {
  g.eproj.push({ kind: 'shell', x, y, vx: 0, vy: 0.5 });
  sfx.thump();
}

export function enemyFlame(g, e) {
  g.eproj.push({ kind: 'flame', x: e.x + e.dir * 10, y: e.y, dir: e.dir, t: 0, len: 0, owner: e, y0: 15, y1: 3 });
  sfx.flame();
}

function flameBox(b) {
  const a = b.x, z = b.x + b.dir * b.len;
  return { x0: Math.min(a, z), x1: Math.max(a, z), y0: b.y - b.y0, y1: b.y - b.y1 };
}

const offscreen = (g, b) => b.x < g.cam - 30 || b.x > g.cam + 350;

export function updateProjectiles(g) {
  const L = g.level, p = g.player;
  const pb = p.dead ? null : playerBox(p);
  for (const b of g.pproj) {
    if (b.kind === 'flame') {
      b.t++; b.len = Math.min(52, b.t * 5);
      const box = flameBox(b);
      for (const e of g.enemies) if (!e.dead && overlap(box, enemyBox(e))) killEnemy(g, e);
      for (const m of g.mines) if (m.alive && overlap(box, mineBox(m))) destroyMine(g, m);
      if (b.t > 26) b.remove = true;
    } else if (b.kind === 'rocket') {
      b.x += b.vx;
      if (g.t % 2 === 0) smoke(g, b.x - Math.sign(b.vx) * 5, b.y);
      const box = { x0: b.x - 4, x1: b.x + 4, y0: b.y - 2, y1: b.y + 2 };
      // rockets get a taller box against aircraft so you can hit them from the platform below
      const air = { x0: b.x - 4, x1: b.x + 4, y0: b.y - 16, y1: b.y + 16 };
      for (const e of g.enemies) if (!e.dead && overlap(e.flying ? air : box, enemyBox(e))) killEnemy(g, e);
      for (const tr of g.trucks) if (tr.state !== 'wreck' && b.x > tr.x && b.x < tr.x + 72 && b.y > 150) { wreckTruck(g, tr); b.remove = true; }
      if (offscreen(g, b)) b.remove = true;
    } else if (b.kind === 'grenade') {
      b.vy += 0.18; b.x += b.vx;
      const ny = b.y + b.vy;
      const s = b.vy > 0 ? surfaceCross(L, b.x, b.y, ny) : null;
      const hit = g.enemies.find(e => !e.dead && e.flying && overlap({ x0: b.x - 2, x1: b.x + 2, y0: b.y - 2, y1: b.y + 2 }, enemyBox(e)));
      if (hit) { killEnemy(g, hit); explodeAt(g, b.x, b.y + 6, 26, 'player'); b.remove = true; }
      else if (s !== null) { explodeAt(g, b.x, s, 26, 'player'); b.remove = true; }
      else b.y = ny;
      if (b.y > 210 || offscreen(g, b)) b.remove = true;
    }
  }
  for (const b of g.eproj) {
    if (b.kind === 'bullet' || b.kind === 'rocket') {
      b.x += b.vx;
      if (b.kind === 'rocket' && g.t % 2 === 0) smoke(g, b.x - Math.sign(b.vx) * 5, b.y);
      const w = b.kind === 'rocket' ? 4 : 1;
      if (pb && overlap(pb, { x0: b.x - w, x1: b.x + w, y0: b.y - 1, y1: b.y + 1 })) {
        killPlayer(g, b.kind); b.remove = true;
        if (b.kind === 'rocket') explodeAt(g, b.x, b.y + 6, 10, 'none');
      }
      if (offscreen(g, b)) b.remove = true;
    } else if (b.kind === 'shell') {
      b.vy += 0.12; b.x += b.vx;
      const ny = b.y + b.vy;
      if (pb && overlap(pb, { x0: b.x - 2, x1: b.x + 2, y0: b.y - 2, y1: b.y + 2 })) { explodeAt(g, b.x, b.y + 6, 18, 'enemy'); b.remove = true; continue; }
      const s = b.vy > 0 ? surfaceCross(L, b.x, b.y, ny) : null;
      if (s !== null) { explodeAt(g, b.x, s, 18, 'enemy'); b.remove = true; }
      else b.y = ny;
      if (b.y > 210) b.remove = true;
    } else if (b.kind === 'flame') {
      if (b.owner.dead) { b.remove = true; continue; }
      b.t++; b.len = Math.min(46, b.t * 3);
      if (b.t > 40) b.remove = true;
      if (pb && overlap(pb, flameBox(b))) killPlayer(g, 'flame');
    }
  }
  g.pproj = g.pproj.filter(b => !b.remove);
  g.eproj = g.eproj.filter(b => !b.remove);
}

function drawFlame(ctx, g, b, cy) {
  for (let i = 0; i <= b.len; i += 5) {
    const r = 2 + Math.floor((i / 52) * 5) + ((g.t + i) % 3 === 0 ? 1 : 0);
    const col = [7, 8, 2, 1][(Math.floor(g.t / 2) + i / 5) % 4];
    disc(ctx, b.x + b.dir * i - g.cam, b.y - cy + Math.sin((g.t + i) * 0.7) * 1.5, r, col);
  }
}

export function drawProjectiles(ctx, g) {
  const c = g.cam;
  for (const b of g.pproj.concat(g.eproj)) {
    if (b.kind === 'bullet') { fill(ctx, b.x - c - 1, b.y, 3, 1, 7); fill(ctx, b.x - c, b.y, 1, 1, 1); }
    else if (b.kind === 'rocket') {
      const d = Math.sign(b.vx);
      fill(ctx, b.x - c - 3, b.y - 1, 7, 2, 12); fill(ctx, b.x - c + d * 3, b.y - 1, 1, 2, 2);
      fill(ctx, b.x - c - d * 5, b.y - 1, 2, 2, g.t % 2 ? 7 : 8);
    } else if (b.kind === 'grenade') { fill(ctx, b.x - c - 1, b.y - 1, 3, 3, 5); fill(ctx, b.x - c - 1, b.y - 1, 1, 1, 13); }
    else if (b.kind === 'shell') { fill(ctx, b.x - c - 1, b.y - 1, 3, 3, 0); fill(ctx, b.x - c, b.y - 1, 1, 1, 12); }
    else if (b.kind === 'flame') drawFlame(ctx, g, b, b.owner ? 9 : 11);
  }
}

// ---------------- pickups ----------------
export function dropPickup(g, x, y, type) {
  const list = g.def.pickup;
  type = type || list[g.pickupIdx++ % list.length];
  g.pickups.push({ type, x, y: y - 6, vx: 0, vy: -2, onGround: false, onLadder: null, t: 0 });
}

const PICKUP_NAMES = { flame: 'FLAMER', bazooka: 'BAZOOKA', grenade: 'GRENADES' };

export function updatePickups(g) {
  const p = g.player, pb = p.dead ? null : playerBox(p);
  for (const k of g.pickups) {
    k.t++;
    physics(k, g.level, 0.2);
    if (k.t > 520) k.remove = true;
    if (pb && overlap(pb, { x0: k.x - 6, x1: k.x + 6, y0: k.y - 8, y1: k.y })) {
      p.weapon = k.type; p.ammo = AMMO[k.type];
      k.remove = true; sfx.pickup();
      popup(g, k.x, k.y - 30, PICKUP_NAMES[k.type], 7);
    }
  }
  g.pickups = g.pickups.filter(k => !k.remove);
}

export function drawPickups(ctx, g) {
  for (const k of g.pickups) {
    if (k.t > 400 && k.t % 8 < 4) continue;
    const x = Math.round(k.x - g.cam - 6), y = Math.round(k.y - 9);
    fill(ctx, x - 1, y - 1, 14, 10, g.t % 16 < 8 ? 1 : 7);
    fill(ctx, x, y, 12, 8, 0);
    ctx.drawImage(misc.pickups[k.type], x, y);
  }
}

// ---------------- mines ----------------
export function mineBox(m) { return { x0: m.x - 4, x1: m.x + 4, y0: GROUND - 4, y1: GROUND + 1 }; }

export function destroyMine(g, m) {
  m.alive = false;
  boom(g, m.x, GROUND - 4, 7); sfx.explode();
  addScore(g, 100); popup(g, m.x, GROUND - 20, 100);
}

export function updateMines(g) {
  const p = g.player;
  if (p.dead || !p.onGround || p.y !== GROUND) return;
  for (const m of g.mines) {
    if (m.alive && Math.abs(p.x - m.x) < 5) {
      m.alive = false;
      explodeAt(g, m.x, GROUND, 10, 'none');
      killPlayer(g, 'mine');
    }
  }
}

export function drawMines(ctx, g) {
  for (const m of g.mines) {
    if (!m.alive || m.x < g.cam - 10 || m.x > g.cam + 330) continue;
    ctx.drawImage(misc.mine[(g.t >> 4) % 2], Math.round(m.x - g.cam - 4), GROUND - 4);
  }
}

// ---------------- trucks ----------------
export function spawnTruck(g, boss = false) {
  g.trucks.push({ x: g.cam + 340, state: 'in', t: 0, n: 3 + Math.floor(Math.random() * 2 + g.loop), boss });
}

// The stage-end troop truck: parked on the right, the wave pours out of it.
export function bossTruck(g) {
  return g.trucks.find(t => t.boss && t.state === 'park');
}

function wreckTruck(g, tr) {
  tr.state = 'wreck'; tr.t = 0;
  for (let i = 0; i < 4; i++) boom(g, tr.x + 10 + i * 18, 170 - (i % 2) * 8, 10 + (i % 2) * 4);
  sfx.explode(); g.shake = 10;
  addScore(g, 1000); popup(g, tr.x + 36, 140, 1000, 7);
}

export function updateTrucks(g) {
  for (const tr of g.trucks) {
    tr.t++;
    if (tr.state === 'in') {
      tr.x -= 1.4;
      if (tr.x <= g.cam + 214) { tr.state = tr.boss ? 'park' : 'unload'; tr.t = 0; }
    } else if (tr.state === 'unload') {
      if (tr.t % 40 === 20 && tr.n > 0) {
        const crew = g.def.truckCrew;
        spawnEnemy(g, crew[Math.floor(Math.random() * crew.length)], { x: tr.x + 72, y: GROUND, dir: -1, side: 1 });
        tr.n--;
      }
      if (tr.n === 0 && tr.t > 60) tr.state = 'out';
    } else if (tr.state === 'out') {
      tr.x += 1.2;
      if (tr.x > g.cam + 400) tr.remove = true;
    } else if (tr.state === 'wreck') {
      if (tr.t % 12 === 0 && tr.t < 120) smoke(g, tr.x + 20 + Math.random() * 40, 156);
      if (tr.x + 80 < g.cam) tr.remove = true;
    }
  }
  g.trucks = g.trucks.filter(t => !t.remove);
}

export function drawTrucks(ctx, g) {
  for (const tr of g.trucks) {
    const bob = tr.state === 'in' || tr.state === 'out' ? (g.t >> 2) % 2 : 0;
    ctx.drawImage(tr.state === 'wreck' ? misc.wreck : misc.truck, Math.round(tr.x - g.cam), GROUND - 34 - bob);
  }
}

// ---------------- jet bomber ----------------
// Like the original: hang around in one place too long and a jet comes over
// and drops a bomb on you.
export function spawnJet(g) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  g.jets.push({ x: dir > 0 ? g.cam - 40 : g.cam + 360, dir, bombed: false });
  sfx.jet();
}

export function updateJets(g) {
  const p = g.player;
  for (const j of g.jets) {
    j.x += j.dir * 4;
    if (!j.bombed && !p.dead && (j.dir > 0 ? j.x >= p.x : j.x <= p.x)) { j.bombed = true; dropBomb(g, p.x, 34); }
    if (j.x < g.cam - 60 || j.x > g.cam + 380) j.remove = true;
  }
  g.jets = g.jets.filter(j => !j.remove);
}

export function drawJets(ctx, g) {
  for (const j of g.jets) ctx.drawImage(j.dir < 0 ? misc.jet[1] : misc.jet[0], Math.round(j.x - g.cam - 16), 24);
}

// ---------------- fx & popups ----------------
export function updateFx(g) {
  for (const f of g.fx) {
    f.t++;
    if (f.kind === 'boom' && f.t > 20) f.remove = true;
    if (f.kind === 'smoke') { f.y -= 0.3; if (f.t > 16) f.remove = true; }
  }
  g.fx = g.fx.filter(f => !f.remove);
  for (const pp of g.popups) { pp.t++; pp.y -= 0.4; if (pp.t > 50) pp.remove = true; }
  g.popups = g.popups.filter(pp => !pp.remove);
}

export function drawFx(ctx, g) {
  const c = g.cam;
  for (const f of g.fx) {
    if (f.kind === 'boom') {
      const r = f.r * Math.min(1, (f.t + 2) / 6);
      const col = f.t < 4 ? 1 : f.t < 8 ? 7 : f.t < 13 ? 8 : 2;
      if (f.t > 14) { disc(ctx, f.x - c, f.y - (f.t - 14), r * 0.8, 11); continue; }
      disc(ctx, f.x - c, f.y, r, col);
      disc(ctx, f.x - c, f.y, r * 0.5, f.t < 8 ? 1 : 7);
    } else if (f.kind === 'smoke') {
      disc(ctx, f.x - c, f.y, 1 + (f.t >> 3), f.t < 6 ? 15 : f.t < 11 ? 12 : 11);
    }
  }
  for (const pp of g.popups) drawText(ctx, pp.text, pp.x - c, pp.y, pp.col, { align: 'center', shadow: 0 });
}
