// Whitewater sound effects: tiny WebAudio synth, no audio files.
// Everything is created on first user gesture; any failure silently
// disables sound so the game never breaks on a headless run.

let ctx = null;
let muted = false;

export function initAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

function tone(freq, dur, type, vol, when = 0, slideTo = null) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    // Sound is decoration; never let it break the game.
  }
}

function noise(dur, vol, when = 0) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
  } catch {
    // Ignore.
  }
}

export const sfx = {
  coin() {
    tone(880, 0.09, 'sine', 0.16);
    tone(1318, 0.12, 'sine', 0.14, 0.07);
  },
  gate() {
    tone(523, 0.1, 'triangle', 0.18);
    tone(659, 0.1, 'triangle', 0.18, 0.08);
    tone(784, 0.16, 'triangle', 0.2, 0.16);
  },
  hit() {
    tone(160, 0.25, 'sawtooth', 0.22, 0, 60);
    noise(0.22, 0.25);
  },
  splash() {
    noise(0.12, 0.08);
  },
  level() {
    tone(392, 0.1, 'square', 0.1);
    tone(523, 0.14, 'square', 0.1, 0.09);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18, i * 0.12));
  },
  wreck() {
    [330, 262, 196].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.14, i * 0.16));
  },
};
