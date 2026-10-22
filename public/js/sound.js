// Дууны эффектүүд (WebAudio-аар нийлэгжүүлнэ — файл шаардлагагүй)
let ctx = null;
let vol = 0.6;
try {
  const v = parseFloat(localStorage.getItem('skribbl.vol'));
  if (Number.isFinite(v)) vol = v;
} catch {}

export const getVolume = () => vol;
export function setVolume(v) {
  vol = v;
  try { localStorage.setItem('skribbl.vol', String(v)); } catch {}
}

export function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

function note(freq, start, dur, { type = 'sine', gain = 0.25, slide = 0 } = {}) {
  const t0 = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain * vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  join: () => { note(523, 0, 0.12, { type: 'triangle' }); note(784, 0.09, 0.2, { type: 'triangle' }); },
  leave: () => { note(523, 0, 0.12, { type: 'triangle' }); note(349, 0.09, 0.22, { type: 'triangle' }); },
  guessed: () => { note(659, 0, 0.1); note(880, 0.08, 0.2); },
  myGuess: () => [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.07, 0.25, { type: 'triangle', gain: 0.3 })),
  round: () => { note(392, 0, 0.15, { type: 'square', gain: 0.1 }); note(587, 0.14, 0.32, { type: 'square', gain: 0.1 }); },
  choose: () => { note(880, 0, 0.1); note(1175, 0.12, 0.25); },
  turnEnd: () => [659, 523, 392].forEach((f, i) => note(f, i * 0.13, 0.22, { type: 'triangle' })),
  tick: () => note(1400, 0, 0.04, { type: 'square', gain: 0.06 }),
  gameEnd: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => note(f, i * 0.12, 0.3, { type: 'triangle', gain: 0.3 })),
  close: () => note(740, 0, 0.12, { gain: 0.18 }),
  like: () => note(988, 0, 0.12, { gain: 0.15, slide: 1.5 }),
  dislike: () => note(220, 0, 0.2, { type: 'sawtooth', gain: 0.08, slide: 0.7 }),
};

export function play(name) {
  if (!vol || !ctx || ctx.state !== 'running') return;
  try { SOUNDS[name]?.(); } catch {}
}
