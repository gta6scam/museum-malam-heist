// Suara WebAudio murni synth — tanpa file audio eksternal.
// Langkah kaki, ambil loot, sting alarm, koin pengalih, fanfare menang/kalah,
// dan drone ambient malam museum. M = mute.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = null;
    this.lastStep = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
      return true;
    } catch (err) {
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  startAmbient() {
    // Drone malam: dua sine rendah + LFO pelan, nyaris tak terdengar.
    const oscA = this.ctx.createOscillator();
    const oscB = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    oscA.type = 'sine';
    oscA.frequency.value = 55;
    oscB.type = 'sine';
    oscB.frequency.value = 82.4;
    gain.gain.value = 0.035;
    lfo.type = 'sine';
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    oscA.connect(gain);
    oscB.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    lfo.start();
    this.ambientNodes = { oscA, oscB, lfo };
  }

  step(now) {
    if (!this.ctx || now - this.lastStep < 0.34) return;
    this.lastStep = now;
    this.noise(0.07, 0.05, 900);
  }

  pickup() {
    this.tone(523.25, 0.14, 'triangle', 0.22);
    this.tone(659.25, 0.14, 'triangle', 0.22, 0.09);
    this.tone(783.99, 0.28, 'triangle', 0.26, 0.18);
  }

  decoy() {
    this.tone(1318.5, 0.1, 'sine', 0.2);
    this.tone(1760, 0.16, 'sine', 0.16, 0.08);
  }

  alarmSting() {
    this.tone(440, 0.22, 'sawtooth', 0.16, 0, 622);
    this.tone(440, 0.22, 'sawtooth', 0.16, 0.24, 622);
  }

  caught() {
    this.tone(220, 0.5, 'sawtooth', 0.22, 0, 110);
    this.noise(0.35, 0.18, 500);
  }

  exitOpen() {
    this.tone(392, 0.16, 'triangle', 0.2);
    this.tone(523.25, 0.16, 'triangle', 0.2, 0.12);
    this.tone(659.25, 0.3, 'triangle', 0.22, 0.24);
  }

  win() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.tone(f, 0.34, 'triangle', 0.24, i * 0.14));
    this.tone(1318.5, 0.6, 'triangle', 0.2, 0.6);
  }

  lose() {
    const notes = [392, 329.63, 261.63, 196];
    notes.forEach((f, i) => this.tone(f, 0.4, 'sawtooth', 0.14, i * 0.18));
  }
}
