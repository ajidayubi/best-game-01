// All sound in Ember Drift is synthesized with WebAudio: no audio files,
// no network, just oscillators and filtered noise. Every method is a safe
// no-op until the player first interacts (browsers block audio before a
// gesture) and while muted, so screenshot scenes and the title screen stay
// silent on their own.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.drone = null;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // Short tone that slides from one frequency to another.
  tone(freqA, freqB, seconds, type, gain) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), t0 + seconds);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  // Burst of filtered noise, for explosions and hits.
  noise(seconds, filterFreq, gain) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter);
    filter.connect(amp);
    amp.connect(this.master);
    src.start(t0);
    src.stop(t0 + seconds + 0.02);
  }

  shoot() {
    this.tone(880, 420, 0.07, 'square', 0.08);
  }

  boom(big) {
    this.noise(big ? 0.5 : 0.28, big ? 900 : 1400, big ? 0.5 : 0.3);
    this.tone(big ? 180 : 220, 38, big ? 0.45 : 0.25, 'sine', 0.4);
  }

  pickup(combo) {
    const base = 620 + Math.min(combo, 8) * 60;
    this.tone(base, base * 1.5, 0.09, 'sine', 0.16);
  }

  power() {
    this.tone(523, 523, 0.1, 'triangle', 0.18);
    setTimeout(() => this.tone(659, 659, 0.1, 'triangle', 0.18), 70);
    setTimeout(() => this.tone(784, 784, 0.16, 'triangle', 0.2), 140);
  }

  hit() {
    this.noise(0.22, 700, 0.4);
    this.tone(200, 55, 0.22, 'sawtooth', 0.3);
  }

  bossHit() {
    this.tone(1400, 900, 0.06, 'triangle', 0.12);
  }

  waveClear() {
    this.tone(392, 392, 0.12, 'triangle', 0.16);
    setTimeout(() => this.tone(587, 587, 0.2, 'triangle', 0.18), 110);
  }

  start() {
    this.tone(220, 880, 0.35, 'sawtooth', 0.1);
  }

  gameOver() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, n * 0.94, 0.3, 'triangle', 0.2), i * 170));
  }

  // Quiet low drone under gameplay; started once, stopped on game over.
  startDrone() {
    if (!this.ctx || this.muted || this.drone) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    osc2.type = 'sine';
    osc2.frequency.value = 55.7;
    amp.gain.value = 0.035;
    osc.connect(amp);
    osc2.connect(amp);
    amp.connect(this.master);
    osc.start();
    osc2.start();
    this.drone = { osc, osc2, amp };
  }

  stopDrone() {
    if (!this.drone) return;
    try {
      this.drone.amp.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      this.drone.osc.stop(this.ctx.currentTime + 0.3);
      this.drone.osc2.stop(this.ctx.currentTime + 0.3);
    } catch (e) {
      /* already stopped */
    }
    this.drone = null;
  }
}
