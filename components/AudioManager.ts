
export class AudioManager {
  private ctx: AudioContext | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;

  constructor() {
    // Initialized on user interaction
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.setupWind();
  }

  private setupWind() {
    if (!this.ctx) return;
    
    // Create White Noise
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = noiseBuffer;
    this.windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 200; // Muffled start

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    
    this.windSource.start();
  }

  setWindIntensity(level: 0 | 1 | 2 | 3) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;

    const now = this.ctx.currentTime;
    let gain = 0;
    let freq = 200;

    switch(level) {
      case 1: gain = 0.1; freq = 400; break;
      case 2: gain = 0.3; freq = 800; break;
      case 3: gain = 0.8; freq = 1200; break;
      default: gain = 0; freq = 200;
    }

    this.windGain.gain.setTargetAtTime(gain, now, 0.5);
    this.windFilter.frequency.setTargetAtTime(freq, now, 0.5);
  }

  playBirdSound() {
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Randomize bird characteristics
    const type = Math.floor(Math.random() * 3);
    
    if (type === 0) {
        // High chirp
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.1);
        osc.frequency.exponentialRampToValueAtTime(2500, t + 0.2);
    } else if (type === 1) {
        // Tweet
        osc.frequency.setValueAtTime(1500, t);
        osc.frequency.linearRampToValueAtTime(1800, t + 0.05);
        osc.frequency.linearRampToValueAtTime(1500, t + 0.1);
    } else {
        // Call
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 0.4);
  }
}
