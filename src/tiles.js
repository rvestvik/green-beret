import { C64 } from './palette.js';
import { makeCanvas, disc } from './gfx.js';
import { GROUND } from './collision.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function below(level, x, y) {
  let b = GROUND;
  for (const s of level.surfaces) if (s.y > y && s.y < b && x >= s.x0 && x <= s.x1) b = s.y;
  return b;
}

// Renders an entire stage's scenery (including platforms and ladders) once.
export function renderBackground(def, level) {
  const L = def.len, cv = makeCanvas(L, 200), ctx = cv.getContext('2d');
  const R = rng(def.seed);
  const P = (x, y, w, h, col) => { ctx.fillStyle = C64[col]; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const D = (x, y, r, col) => disc(ctx, x, y, r, col);
  SCENES[def.style](P, D, R, L);
  const tops = level.surfaces.filter(s => s.y < GROUND).sort((a, b) => b.y - a.y);
  for (const s of tops) PLATFORMS[def.style](P, R, s, level);
  for (const l of level.ladders) ladder(P, l);
  return cv;
}

function ladder(P, l) {
  const h = l.bot - l.top;
  P(l.x - 4, l.top - 6, 1, h + 6, 15); P(l.x + 4, l.top - 6, 1, h + 6, 15);
  for (let y = l.top - 3; y < l.bot; y += 4) P(l.x - 3, y, 7, 1, 12);
}

// ---------------- scenery ----------------
const SCENES = {
  base(P, D, R, L) {
    P(0, 0, L, 200, 6);
    P(0, 90, L, 4, 14); P(0, 97, L, 5, 14); P(0, 105, L, 30, 14);
    for (let i = 0; i < L; i++) {
      const h = 20 + 10 * Math.sin(i * 0.012) + 7 * Math.sin(i * 0.037 + 1.3) + 3 * Math.sin(i * 0.11);
      P(i, 128 - h, 1, h + 14, 11);
      if (h > 31) P(i, 128 - h, 1, 3, 15);
    }
    P(0, 140, L, 44, 9);
    for (let mx = 140; mx < L - 400; mx += 360) missile(P, mx);
    for (let tx = 260; tx < L - 420; tx += 360) { if ((tx / 360 | 0) % 2) tank(P, D, tx + 40); else missileTrailer(P, D, tx); }
    // chain-link fence
    for (let y = 148; y < 182; y++)
      for (let x = (y % 6); x < L; x += 6) { P(x, y, 1, 1, 11); P(x + ((12 - 2 * (y % 6)) % 6), y, 1, 1, 11); }
    P(0, 146, L, 1, 15);
    for (let x = 0; x < L; x += 6) P(x, 145, 1, 1, 15);
    for (let x = 0; x < L; x += 32) { P(x, 144, 2, 40, 12); P(x, 142, 4, 2, 12); }
    launchPad(P, L - 300);
    ground(P, R, L, 8, 7, 9);
  },
  harbor(P, D, R, L) {
    P(0, 0, L, 36, 6); P(0, 36, L, 20, 4); P(0, 56, L, 16, 10); P(0, 72, L, 16, 8); P(0, 88, L, 12, 7);
    for (let sx = 300; sx < L; sx += 900) D(sx, 98, 14, 1);
    P(0, 100, L, 70, 6);
    for (let i = 0; i < L / 4; i++) {
      const y = 102 + Math.floor(R() * R() * 66);
      P(R() * L, y, 3 + Math.floor(R() * 10 * (y - 96) / 70), 1, 14);
    }
    for (let ox = 40; ox < L; ox += 500) oilTank(P, ox);
    let k = 0;
    for (let sx = 80; sx < L; sx += 420 + Math.floor(R() * 200)) (k++ % 2 ? submarine : ship)(P, sx);
    for (let cx = 360; cx < L; cx += 560) crane(P, cx);
    P(0, 170, L, 14, 11); P(0, 176, L, 1, 12); P(0, 170, L, 1, 12);
    for (let x = 0; x < L; x += 16) { P(x, 170, 1, 6, 12); P(x + 8, 177, 1, 7, 12); }
    for (let x = 40; x < L; x += 140) { P(x, 179, 6, 5, 0); P(x - 1, 178, 8, 1, 12); }
    for (let cx = 200; cx < L; cx += 300 + Math.floor(R() * 160)) containers(P, R, cx);
    P(0, 184, L, 16, 8); P(0, 184, L, 1, 7);
    for (let x = 0; x < L; x += 24) P(x, 185, 1, 15, 9);
    P(0, 192, L, 1, 9);
  },
  bridge(P, D, R, L) {
    P(0, 0, L, 200, 0);
    for (let i = 0; i < L / 6; i++) P(R() * L, 16 + R() * 110, 1, 1, [1, 15, 12][Math.floor(R() * 3)]);
    for (const mx of [240, 1500]) { D(mx, 46, 10, 15); D(mx + 3, 43, 2, 12); D(mx - 4, 49, 2, 12); }
    for (let bx = 0; bx < L;) {
      const w = 14 + Math.floor(R() * 22), h = 12 + Math.floor(R() * 40);
      P(bx, 165 - h, w - 2, h, 6);
      for (let wy = 165 - h + 3; wy < 162; wy += 4)
        for (let wx = bx + 2; wx < bx + w - 4; wx += 3) if (R() < 0.22) P(wx, wy, 1, 2, 7);
      bx += w;
    }
    P(0, 165, L, 19, 6);
    for (let i = 0; i < L / 5; i++) P(R() * L, 167 + R() * 16, 2 + R() * 8, 1, R() < 0.3 ? 7 : 14);
    // airfield behind a wall: parked planes show their tails and noses over the top
    for (let ax = 60; ax < L; ax += 230 + Math.floor(R() * 120)) plane(P, ax);
    P(0, 156, L, 28, 11); P(0, 156, L, 1, 12);
    for (let y = 160; y < 184; y += 6) for (let x = (y / 6 % 2) * 8; x < L; x += 16) P(x, y, 1, 6, 0);
    for (let y = 162; y < 184; y += 6) P(0, y, L, 1, 0);
    // truss
    for (let tx = 0; tx < L; tx += 64) {
      for (let k = 0; k < 150; k++) {
        const o = Math.floor(k * 64 / 150);
        P(tx + o, 33 + k, 2, 1, 2); P(tx + 64 - o, 33 + k, 2, 1, 2);
      }
      P(tx, 33, 3, 151, 8); P(tx + 2, 33, 1, 151, 9);
    }
    P(0, 28, L, 5, 8); P(0, 28, L, 1, 7); P(0, 32, L, 1, 9);
    P(0, 184, L, 16, 12); P(0, 184, L, 1, 15);
    for (let x = 0; x < L; x += 24) P(x, 191, 10, 1, 7);
    P(0, 197, L, 3, 11);
  },
  camp(P, D, R, L) {
    P(0, 0, L, 60, 14); P(0, 60, L, 80, 3);
    for (let i = 0; i < L; i++) {
      const h = 24 + 9 * Math.sin(i * 0.01) + 6 * Math.sin(i * 0.031 + 2) + 2 * Math.sin(i * 0.2);
      P(i, 112 - h, 1, h + 30, 5);
    }
    for (let tx = 30; tx < L; tx += 70 + Math.floor(R() * 70)) palm(P, tx, R);
    P(0, 140, L, 44, 9);
    for (let hx = 60; hx < L; hx += 300 + Math.floor(R() * 120)) storehouse(P, hx, 120 + Math.floor(R() * 60));
    // camp wall with barbed wire on top
    P(0, 152, L, 32, 12); P(0, 152, L, 2, 15);
    for (let y = 154; y < 184; y += 5) {
      P(0, y + 4, L, 1, 11);
      for (let x = (y % 2) * 6; x < L; x += 12) P(x, y, 1, 4, 11);
    }
    for (let x = 0; x < L; x += 48) { P(x, 140, 2, 12, 9); }
    P(0, 143, L, 1, 15); P(0, 147, L, 1, 15);
    for (let x = 3; x < L; x += 7) { P(x, 142, 1, 3, 15); P(x + 3, 146, 1, 3, 15); }
    P(0, 184, L, 16, 9); P(0, 184, L, 2, 5);
    for (let i = 0; i < L / 4; i++) P(R() * L, 186 + R() * 12, 2, 1, 8);
    for (let i = 0; i < L / 6; i++) P(R() * L, 182, 1, 2, 13);
  },
};

function ground(P, R, L, base, top, speck) {
  P(0, 184, L, 16, base); P(0, 184, L, 1, top);
  for (let i = 0; i < L / 3; i++) P(R() * L, 186 + R() * 13, 2, 1, speck);
}

function missile(P, mx) {
  P(mx + 22, 20, 2, 164, 12); P(mx + 34, 20, 2, 164, 12);
  for (let y = 24; y < 180; y += 12) {
    P(mx + 22, y, 14, 1, 12);
    for (let k = 0; k < 12; k++) P(mx + 23 + k, y + k, 1, 1, 11);
  }
  P(mx + 26, 15, 3, 4, 2);
  P(mx, 40, 12, 140, 1); P(mx + 9, 40, 3, 140, 15);
  P(mx, 70, 12, 3, 2); P(mx, 130, 12, 3, 2);
  P(mx + 1, 34, 10, 6, 2); P(mx + 3, 29, 6, 5, 2); P(mx + 5, 25, 2, 4, 2);
  P(mx - 5, 156, 5, 24, 2); P(mx + 12, 156, 5, 24, 2); P(mx + 2, 180, 8, 4, 11);
  P(mx + 12, 60, 10, 2, 12); P(mx + 12, 112, 10, 2, 12);
}

function missileTrailer(P, D, x) {
  P(x + 2, 168, 86, 4, 12); P(x + 2, 168, 86, 1, 15);
  P(x + 8, 159, 72, 8, 1); P(x + 8, 165, 72, 2, 15); P(x + 30, 159, 2, 8, 2); P(x + 56, 159, 2, 8, 2);
  P(x + 80, 160, 4, 6, 2); P(x + 84, 161, 3, 4, 2); P(x + 87, 162, 2, 2, 2);
  P(x + 4, 155, 4, 4, 15); P(x + 4, 167, 4, 3, 15);
  P(x + 90, 158, 18, 14, 5); P(x + 98, 160, 8, 5, 3); P(x + 88, 172, 22, 2, 11);
  for (const wx of [12, 22, 66, 100]) { D(x + wx, 176, 4, 0); D(x + wx, 176, 1, 12); }
}

function tank(P, D, x) {
  P(x, 166, 48, 8, 11); P(x + 2, 164, 44, 2, 12); P(x - 2, 172, 52, 6, 0);
  P(x + 14, 156, 20, 8, 11); P(x + 16, 155, 14, 1, 12); P(x + 34, 159, 22, 2, 11);
  for (let wx = x + 2; wx < x + 48; wx += 7) D(wx, 175, 2, 12);
}

// The end-of-stage launch platform with its three missiles.
function launchPad(P, x) {
  P(x, 150, 290, 34, 11); P(x, 150, 290, 2, 15);
  for (let k = x + 6; k < x + 290; k += 24) P(k, 154, 12, 3, 7);
  for (let i = 0; i < 3; i++) {
    const mx = x + 50 + i * 90;
    P(mx - 3, 30, 3, 120, 12); P(mx + 15, 30, 3, 120, 12);
    for (let y = 36; y < 150; y += 16) P(mx - 3, y, 21, 1, 12);
    P(mx, 44, 15, 106, 1); P(mx + 11, 44, 4, 106, 15);
    P(mx, 70, 15, 3, 2); P(mx, 120, 15, 3, 2);
    P(mx + 1, 38, 13, 6, 2); P(mx + 3, 32, 9, 6, 2); P(mx + 6, 27, 3, 5, 2);
    P(mx - 6, 136, 6, 14, 2); P(mx + 15, 136, 6, 14, 2);
  }
}

function submarine(P, sx) {
  P(sx, 106, 110, 6, 11); P(sx + 4, 103, 100, 3, 11); P(sx + 10, 101, 86, 2, 11);
  P(sx + 10, 101, 86, 1, 12); P(sx + 106, 104, 6, 4, 11);
  P(sx + 40, 88, 20, 13, 11); P(sx + 42, 86, 14, 2, 12); P(sx + 48, 78, 2, 8, 12); P(sx + 44, 92, 2, 2, 0);
  P(sx - 2, 108, 116, 1, 14);
}

function oilTank(P, ox) {
  P(ox, 72, 36, 26, 15); P(ox, 72, 36, 2, 1); P(ox + 30, 74, 6, 24, 12);
  for (let y = 78; y < 98; y += 6) P(ox, y, 36, 1, 12);
  P(ox + 4, 70, 28, 2, 12);
}

function containers(P, R, cx) {
  const cols = [[2, 10], [6, 14], [5, 13], [8, 7]];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 2 - row; i++) {
      const [c, rib] = cols[Math.floor(R() * cols.length)];
      const x = cx + i * 34 + row * 17, y = 168 - row * 16;
      P(x, y, 32, 16, c);
      for (let k = x + 2; k < x + 31; k += 3) P(k, y + 2, 1, 12, rib);
      P(x, y, 32, 1, rib);
    }
  }
}

function plane(P, ax) {
  // tail fin
  for (let k = 0; k < 22; k++) P(ax + Math.floor(k * 0.5), 134 + k, 14 - Math.floor(k * 0.3), 1, 15);
  P(ax + 2, 140, 6, 2, 2);
  // fuselage top and cockpit
  P(ax + 10, 150, 90, 6, 12); P(ax + 10, 150, 90, 1, 15);
  P(ax + 96, 148, 10, 8, 12); P(ax + 92, 149, 6, 2, 14);
}

function storehouse(P, hx, w) {
  P(hx, 118, w, 34, 8); P(hx, 118, w, 1, 7);
  for (let x = hx + 2; x < hx + w; x += 4) P(x, 119, 1, 33, 9);
  for (let k = 0; k < 8; k++) P(hx - 4 + k, 110 + k, w + 8 - 2 * k, 1, k % 2 ? 11 : 12);
  P(hx + 10, 126, 8, 6, 0); P(hx + w - 18, 126, 8, 6, 0);
}

function ship(P, sx) {
  for (let k = 0; k < 10; k++) P(sx + k, 90 + k, 120 - k * 2, 1, 11);
  P(sx + 66, 76, 30, 14, 11); P(sx + 72, 68, 18, 8, 11); P(sx + 78, 58, 7, 10, 0);
  P(sx + 20, 70, 1, 20, 11); P(sx + 108, 74, 1, 16, 11);
  for (let w = sx + 68; w < sx + 94; w += 4) P(w, 80, 2, 2, 7);
}

function crane(P, cx) {
  P(cx, 66, 3, 104, 0); P(cx + 22, 66, 3, 104, 0);
  for (let y = 70; y < 170; y += 14) for (let k = 0; k < 14; k++) P(cx + 3 + Math.floor(k * 1.4), y + k, 1, 1, 0);
  P(cx - 3, 58, 30, 9, 0); P(cx - 60, 56, 130, 3, 0); P(cx + 60, 48, 3, 8, 0);
  P(cx - 48, 59, 1, 44, 0); P(cx - 51, 103, 7, 3, 0);
}

function palm(P, tx, R) {
  const h = 50 + Math.floor(R() * 30), lean = R() < 0.5 ? -1 : 1;
  let topX = tx;
  for (let k = 0; k < h; k++) { topX = tx + lean * Math.floor(k * k / 700); P(topX, 140 - k, 3, 1, k % 4 ? 9 : 8); }
  const ty = 140 - h;
  for (const [dx, dy] of [[-1, 0.2], [1, 0.2], [-0.8, -0.4], [0.8, -0.4], [0, -1]]) {
    for (let k = 0; k < 16; k++) P(topX + 1 + dx * k, ty + dy * k + k * k / 22, 3, 2, k < 8 ? 13 : 5);
  }
}

// ---------------- platforms ----------------
const PLATFORMS = {
  base(P, R, s, level) {
    const w = s.x1 - s.x0;
    for (let sx = s.x0 + 6; sx < s.x1 - 6; sx += 40) support(P, level, sx, s.y + 5, 11, 12);
    support(P, level, s.x1 - 9, s.y + 5, 11, 12);
    P(s.x0, s.y - 9, w, 1, 12);
    for (let px = s.x0; px < s.x1; px += 16) P(px, s.y - 9, 1, 9, 12);
    P(s.x0, s.y, w, 5, 12); P(s.x0, s.y, w, 1, 15); P(s.x0, s.y + 4, w, 1, 11);
    for (let px = s.x0 + 3; px < s.x1; px += 8) P(px, s.y + 2, 1, 1, 11);
  },
  harbor(P, R, s, level) {
    const w = s.x1 - s.x0, b = below(level, (s.x0 + s.x1) / 2, s.y);
    if (s.y === 136) {
      for (let bx = s.x0; bx < s.x1; bx += 16)
        for (let by = s.y; by < b; by += 16) crate(P, bx, by, Math.min(16, s.x1 - bx), Math.min(16, b - by));
    } else {
      const [c, rib] = [[2, 10], [6, 14], [5, 13]][Math.floor(R() * 3)];
      P(s.x0, s.y, w, b - s.y, c);
      for (let x = s.x0 + 2; x < s.x1; x += 4) P(x, s.y + 2, 1, b - s.y - 4, rib);
      P(s.x0, s.y, w, 2, 15); P(s.x0, b - 2, w, 2, 11);
      P(s.x1 - 14, s.y + 8, 2, b - s.y - 16, 12);
    }
  },
  bridge(P, R, s, level) {
    const w = s.x1 - s.x0;
    for (let sx = s.x0 + 4; sx < s.x1 - 4; sx += 48) support(P, level, sx, s.y + 6, 12, 15);
    support(P, level, s.x1 - 7, s.y + 6, 12, 15);
    P(s.x0, s.y, w, 6, 12); P(s.x0, s.y, w, 1, 15); P(s.x0, s.y + 5, w, 1, 11);
    for (let px = s.x0 + 2; px < s.x1; px += 6) P(px, s.y + 3, 1, 1, 11);
  },
  camp(P, R, s, level) {
    const w = s.x1 - s.x0;
    for (let sx = s.x0 + 2; sx < s.x1 - 4; sx += 32) support(P, level, sx, s.y + 5, 9, 8);
    support(P, level, s.x1 - 5, s.y + 5, 9, 8);
    if (s.y === 88) {
      P(s.x0 + 1, s.y - 32, 2, 32, 9); P(s.x1 - 3, s.y - 32, 2, 32, 9);
      P(s.x0 - 6, s.y - 36, w + 12, 4, 9); P(s.x0 - 2, s.y - 40, w + 4, 4, 8); P(s.x0 + 4, s.y - 43, w - 8, 3, 7);
    }
    P(s.x0, s.y - 8, w, 1, 8);
    P(s.x0, s.y, w, 5, 8); P(s.x0, s.y, w, 1, 7); P(s.x0, s.y + 4, w, 1, 9);
    for (let px = s.x0; px < s.x1; px += 8) P(px, s.y + 1, 1, 3, 9);
  },
};

function support(P, level, x, y, col, hi) {
  const b = below(level, x, y);
  if (b <= y) return;
  P(x, y, 3, b - y, col); P(x, y, 1, b - y, hi);
}

function crate(P, x, y, w, h) {
  P(x, y, w, h, 8); P(x, y, w, 1, 7); P(x, y, 1, h, 7); P(x + w - 1, y, 1, h, 9); P(x, y + h - 1, w, 1, 9);
  for (let k = 1; k < Math.min(w, h) - 1; k++) P(x + k, y + k, 1, 1, 9);
}
