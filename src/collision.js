export const GROUND = 184;

export function overlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// Highest surface whose y lies in [y0, y1] at x (used when falling through).
export function surfaceCross(level, x, y0, y1) {
  let best = null;
  for (const s of level.surfaces) {
    if (x >= s.x0 && x <= s.x1 && s.y >= y0 && s.y <= y1 && (best === null || s.y < best)) best = s.y;
  }
  return best;
}

export function hasSurface(level, x, y) {
  for (const s of level.surfaces) if (s.y === y && x >= s.x0 && x <= s.x1) return true;
  return false;
}

export function surfacesAt(level, x) {
  return level.surfaces.filter(s => x >= s.x0 && x <= s.x1).map(s => s.y);
}

// dir -1: ladder going up from y; dir 1: ladder going down from y.
export function findLadder(level, x, y, dir, reach = 5) {
  for (const l of level.ladders) {
    if (Math.abs(x - l.x) > reach) continue;
    if (dir < 0 && l.bot === y) return l;
    if (dir > 0 && l.top === y) return l;
  }
  return null;
}

// Gravity + one-way platforms. Sets e.landed on the tick it touches down.
export function physics(e, level, grav) {
  if (e.onLadder) return;
  if (e.onGround) {
    if (hasSurface(level, e.x, e.y)) { e.vy = 0; return; }
    e.onGround = false;
  }
  e.vy = Math.min(e.vy + grav, 5);
  const ny = e.y + e.vy;
  if (e.vy > 0) {
    const s = surfaceCross(level, e.x, e.y, ny);
    if (s !== null) { e.y = s; e.vy = 0; e.onGround = true; e.landed = true; return; }
  }
  e.y = ny;
}
