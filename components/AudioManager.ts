
export class AudioManager {
  private ctx: AudioContext | null = null;
  
  // Nodes for various effects
  private masterGain: GainNode | null = null;
  
  // Wind (Base for all seasons)
  private windOsc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  // Summer Insects
  private insectOsc: OscillatorNode | null = null;
  private insectGain: GainNode | null = null;
  private insectLFO: OscillatorNode | null = null;

  // Autumn Rustle
  private rustleFilter: BiquadFilterNode | null = null;
  private rustleGain: GainNode | null = null;

  // Winter Howl
  private howlOsc: OscillatorNode | null = null;
  private howlGain: GainNode | null = null;

  constructor() {
    // Initialized on user interaction
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
    this.setupWind();
    this.setupInsects();
    this.setupWinterHowl();
  }

  // --- Generators ---

  private createWhiteNoise() {
    if (!this.ctx) return null;
    const bufferSize = 2 * this.ctx.sampleRate;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  private setupWind() {
    if (!this.ctx || !this.masterGain) return;
    
    const noiseBuffer = this.createWhiteNoise();
    if (!noiseBuffer) return;

    this.windOsc = this.ctx.createBufferSource();
    this.windOsc.buffer = noiseBuffer;
    this.windOsc.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.1; // Base volume

    this.windOsc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    
    this.windOsc.start();
  }

  private setupInsects() {
    if (!this.ctx || !this.masterGain) return;

    // High pitched sine wave modulated by an LFO to create buzzing
    this.insectOsc = this.ctx.createOscillator();
    this.insectOsc.type = 'sawtooth';
    this.insectOsc.frequency.value = 4000;

    this.insectGain = this.ctx.createGain();
    this.insectGain.gain.value = 0;

    // LFO for buzzing amplitude
    this.insectLFO = this.ctx.createOscillator();
    this.insectLFO.type = 'sine';
    this.insectLFO.frequency.value = 30; // 30Hz flutter
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 500; // Modulate frequency slightly? No, let's modulate amplitude.
    
    // Connect AM Synthesis
    // Oscillator -> Gain (Modulated by LFO) -> Master
    this.insectOsc.connect(this.insectGain);
    this.insectGain.connect(this.masterGain);
    
    this.insectOsc.start();
  }

  private setupWinterHowl() {
    if (!this.ctx || !this.masterGain) return;

    // Resonant filter sweep on noise
    const noiseBuffer = this.createWhiteNoise();
    if (!noiseBuffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 10; // High resonance for whistling
    filter.frequency.value = 400;

    this.howlGain = this.ctx.createGain();
    this.howlGain.gain.value = 0;

    src.connect(filter);
    filter.connect(this.howlGain);
    this.howlGain.connect(this.masterGain);
    src.start();

    // Automate the howl frequency
    setInterval(() => {
        if (this.ctx && filter && this.howlGain && this.howlGain.gain.value > 0.01) {
            const t = this.ctx.currentTime;
            filter.frequency.exponentialRampToValueAtTime(300 + Math.random() * 500, t + 2 + Math.random() * 2);
        }
    }, 4000);
  }

  // --- Control ---

  setSeason(season: 'spring' | 'summer' | 'autumn' | 'winter') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const transTime = 2.0;

    // Default settings
    let windVol = 0.1;
    let windFreq = 400;
    let insectVol = 0.0;
    let howlVol = 0.0;

    switch(season) {
      case 'spring':
        windVol = 0.2;
        windFreq = 600; // Light breeze
        insectVol = 0.02; // Very faint
        howlVol = 0.0;
        break;
      case 'summer':
        windVol = 0.1;
        windFreq = 300;
        insectVol = 0.15; // Loud cicadas
        howlVol = 0.0;
        break;
      case 'autumn':
        windVol = 0.4;
        windFreq = 150; // Deep blustery wind
        insectVol = 0.0;
        howlVol = 0.05; // Slight whistle
        break;
      case 'winter':
        windVol = 0.6; // Strong wind
        windFreq = 200; 
        insectVol = 0.0;
        howlVol = 0.2; // Loud howling
        break;
    }

    // Apply
    if (this.windGain) this.windGain.gain.setTargetAtTime(windVol, t, 1);
    if (this.windFilter) this.windFilter.frequency.setTargetAtTime(windFreq, t, 1);
    if (this.insectGain) this.insectGain.gain.setTargetAtTime(insectVol, t, 1);
    if (this.howlGain) this.howlGain.gain.setTargetAtTime(howlVol, t, 1);
  }

  playBirdSound() {
    if (!this.ctx || !this.masterGain) return;
    // ... existing bird logic ...
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const type = Math.floor(Math.random() * 3);
    if (type === 0) {
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.1);
        osc.frequency.exponentialRampToValueAtTime(2500, t + 0.2);
    } else if (type === 1) {
        osc.frequency.setValueAtTime(1500, t);
        osc.frequency.linearRampToValueAtTime(1800, t + 0.05);
        osc.frequency.linearRampToValueAtTime(1500, t + 0.1);
    } else {
        osc.frequency.setValueAtTime(1200, t);
        osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.4);
  }
}
