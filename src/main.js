import { W, H, fill, drawText } from './gfx.js';
import { C64 } from './palette.js';
import { input, pollInput, takeRawKeys, onAnyKey } from './input.js';
import { initAudio, music, sfx, SONG } from './audio.js';
import { initSprites, soldierSprite, dogSprite } from './sprites.js';
import { STAGES, buildLevel } from './levels.js';
import { renderBackground } from './tiles.js';
import { GROUND } from './collision.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { spawnEnemy, updateEnemies, drawEnemies, aliveCount } from './enemies.js';
import {
  addScore, updateProjectiles, drawProjectiles, updatePickups, drawPickups, updateMines, drawMines,
  spawnTruck, bossTruck, updateTrucks, drawTrucks, spawnJet, updateJets, drawJets, updateFx, drawFx,
} from './weapons.js';
import { drawHud, loadHi, saveHi, pad } from './hud.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const borderEl = document.getElementById('border');

initSprites();
onAnyKey(initAudio);

const DEBUG = new URLSearchParams(location.search).has('debug');
const bgCache = new Map();

const g = {
  state: 'title', stateT: 0, t: 0, paused: false,
  score: 0, hi: loadHi(), lives: 3, nextLife: 20000, loop: 0,
  stageIdx: 0, def: STAGES[0], level: null, bg: null,
  cam: 0, camMax: 0, locked: false,
  player: createPlayer(40), enemies: [], pproj: [], eproj: [], fx: [], popups: [], pickups: [], mines: [], trucks: [], jets: [],
  idleT: 0, spawnT: 0, eventIdx: 0, pickupIdx: 0, speedMul: 1, maxAlive: 5,
  wave: { active: false, done: false, queue: [], spawnT: 0, side: 1 },
  banner: 0, shake: 0, flash: 0, invincible: false,
  stars: Array.from({ length: 60 }, () => ({ x: Math.random() * 320, y: 16 + Math.random() * 180, z: 0.2 + Math.random() * 1.2, c: [1, 15, 12, 11][Math.floor(Math.random() * 4)] })),
};
if (DEBUG) {
  // Console helpers: __game state, __step(n) advances n ticks and renders.
  window.__game = g;
  window.__step = (n = 1) => { for (let i = 0; i < n; i++) update(); render(); return g.state; };
}

// ---------------- flow ----------------
function newGame() {
  g.score = 0; g.lives = 3; g.nextLife = 20000; g.loop = 0;
  sfx.select();
  startStage(0);
}

function startStage(i) {
  g.stageIdx = i;
  g.def = STAGES[i];
  g.level = buildLevel(g.def);
  if (!bgCache.has(i)) bgCache.set(i, renderBackground(g.def, g.level));
  g.bg = bgCache.get(i);
  g.cam = 0; g.camMax = g.def.len - W; g.locked = false;
  g.player = createPlayer(40);
  g.enemies = []; g.pproj = []; g.eproj = []; g.fx = []; g.popups = []; g.pickups = []; g.trucks = []; g.jets = [];
  g.idleT = 0;
  g.mines = g.def.mines.map(x => ({ x, alive: true }));
  g.spawnT = 120; g.eventIdx = 0; g.pickupIdx = 0;
  g.speedMul = 1 + g.loop * 0.15;
  g.maxAlive = Math.min(8, 5 + g.loop);
  g.wave = { active: false, done: false, queue: [], spawnT: 0, side: 1 };
  g.banner = 0; g.shake = 0;
  g.state = 'intro'; g.stateT = 0;
  music.play(SONG.JINGLE);
}

function beginPlay() {
  g.state = 'play'; g.stateT = 0;
  music.play(g.def.music);
}

function respawn() {
  for (const e of g.enemies) if (e.wave && !e.dead && e.type !== 'dog') g.wave.queue.unshift(e.type);
  const parked = bossTruck(g);
  g.enemies = []; g.eproj = []; g.pproj = []; g.trucks = parked ? [parked] : []; g.pickups = []; g.jets = [];
  g.idleT = 0;
  let x = g.cam + 40;
  while (g.mines.some(m => m.alive && Math.abs(m.x - x) < 12)) x += 12;
  g.player = createPlayer(x);
  g.player.inv = 150;
  g.spawnT = 100;
  music.play(g.def.music);
}

function gameOver() {
  saveHi(g.hi);
  g.state = 'gameover'; g.stateT = 0;
  music.play(SONG.GAMEOVER);
}

function stageClear() {
  g.state = 'clear'; g.stateT = 0;
  g.enemies = g.enemies.filter(e => e.dead);
  g.eproj = [];
  music.play(SONG.JINGLE);
}

function nextStage() {
  if (g.stageIdx === STAGES.length - 1) {
    g.state = 'ending'; g.stateT = 0;
    saveHi(g.hi);
    music.play(SONG.ENDING);
  } else startStage(g.stageIdx + 1);
}

// ---------------- spawning ----------------
function pickWeighted(w) {
  const entries = Object.entries(w);
  let r = Math.random() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of entries) { if ((r -= v) < 0) return k; }
  return entries[0][0];
}

function spawnInterval() {
  const progress = g.cam / g.camMax;
  return g.def.spawn / ((1 + g.loop * 0.3) * (1 + 0.5 * progress)) * (0.7 + Math.random() * 0.6);
}

function triggerEvent(type) {
  if (type === 'truck') spawnTruck(g);
  else if (type === 'para') for (let i = 0; i < 3; i++) spawnEnemy(g, 'para', { x: g.cam + 90 + i * 80 + Math.random() * 30, y: 10 - i * 34 });
  else if (type === 'kickers') { spawnEnemy(g, 'kicker', { side: 1 }); spawnEnemy(g, 'kicker', { side: 1, x: g.cam + 360 }); spawnEnemy(g, 'kicker', { side: -1 }); }
  else spawnEnemy(g, type, { side: 1 });
}

function startWave() {
  g.locked = true;
  g.wave.active = true;
  g.wave.queue = g.def.wave.slice();
  g.wave.spawnT = 90;
  if (g.def.waveTruck) spawnTruck(g, true);
  g.banner = 160;
  sfx.warning();
}

function updateWave() {
  const w = g.wave;
  const helis = g.enemies.filter(e => e.type === 'heli' && !e.dead).length;
  if (w.queue.length && --w.spawnT <= 0 && aliveCount(g, true) < 4 && !(w.queue[0].startsWith('heli') && helis >= 2)) {
    const [type, s] = w.queue.shift().split(':');
    w.side = -w.side;
    const side = s === 'R' ? 1 : s === 'L' ? -1 : w.side;
    const truck = side > 0 && bossTruck(g);
    spawnEnemy(g, type, { side, wave: true, y: GROUND, x: truck ? truck.x + 66 : undefined, dir: truck ? -1 : undefined });
    w.spawnT = Math.max(25, 50 / g.speedMul);
  }
  if (!w.queue.length && aliveCount(g, true) === 0) {
    w.active = false; w.done = true;
    stageClear();
  }
}

// ---------------- update ----------------
function updatePlay() {
  const p = g.player;
  updatePlayer(g, input);
  if (!g.locked && !p.dead) {
    const target = p.x - 150;
    if (target > g.cam + 0.5) { g.cam = Math.min(target, g.camMax); g.idleT = 0; }
    else if (++g.idleT > 600) { spawnJet(g); g.idleT = 0; }
  }
  const ev = g.def.events;
  while (g.eventIdx < ev.length && g.cam >= ev[g.eventIdx][0]) triggerEvent(ev[g.eventIdx++][1]);
  if (!g.wave.active && !g.wave.done && !p.dead) {
    if (--g.spawnT <= 0) {
      if (aliveCount(g) < g.maxAlive) spawnEnemy(g, pickWeighted(g.def.weights));
      g.spawnT = spawnInterval();
    }
    if (g.cam >= g.camMax) startWave();
  }
  if (g.wave.active && !p.dead) updateWave();
  updateEnemies(g);
  updateTrucks(g);
  updateJets(g);
  updateProjectiles(g);
  updatePickups(g);
  updateMines(g);
  updateFx(g);
  if (g.banner > 0) g.banner--;
  if (p.dead && p.deadT > 110) {
    g.lives--;
    if (g.lives <= 0) gameOver(); else respawn();
  }
}

function debugKeys() {
  for (const code of takeRawKeys()) {
    if (!DEBUG) continue;
    if (/^Digit[1-4]$/.test(code)) { startStage(+code[5] - 1); beginPlay(); }
    if (code === 'KeyI') g.invincible = !g.invincible;
    if (code === 'KeyN' && g.state === 'play') {
      g.cam = g.camMax; g.player.x = g.cam + 60; g.player.y = GROUND; g.player.onGround = true; g.player.onLadder = null;
      g.eventIdx = g.def.events.length; g.enemies = [];
    }
    if (code === 'KeyG' && g.state === 'play') { g.player.weapon = ['flame', 'bazooka', 'grenade'][(g.t >> 3) % 3]; g.player.ammo = 9; }
  }
}

function update() {
  pollInput();
  if (input.muteP) music.toggle();
  debugKeys();
  g.t++;
  if (g.flash > 0) g.flash--;
  if (g.shake > 0) g.shake--;
  switch (g.state) {
    case 'title':
      if (g.stateT++ === 0) music.play(SONG.TITLE);
      if (input.startP || input.fireP) newGame();
      break;
    case 'intro':
      g.stateT++;
      if (g.stateT > 170 || (g.stateT > 30 && (input.startP || input.fireP))) beginPlay();
      break;
    case 'play':
      if (input.pauseP) g.paused = !g.paused;
      if (g.paused) return;
      updatePlay();
      break;
    case 'clear':
      g.stateT++;
      updateFx(g);
      if (g.stateT === 70) { addScore(g, 2000 * (g.stageIdx + 1) * (g.loop + 1)); sfx.pickup(); }
      if (g.stateT > 240) nextStage();
      break;
    case 'gameover':
      g.stateT++;
      if (g.stateT > 300 || (g.stateT > 80 && (input.startP || input.fireP))) { g.state = 'title'; g.stateT = 0; }
      break;
    case 'ending':
      g.stateT++;
      if (g.stateT === 90) { addScore(g, 10000 * (g.loop + 1)); sfx.extra(); }
      if (g.stateT > 600 || (g.stateT > 120 && (input.startP || input.fireP))) { g.loop++; startStage(0); }
      break;
  }
  music.update();
}

// ---------------- render ----------------
function drawWorld() {
  const sx = g.shake ? Math.round((Math.random() - 0.5) * 4) : 0;
  const sy = g.shake ? Math.round((Math.random() - 0.5) * 4) : 0;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.drawImage(g.bg, Math.floor(g.cam), 0, W, H, 0, 0, W, H);
  const cam = g.cam;
  g.cam = Math.floor(cam);
  drawMines(ctx, g);
  drawTrucks(ctx, g);
  drawPickups(ctx, g);
  drawEnemies(ctx, g);
  drawPlayer(ctx, g);
  drawProjectiles(ctx, g);
  drawFx(ctx, g);
  drawJets(ctx, g);
  g.cam = cam;
  ctx.restore();
}

function blink(rate = 16) { return (g.t % (rate * 2)) < rate; }

function drawTitle() {
  for (const s of g.stars) fill(ctx, ((s.x - g.t * s.z) % 320 + 320) % 320, s.y, 1, 1, s.c);
  const cyc = [7, 8, 10, 2, 10, 8];
  drawText(ctx, 'COMMANDO', 160, 26, cyc[(g.t >> 3) % cyc.length], { scale: 3, align: 'center', shadow: 11 });
  drawText(ctx, 'KNIFE 64', 160, 54, 13, { scale: 3, align: 'center', shadow: 5 });
  drawText(ctx, 'A TRIBUTE TO 8-BIT RUN AND STAB ACTION', 160, 84, 15, { align: 'center' });
  const lines = [
    ['ARROWS/WASD', 'MOVE, CLIMB, JUMP'],
    ['DOWN', 'CROUCH'],
    ['Z / SPACE', 'KNIFE'],
    ['X', 'SPECIAL WEAPON'],
    ['P   M', 'PAUSE   MUSIC'],
  ];
  lines.forEach(([k, v], i) => { drawText(ctx, k, 150, 100 + i * 9, 7, { align: 'right' }); drawText(ctx, v, 162, 100 + i * 9, 1); });
  // a little chase scene
  fill(ctx, 0, 168, 320, 1, 11);
  const px = ((g.t * 1.25) % 440) - 40;
  ctx.drawImage(soldierSprite('player', 'run' + (Math.floor(g.t / 6) % 4), 1), Math.round(px), 144);
  ctx.drawImage(dogSprite(Math.floor(g.t / 4) % 2 ? 'run1' : 'run0', 1), Math.round(px - 46), 144);
  ctx.drawImage(soldierSprite('runner', 'run' + (Math.floor(g.t / 6 + 2) % 4), 1), Math.round(px - 80), 144);
  if (blink()) drawText(ctx, 'PRESS ENTER OR FIRE TO START', 160, 174, 1, { align: 'center' });
  drawText(ctx, 'HI SCORE ' + pad(g.hi), 160, 188, 3, { align: 'center' });
}

function drawIntro() {
  drawText(ctx, 'STAGE ' + (g.stageIdx + 1), 160, 50, 7, { scale: 2, align: 'center', shadow: 8 });
  drawText(ctx, g.def.name, 160, 76, 1, { scale: 2, align: 'center', shadow: 11 });
  drawText(ctx, g.def.brief[0], 160, 108, 15, { align: 'center' });
  drawText(ctx, g.def.brief[1], 160, 118, 15, { align: 'center' });
  if (g.loop > 0) drawText(ctx, 'TOUR ' + (g.loop + 1) + ' - THE ENEMY IS STRONGER', 160, 136, 10, { align: 'center' });
  if (blink(12)) drawText(ctx, 'GET READY', 160, 160, 13, { align: 'center' });
  drawText(ctx, 'LIVES ' + g.lives, 160, 182, 12, { align: 'center' });
}

function drawEnding() {
  for (const s of g.stars) fill(ctx, ((s.x + g.t * s.z * 0.3) % 320 + 320) % 320, s.y, 1, 1, s.c);
  drawText(ctx, 'MISSION COMPLETE', 160, 34, 7, { scale: 2, align: 'center', shadow: 8 });
  drawText(ctx, 'THE PRISONERS ARE FREE!', 160, 64, 1, { align: 'center' });
  fill(ctx, 0, 120, 320, 1, 11);
  for (let i = 0; i < 5; i++) {
    const x = ((g.stateT * 0.9 + i * 30) % 380) - 30;
    ctx.drawImage(soldierSprite('prisoner', 'run' + (Math.floor(g.stateT / 6 + i) % 4), 1), Math.round(x), 96);
  }
  ctx.drawImage(soldierSprite('player', g.stateT % 60 < 30 ? 'hit' : 'stand', -1), 260, 96);
  if (g.stateT > 90) drawText(ctx, 'BONUS ' + 10000 * (g.loop + 1), 160, 136, 13, { align: 'center' });
  drawText(ctx, 'SCORE ' + pad(g.score), 160, 150, 15, { align: 'center' });
  drawText(ctx, 'BUT THE ENEMY IS REGROUPING...', 160, 168, 10, { align: 'center' });
  if (g.stateT > 120 && blink()) drawText(ctx, 'PRESS FIRE FOR THE NEXT TOUR', 160, 182, 1, { align: 'center' });
}

function render() {
  fill(ctx, 0, 0, W, H, 0);
  switch (g.state) {
    case 'title': drawTitle(); break;
    case 'intro': drawIntro(); break;
    case 'ending': drawEnding(); break;
    default:
      drawWorld();
      drawHud(ctx, g);
      if (g.state === 'play') {
        if (g.banner > 0 && blink(8)) {
          drawText(ctx, 'WARNING!', 160, 60, 2, { scale: 2, align: 'center', shadow: 0 });
          drawText(ctx, g.def.waveName + ' INCOMING', 160, 80, 7, { align: 'center', shadow: 0 });
        }
        if (g.paused) { fill(ctx, 110, 92, 100, 16, 0); drawText(ctx, 'PAUSED', 160, 96, 1, { align: 'center' }); }
        if (DEBUG) drawText(ctx, (g.invincible ? 'INV ' : '') + 'X' + Math.round(g.player.x) + ' E' + g.enemies.length, 4, 190, 7, { shadow: 0 });
      } else if (g.state === 'clear') {
        drawText(ctx, 'STAGE CLEAR!', 160, 64, 7, { scale: 2, align: 'center', shadow: 0 });
        if (g.stateT > 70) drawText(ctx, 'BONUS ' + 2000 * (g.stageIdx + 1) * (g.loop + 1), 160, 88, 1, { align: 'center', shadow: 0 });
      } else if (g.state === 'gameover') {
        fill(ctx, 80, 80, 160, 40, 0);
        drawText(ctx, 'GAME OVER', 160, 88, 2, { scale: 2, align: 'center' });
        drawText(ctx, 'SCORE ' + pad(g.score), 160, 108, 15, { align: 'center' });
      }
  }
  const border = g.state === 'title' || g.state === 'ending' ? 14 : g.flash > 0 ? (g.flash % 2 ? 2 : 1) : g.def.border;
  const col = C64[border];
  if (borderEl.dataset.col !== col) { borderEl.style.background = col; borderEl.dataset.col = col; }
}

// ---------------- scaling & loop ----------------
function resize() {
  const s = Math.max(1, Math.floor(Math.min(innerWidth / (W + 48), innerHeight / (H + 48))));
  canvas.style.width = W * s + 'px';
  canvas.style.height = H * s + 'px';
  borderEl.style.padding = 24 * s + 'px';
}
addEventListener('resize', resize);
resize();

const STEP = 1000 / 50;
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  let n = 0;
  while (acc >= STEP && n < 5) { update(); acc -= STEP; n++; }
  if (n === 5) acc = 0;
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
