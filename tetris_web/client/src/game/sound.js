// Multi-Profile Web Audio Synthesizer for Tetris
// Supports 'cyber' (default sci-fi synth) and 'pixel' (8-bit square chiptune)

class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.profile = 'cyber'; // 'cyber' | 'pixel'
  }

  setProfile(profileName = 'cyber') {
    this.profile = profileName;
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
    if (this.profile === 'pixel') {
      this.playTone(440, 'square', 0.03, 0.055, 480);
    } else {
      this.playTone(320, 'triangle', 0.04, 0.07, 260);
    }
  }

  rotate(isSpin = false) {
    if (this.profile === 'pixel') {
      if (isSpin) {
        [587.33, 880, 1174.66, 1760].forEach((f, idx) => {
          setTimeout(() => this.playTone(f, 'square', 0.06, 0.09), idx * 28);
        });
      } else {
        this.playTone(520, 'square', 0.04, 0.07, 780);
      }
      return;
    }

    if (isSpin) {
      this.playTone(520, 'sawtooth', 0.12, 0.14, 880);
      setTimeout(() => this.playTone(1040, 'sine', 0.1, 0.12, 1320), 35);
    } else {
      this.playTone(460, 'sine', 0.055, 0.09, 620);
    }
  }

  softDrop() {
    if (this.profile === 'pixel') {
      this.playTone(260, 'square', 0.025, 0.045);
    } else {
      this.playTone(220, 'sine', 0.03, 0.05, 180);
    }
  }

  hardDrop() {
    if (this.profile === 'pixel') {
      this.playTone(240, 'square', 0.085, 0.12, 65);
    } else {
      this.playTone(180, 'triangle', 0.11, 0.18, 55);
    }
  }

  hold() {
    if (this.profile === 'pixel') {
      this.playTone(330, 'square', 0.04, 0.07);
      setTimeout(() => this.playTone(495, 'square', 0.05, 0.07), 35);
    } else {
      this.playTone(380, 'sine', 0.06, 0.09, 540);
    }
  }

  clear(lines, spinType, ren = 0) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const baseNotes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    const renBoost = Math.min(ren, 12) * 35;

    if (this.profile === 'pixel') {
      const count = spinType || lines >= 4 ? 6 : lines + 2;
      baseNotes.slice(0, count).forEach((note, idx) => {
        setTimeout(() => {
          this.playTone(note + renBoost, 'square', 0.09, 0.095);
        }, idx * 38);
      });
      return;
    }

    if (spinType || lines >= 4) {
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
    if (this.profile === 'pixel') {
      this.playTone(880, 'square', 0.035, 0.07);
    } else {
      this.playTone(660, 'sine', 0.05, 0.08, 880);
    }
  }

  uiSelect() {
    if (this.profile === 'pixel') {
      this.playTone(587.33, 'square', 0.045, 0.08);
      setTimeout(() => this.playTone(880, 'square', 0.06, 0.08), 40);
    } else {
      this.playTone(540, 'triangle', 0.07, 0.1, 720);
    }
  }

  gameOver() {
    const wave = this.profile === 'pixel' ? 'square' : 'sawtooth';
    [400, 350, 300, 220].forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, wave, 0.2, 0.1, freq * 0.85);
      }, idx * 110);
    });
  }
}

export const sound = new SoundManager();
