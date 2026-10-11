import { fill, drawText } from './gfx.js';
import { misc } from './sprites.js';

const KEY = 'commando-knife-64.hi';

export function loadHi() {
  try { return parseInt(localStorage.getItem(KEY), 10) || 20000; } catch { return 20000; }
}
export function saveHi(v) {
  try { localStorage.setItem(KEY, String(v)); } catch { /* storage unavailable */ }
}

export const pad = (n, w = 6) => String(n).padStart(w, '0');

export function drawHud(ctx, g) {
  fill(ctx, 0, 0, 320, 16, 0);
  fill(ctx, 0, 16, 320, 1, 11);
  drawText(ctx, '1UP', 4, 1, 10);
  drawText(ctx, pad(g.score), 26, 1, 1);
  drawText(ctx, 'HI', 104, 1, 7);
  drawText(ctx, pad(g.hi), 118, 1, 1);
  drawText(ctx, 'STAGE ' + (g.stageIdx + 1), 316, 1, 3, { align: 'right' });
  const reserve = Math.min(g.lives - 1, 8);
  for (let i = 0; i < reserve; i++) ctx.drawImage(misc.life, 4 + i * 9, 9);
  const p = g.player;
  if (p && p.weapon) {
    ctx.drawImage(misc.pickups[p.weapon], 104, 8);
    drawText(ctx, 'X' + p.ammo, 118, 9, 7);
  } else {
    drawText(ctx, 'KNIFE', 104, 9, 12);
  }
  drawText(ctx, g.def.name, 316, 9, 15, { align: 'right' });
}
