/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private isInitialized = false;
  private isMuted = false;
  private pulseInterval: any = null;

  private boostGain: GainNode | null = null;
  private boostOsc: OscillatorNode | null = null;

  init() {
    if (this.isInitialized) {
      if (this.ctx?.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }
    
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3;

      this.startAmbient();
      this.setupBoost();
      this.isInitialized = true;
    } catch (e) {
      console.error('Failed to initialize audio context', e);
    }
  }

  private setupBoost() {
    if (!this.ctx || !this.masterGain) return;
    
    this.boostGain = this.ctx.createGain();
    this.boostGain.gain.value = 0;
    this.boostGain.connect(this.masterGain);

    this.boostOsc = this.ctx.createOscillator();
    this.boostOsc.type = 'sawtooth';
    this.boostOsc.frequency.value = 80;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    this.boostOsc.connect(filter);
    filter.connect(this.boostGain);
    this.boostOsc.start();
  }

  private startAmbient() {
    if (!this.ctx || !this.masterGain) return;

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.05;
    this.ambientGain.connect(this.masterGain);

    this.ambientOsc = this.ctx.createOscillator();
    this.ambientOsc.type = 'triangle';
    this.ambientOsc.frequency.value = 55; // A1
    
    const lpf = this.ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 300;
    lpf.Q.value = 5;

    this.ambientOsc.connect(lpf);
    lpf.connect(this.ambientGain);

    this.ambientOsc.start();

    // Subtle neon pulse
    const pulse = () => {
      if (!this.ctx || !this.ambientGain || this.isMuted) return;
      const now = this.ctx.currentTime;
      this.ambientGain.gain.setTargetAtTime(0.08, now, 0.4);
      this.ambientGain.gain.setTargetAtTime(0.04, now + 1.5, 0.8);
    };
    
    pulse();
    this.pulseInterval = setInterval(pulse, 3000);
  }

  playCollect() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state !== 'running') this.ctx.resume();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playCrash() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    if (this.ctx.state !== 'running') this.ctx.resume();

    const now = this.ctx.currentTime;
    
    // Noise for crash impact
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(20, now + 0.3);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    
    noise.start(now);
    noise.stop(now + 0.3);

    // Low thud
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  playBoost(active: boolean) {
    if (!this.ctx || !this.boostGain || this.isMuted) return;
    const now = this.ctx.currentTime;
    this.boostGain.gain.setTargetAtTime(active ? 0.1 : 0, now, 0.1);
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.3, this.ctx.currentTime, 0.1);
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  getPulseIntensity() {
    if (!this.ctx || this.isMuted) return 0;
    // Return a value that pulses based on time, sync'd with the startAmbient loop
    const time = this.ctx.currentTime;
    const cycle = time % 3; // 3 second cycle from startAmbient
    if (cycle < 0.5) return cycle / 0.5;
    if (cycle < 1.5) return 1 - (cycle - 0.5) / 1.0;
    return 0;
  }
}

export const audioManager = new AudioManager();
