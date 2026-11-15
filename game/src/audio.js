// EMBER DRIFT — audio.js
// All sound is synthesised live with WebAudio: no audio files, no network.
// A quiet synthwave bass pulse runs under play; every action has a blip.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.muted = false;
    this.musicStep = 0;
  }

  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.5;
    this.masterGain.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = 0.12;
    this.musicGain.connect(this.masterGain);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  playTone({ frequency, endFrequency, duration, type, volume, when = 0 }) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime + when;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    }
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  shoot() {
    this.playTone({ frequency: 880, endFrequency: 220, duration: 0.09, type: 'square', volume: 0.12 });
  }

  explosion(big = false) {
    this.playTone({ frequency: big ? 160 : 220, endFrequency: 40, duration: big ? 0.6 : 0.35, type: 'sawtooth', volume: big ? 0.35 : 0.22 });
    this.playTone({ frequency: 90, endFrequency: 30, duration: 0.4, type: 'triangle', volume: 0.25 });
  }

  collect(comboStep) {
    const base = 520 + Math.min(comboStep, 12) * 40;
    this.playTone({ frequency: base, endFrequency: base * 1.5, duration: 0.12, type: 'sine', volume: 0.2 });
  }

  powerup() {
    this.playTone({ frequency: 440, duration: 0.1, type: 'sine', volume: 0.2 });
    this.playTone({ frequency: 660, duration: 0.12, type: 'sine', volume: 0.2, when: 0.09 });
    this.playTone({ frequency: 880, duration: 0.16, type: 'sine', volume: 0.2, when: 0.18 });
  }

  hit() {
    this.playTone({ frequency: 140, endFrequency: 60, duration: 0.3, type: 'sawtooth', volume: 0.3 });
  }

  waveClear() {
    [523, 659, 784].forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.14, type: 'triangle', volume: 0.18, when: index * 0.1 });
    });
  }

  bossAlarm() {
    this.playTone({ frequency: 98, endFrequency: 98, duration: 0.5, type: 'sawtooth', volume: 0.25 });
    this.playTone({ frequency: 147, endFrequency: 147, duration: 0.5, type: 'sawtooth', volume: 0.2, when: 0.5 });
  }

  startMusic() {
    if (!this.context || this.musicTimer) return;
    const bassline = [55, 0, 55, 0, 65.41, 0, 49, 0, 55, 0, 55, 0, 82.41, 0, 73.42, 0];
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const note = bassline[this.musicStep % bassline.length];
      this.musicStep += 1;
      if (note > 0) {
        const now = this.context.currentTime;
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(note, now);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        oscillator.connect(gain);
        gain.connect(this.musicGain);
        oscillator.start(now);
        oscillator.stop(now + 0.25);
      }
    }, 150);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
