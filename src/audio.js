// A tiny SID-flavoured synth: pulse/triangle oscillators + filtered noise,
// a step sequencer for the (original) tunes, and sound effects.
let ac = null, master, musicBus, sfxBus, noiseBuf;
const waves = {};
let musicOn = true;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
  musicBus = ac.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.4; sfxBus.connect(master);
  waves.p25 = pulse(0.25); waves.p12 = pulse(0.125); waves.p50 = pulse(0.5);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function pulse(duty) {
  const n = 48, re = new Float32Array(n), im = new Float32Array(n);
  for (let i = 1; i < n; i++) re[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
  return ac.createPeriodicWave(re, im);
}

function tone(dest, { wave = 'p25', f, t = 0, dur = 0.1, vol = 0.3, a = 0.004, r = 0.04, slide = null, vib = 0 }) {
  if (!ac) return;
  const t0 = ac.currentTime + 0.01 + t;
  const o = ac.createOscillator();
  if (wave === 'tri') o.type = 'triangle';
  else if (wave === 'saw') o.type = 'sawtooth';
  else o.setPeriodicWave(waves[wave]);
  o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + a);
  g.gain.setValueAtTime(vol, t0 + Math.max(a, dur - r));
  g.gain.linearRampToValueAtTime(0, t0 + dur);
  o.connect(g).connect(dest);
  if (vib) {
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 6; lg.gain.value = f * vib;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t0 + 0.08); lfo.stop(t0 + dur + 0.02);
  }
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dest, { t = 0, dur = 0.1, vol = 0.3, ff = 2000, type = 'bandpass', q = 1, rate = 1, slide = null }) {
  if (!ac) return;
  const t0 = ac.currentTime + 0.01 + t;
  const src = ac.createBufferSource();
  src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = rate;
  const flt = ac.createBiquadFilter();
  flt.type = type; flt.frequency.setValueAtTime(ff, t0); flt.Q.value = q;
  if (slide) flt.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(flt).connect(g).connect(dest);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
}

// ---------------- Music ----------------
// All tunes are original compositions. Each channel is a list of 16-step bars;
// channels loop independently. Tokens: note (e.g. "C#4"), "." = hold/rest.
const SONGS = [
  { // 0: Missile Base
    tempo: 6, loop: true,
    lead: ['A4 . . . E4 . A4 . C5 . B4 . A4 . E4 .', 'F4 . . . A4 . C5 . D5 . C5 . B4 . G4 .',
           'A4 . . . E4 . A4 . C5 . D5 . E5 . . .', 'F5 . E5 . D5 . C5 . B4 . . . G#4 . . .'],
    bass: ['A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .', 'F2 . F3 . F2 . F3 . G2 . G3 . G2 . G3 .',
           'A2 . A3 . A2 . A3 . A2 . A3 . A2 . A3 .', 'F2 . F3 . G2 . G3 . E2 . E3 . E2 . E3 .'],
    drums: ['k . h . s . h . k . k . s . h h'],
  },
  { // 1: Harbor
    tempo: 5, loop: true,
    lead: ['D5 . A4 . F4 . A4 . D5 . E5 . F5 . E5 .', 'D5 . . . Bb4 . . . C5 . . . A4 . . .',
           'D5 . A4 . F4 . A4 . G5 . F5 . E5 . D5 .', 'C#5 . . . E5 . . . A4 . . . . . . .'],
    bass: ['D2 . D3 . A2 . D3 . D2 . D3 . A2 . D3 .', 'Bb1 . Bb2 . F2 . Bb2 . C2 . C3 . G2 . C3 .',
           'D2 . D3 . A2 . D3 . D2 . D3 . A2 . D3 .', 'A1 . A2 . E2 . A2 . A1 . C#3 . E3 . A2 .'],
    drums: ['k . h . s . h k . k h . s . h .'],
  },
  { // 2: Bridge
    tempo: 5, loop: true,
    lead: ['E5 . . . . . B4 . E5 . F#5 . G5 . F#5 .', 'E5 . . . D5 . . . B4 . . . . . . .',
           'G5 . . . . . F#5 . E5 . D5 . E5 . B4 .', 'C5 . . . D5 . . . B4 . . . . . . .'],
    bass: ['E2 E2 E3 E2 E2 E2 E3 E2 E2 E2 E3 E2 D2 D2 D3 D2', 'C2 C2 C3 C2 C2 C2 C3 C2 D2 D2 D3 D2 B1 B1 B2 B1'],
    drums: ['k . h k s . h . k . h k s . s s'],
  },
  { // 3: Prison Camp
    tempo: 6, loop: true,
    lead: ['G4 . Bb4 . D5 . . . C5 . Bb4 . A4 . . .', 'G4 . A4 . Bb4 . C5 . D5 . . . . . . .',
           'G5 . F5 . D5 . . . Eb5 . D5 . C5 . . .', 'Bb4 . A4 . F#4 . . . G4 . . . . . . .'],
    bass: ['G2 . . G2 . . G2 . Bb2 . . Bb2 . . C3 .', 'Eb2 . . Eb2 . . Eb2 . D2 . . D2 . . D3 .'],
    drums: ['k . . h s . . h k . k h s . h h'],
  },
  { // 4: Title
    tempo: 7, loop: true,
    lead: ['C5 . . . G4 . . . C5 . D5 . Eb5 . . .', 'D5 . C5 . Bb4 . G4 . Ab4 . . . G4 . . .',
           'C5 . . . G4 . . . C5 . D5 . Eb5 . F5 .', 'G5 . . . F5 . Eb5 . D5 . . . . . . .'],
    bass: ['C3 . C3 . C3 . C3 . Ab2 . Ab2 . Ab2 . Ab2 .', 'Bb2 . Bb2 . Bb2 . Bb2 . G2 . G2 . G2 . G2 .',
           'C3 . C3 . C3 . C3 . Ab2 . Ab2 . Ab2 . Ab2 .', 'G2 . G2 . G2 . G2 . G2 . G2 . B2 . B2 .'],
    drums: ['k . h . s . h . k . h . s . h .'],
  },
  { // 5: Stage start / clear jingle
    tempo: 5, loop: false,
    lead: ['C5 E5 G5 C6 . . G5 . C6 . . . . . . .'],
    bass: ['C3 . . . . . G2 . C3 . . . . . . .'],
    drums: ['k . . . . . . . k . . . s . . .'],
  },
  { // 6: Game over
    tempo: 9, loop: false,
    lead: ['A4 . G4 . F4 . E4 . D4 . . . . . . .'],
    bass: ['A2 . . . F2 . . . D2 . . . . . . .'],
    drums: ['. . . . . . . . . . . . . . . .'],
  },
  { // 7: Ending
    tempo: 6, loop: true,
    lead: ['C5 . E5 . G5 . . . A5 . G5 . E5 . . .', 'F5 . A5 . C6 . . . B5 . A5 . G5 . . .',
           'E5 . G5 . C6 . . . D6 . C6 . A5 . . .', 'G5 . . . B5 . . . C6 . . . . . . .'],
    bass: ['C3 . G2 . C3 . G2 . A2 . E2 . A2 . E2 .', 'F2 . C3 . F2 . C3 . G2 . D3 . G2 . D3 .',
           'C3 . G2 . C3 . G2 . A2 . E2 . A2 . E2 .', 'G2 . D3 . G2 . D3 . C3 . G2 . C3 . . .'],
    drums: ['k . h . s . h . k . h . s . h h'],
  },
];
export const SONG = { TITLE: 4, JINGLE: 5, GAMEOVER: 6, ENDING: 7 };

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function freq(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  const n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = 12 * (+m[3] + 1) + n;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function compileChannel(bars) {
  const toks = bars.join(' ').trim().split(/\s+/);
  const ev = toks.map(() => null);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '.') continue;
    let len = 1;
    while (i + len < toks.length && toks[i + len] === '.') len++;
    ev[i] = { tok: t, f: freq(t), len };
  }
  return ev;
}
const compiled = SONGS.map(s => ({
  ...s,
  ch: { lead: compileChannel(s.lead), bass: compileChannel(s.bass), drums: compileChannel(s.drums) },
}));

let cur = null, step = 0, tick = 0;

export const music = {
  play(i) { cur = compiled[i]; step = 0; tick = cur.tempo; },
  stop() { cur = null; },
  toggle() { musicOn = !musicOn; return musicOn; },
  get on() { return musicOn; },
  update() {
    if (!cur || !ac) return;
    if (++tick < cur.tempo) return;
    tick = 0;
    const sd = cur.tempo / 50;
    const longest = Math.max(cur.ch.lead.length, cur.ch.bass.length, cur.ch.drums.length);
    if (!cur.loop && step >= longest) { cur = null; return; }
    if (musicOn) {
      const L = cur.ch.lead[step % cur.ch.lead.length];
      if (L) tone(musicBus, { wave: 'p25', f: L.f, dur: L.len * sd * 0.92, vol: 0.3, r: 0.03, vib: L.len > 2 ? 0.012 : 0 });
      const B = cur.ch.bass[step % cur.ch.bass.length];
      if (B) tone(musicBus, { wave: 'p50', f: B.f, dur: Math.min(B.len, 2) * sd * 0.85, vol: 0.22, r: 0.02 });
      const D = cur.ch.drums[step % cur.ch.drums.length];
      if (D) {
        if (D.tok === 'k') tone(musicBus, { wave: 'tri', f: 160, slide: 40, dur: 0.12, vol: 0.9, r: 0.05 });
        else if (D.tok === 's') { noise(musicBus, { dur: 0.13, vol: 0.45, ff: 1800, type: 'highpass' }); tone(musicBus, { wave: 'tri', f: 240, slide: 120, dur: 0.06, vol: 0.4 }); }
        else if (D.tok === 'h') noise(musicBus, { dur: 0.035, vol: 0.18, ff: 7000, type: 'highpass' });
      }
    }
    step++;
    if (cur.loop && step >= longest) step = 0;
  },
};

// ---------------- Sound effects ----------------
const S = () => sfxBus;
export const sfx = {
  stab() { noise(S(), { dur: 0.06, vol: 0.35, ff: 3200, q: 2 }); tone(S(), { wave: 'p12', f: 900, slide: 300, dur: 0.05, vol: 0.15 }); },
  kill() { tone(S(), { wave: 'p25', f: 620, slide: 80, dur: 0.2, vol: 0.3 }); },
  shot() { noise(S(), { dur: 0.09, vol: 0.35, ff: 1500 }); tone(S(), { wave: 'p50', f: 300, slide: 60, dur: 0.06, vol: 0.15 }); },
  rocket() { noise(S(), { dur: 0.45, vol: 0.35, ff: 1200, slide: 300, type: 'lowpass' }); },
  explode() { noise(S(), { dur: 0.7, vol: 0.7, ff: 900, slide: 120, type: 'lowpass' }); tone(S(), { wave: 'tri', f: 90, slide: 30, dur: 0.5, vol: 0.6 }); },
  jump() { tone(S(), { wave: 'p25', f: 220, slide: 520, dur: 0.12, vol: 0.15 }); },
  pickup() { [523, 659, 784, 1047].forEach((f, i) => tone(S(), { wave: 'p25', f, t: i * 0.06, dur: 0.06, vol: 0.22 })); },
  extra() { [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(S(), { wave: 'p25', f, t: i * 0.07, dur: 0.07, vol: 0.22 })); },
  die() { tone(S(), { wave: 'p25', f: 800, slide: 50, dur: 0.9, vol: 0.3 }); noise(S(), { dur: 0.3, vol: 0.3, ff: 600 }); },
  flame() { noise(S(), { dur: 0.55, vol: 0.4, ff: 900, q: 0.6, slide: 500 }); },
  thump() { tone(S(), { wave: 'tri', f: 120, slide: 50, dur: 0.15, vol: 0.5 }); noise(S(), { dur: 0.1, vol: 0.2, ff: 500, type: 'lowpass' }); },
  bark() { tone(S(), { wave: 'p25', f: 500, slide: 300, dur: 0.07, vol: 0.2 }); tone(S(), { wave: 'p25', f: 520, slide: 280, t: 0.1, dur: 0.07, vol: 0.2 }); },
  warning() { for (let i = 0; i < 6; i++) tone(S(), { wave: 'p50', f: i % 2 ? 660 : 880, t: i * 0.16, dur: 0.14, vol: 0.18 }); },
  select() { tone(S(), { wave: 'p25', f: 440, slide: 880, dur: 0.15, vol: 0.2 }); },
  jet() { noise(S(), { dur: 1.4, vol: 0.4, ff: 400, slide: 2400, q: 1.5 }); },
  tick() { tone(S(), { wave: 'p12', f: 1200, dur: 0.03, vol: 0.12 }); },
};
