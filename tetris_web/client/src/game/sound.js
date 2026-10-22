// Cyber-System Web Audio Synthesizer for Tetris

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type = 'sine', duration = 0.08, gainValue = 0.12, slideTo = null) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    }

    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  move() {
    this.playTone(320, 'triangle', 0.04, 0.07, 260);
  }

  rotate(isSpin = false) {
    if (isSpin) {
      this.playTone(520, 'sawtooth', 0.12, 0.14, 880);
      setTimeout(() => this.playTone(1040, 'sine', 0.1, 0.12, 1320), 35);
    } else {
      this.playTone(460, 'sine', 0.055, 0.09, 620);
    }
  }

  softDrop() {
    this.playTone(220, 'sine', 0.03, 0.05, 180);
  }

  hardDrop() {
    this.playTone(180, 'triangle', 0.11, 0.18, 55);
  }

  hold() {
    this.playTone(380, 'sine', 0.06, 0.09, 540);
  }

  clear(lines, spinType, ren = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const baseNotes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    const renBoost = Math.min(ren, 12) * 35;

    if (spinType || lines >= 4) {
      // Cyber chord arpeggio for Spins / Tetris
      baseNotes.slice(0, Math.min(lines + 2, 5)).forEach((note, idx) => {
        setTimeout(() => {
          this.playTone(note + renBoost, 'sawtooth', 0.18, 0.13, (note + renBoost) * 1.08);
        }, idx * 45);
      });
    } else {
      baseNotes.slice(0, lines + 1).forEach((note, idx) => {
        setTimeout(() => {
          this.playTone(note + renBoost, 'triangle', 0.14, 0.11);
        }, idx * 40);
      });
    }
  }

  uiClick() {
    this.playTone(660, 'sine', 0.05, 0.08, 880);
  }

  uiSelect() {
    this.playTone(540, 'triangle', 0.07, 0.1, 720);
  }

  gameOver() {
    [400, 350, 300, 220].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 'sawtooth', 0.22, 0.12, freq * 0.85);
      }, idx * 110);
    });
  }
}

export const sound = new SoundManager();
