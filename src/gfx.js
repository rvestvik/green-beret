import { C64 } from './palette.js';

export const W = 320, H = 200;

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').imageSmoothingEnabled = false;
  return c;
}

export function flipCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  const x = c.getContext('2d');
  x.translate(src.width, 0);
  x.scale(-1, 1);
  x.drawImage(src, 0, 0);
  return c;
}

export function fill(ctx, x, y, w, h, col) {
  ctx.fillStyle = C64[col];
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// Filled pixel circle built from horizontal spans.
export function disc(ctx, cx, cy, r, col) {
  ctx.fillStyle = C64[col];
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

// ---- 5x7 bitmap font ----
const GLYPHS = {
  'A': '.###. #...# #...# ##### #...# #...# #...#',
  'B': '####. #...# #...# ####. #...# #...# ####.',
  'C': '.###. #...# #.... #.... #.... #...# .###.',
  'D': '####. #...# #...# #...# #...# #...# ####.',
  'E': '##### #.... #.... ####. #.... #.... #####',
  'F': '##### #.... #.... ####. #.... #.... #....',
  'G': '.###. #...# #.... #.### #...# #...# .####',
  'H': '#...# #...# #...# ##### #...# #...# #...#',
  'I': '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
  'J': '..### ...#. ...#. ...#. ...#. #..#. .##..',
  'K': '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
  'L': '#.... #.... #.... #.... #.... #.... #####',
  'M': '#...# ##.## #.#.# #.#.# #...# #...# #...#',
  'N': '#...# #...# ##..# #.#.# #..## #...# #...#',
  'O': '.###. #...# #...# #...# #...# #...# .###.',
  'P': '####. #...# #...# ####. #.... #.... #....',
  'Q': '.###. #...# #...# #...# #.#.# #..#. .##.#',
  'R': '####. #...# #...# ####. #.#.. #..#. #...#',
  'S': '.#### #.... #.... .###. ....# ....# ####.',
  'T': '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  'U': '#...# #...# #...# #...# #...# #...# .###.',
  'V': '#...# #...# #...# #...# #...# .#.#. ..#..',
  'W': '#...# #...# #...# #.#.# #.#.# #.#.# .#.#.',
  'X': '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
  'Y': '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  'Z': '##### ....# ...#. ..#.. .#... #.... #####',
  '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
  '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
  '2': '.###. #...# ....# ...#. ..#.. .#... #####',
  '3': '##### ...#. ..#.. ...#. ....# #...# .###.',
  '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5': '##### #.... ####. ....# ....# #...# .###.',
  '6': '..##. .#... #.... ####. #...# #...# .###.',
  '7': '##### ....# ...#. ..#.. .#... .#... .#...',
  '8': '.###. #...# #...# .###. #...# #...# .###.',
  '9': '.###. #...# #...# .#### ....# ...#. .##..',
  '.': '..... ..... ..... ..... ..... .##.. .##..',
  ',': '..... ..... ..... ..... .##.. ..#.. .#...',
  '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
  '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
  '-': '..... ..... ..... ##### ..... ..... .....',
  ':': '..... .##.. .##.. ..... .##.. .##.. .....',
  "'": '..#.. ..#.. .#... ..... ..... ..... .....',
  '/': '....# ...#. ...#. ..#.. .#... .#... #....',
  '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
  ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
  '=': '..... ..... ##### ..... ##### ..... .....',
  '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
  '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
  '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
  ' ': '..... ..... ..... ..... ..... ..... .....',
};

const glyphCache = new Map();
function glyph(ch, col) {
  const k = ch + col;
  let c = glyphCache.get(k);
  if (c) return c;
  c = makeCanvas(5, 7);
  const x = c.getContext('2d');
  x.fillStyle = C64[col];
  const rows = (GLYPHS[ch] || GLYPHS['?']).split(' ');
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') x.fillRect(rx, ry, 1, 1);
  });
  glyphCache.set(k, c);
  return c;
}

export function textWidth(s, scale = 1) {
  return s.length * 6 * scale - scale;
}

// opts: { scale, align: 'left'|'center'|'right', shadow: colour }
export function drawText(ctx, s, x, y, col, opts = {}) {
  s = String(s).toUpperCase();
  const scale = opts.scale || 1;
  let sx = x;
  if (opts.align === 'center') sx = x - Math.floor(textWidth(s, scale) / 2);
  else if (opts.align === 'right') sx = x - textWidth(s, scale);
  sx = Math.round(sx); y = Math.round(y);
  if (opts.shadow !== undefined) drawRun(ctx, s, sx + scale, y + scale, opts.shadow, scale);
  drawRun(ctx, s, sx, y, col, scale);
}

function drawRun(ctx, s, x, y, col, scale) {
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ' ') continue;
    ctx.drawImage(glyph(s[i], col), x + i * 6 * scale, y, 5 * scale, 7 * scale);
  }
}
