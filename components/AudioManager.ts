
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Melody System
  private currentSeason: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer';
  private isPlaying = false;
  private timerID: number | null = null;

  // Scales (Hz) - Using Major Pentatonic scales for happy vibes
  private scales = {
    // Spring: C Major (Bright, innocent)
    spring: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25], 
    // Summer: G Major (High energy)
    summer: [392.00, 440.00, 493.88, 587.33, 659.25, 783.99], 
    // Autumn: F Major (Warm, slightly lower but still major)
    autumn: [174.61, 220.00, 261.63, 293.66, 349.23, 440.00], 
    // Winter: D Major High (Sparkling/Icy but happy)
    winter: [587.33, 659.25, 739.99, 880.00, 987.77, 1174.66] 
  };

  // Effects
  private reverbNode: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null; 

  constructor() {}

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    
    this.setupReverb();
    
    // Start the happy melody loop
    this.startMelody();
  }

  // --- Melodic Sequencer ---
  private startMelody() {
      if (this.isPlaying) return;
      this.isPlaying = true;
      this.scheduleNote();
  }

  private scheduleNote() {
      if (!this.ctx || !this.masterGain) return;
      
      // Determine speed based on season
      // Summer is fastest, Autumn is slowest (but still happy)
      let minDel = 0.2;
      let maxDel = 0.6;
      
      if (this.currentSeason === 'spring') { minDel = 0.3; maxDel = 0.8; }
      else if (this.currentSeason === 'summer') { minDel = 0.15; maxDel = 0.4; } // Energetic!
      else if (this.currentSeason === 'autumn') { minDel = 0.4; maxDel = 1.0; } // Relaxed
      else if (this.currentSeason === 'winter') { minDel = 0.5; maxDel = 1.2; } // Sparse sparkles

      const delay = minDel + Math.random() * (maxDel - minDel);
      
      this.playRandomNote();

      this.timerID = window.setTimeout(() => this.scheduleNote(), delay * 1000);
  }

  private playRandomNote() {
      if (!this.ctx || !this.masterGain) return;
      
      const scale = this.scales[this.currentSeason];
      // Pick a random note from the scale
      const freq = scale[Math.floor(Math.random() * scale.length)];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Timbre selection
      if (this.currentSeason === 'winter') {
          osc.type = 'sine'; // Bell-like
      } else if (this.currentSeason === 'summer') {
          osc.type = 'triangle'; // Marimba-like
      } else {
          osc.type = 'sine'; // Flute-like
      }

      osc.frequency.value = freq;
      
      const t = this.ctx.currentTime;
      const duration = 1.0;

      // Happy Envelope: Fast attack, exponential decay (Pluck sound)
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02); // Fast attack
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration); // Long tail

      osc.connect(gain);
      gain.connect(this.masterGain);
      if (this.reverbNode) gain.connect(this.reverbNode); // Add reverb for space

      osc.start(t);
      osc.stop(t + duration);
  }

  // --- Effects & Environment ---
  private setupReverb() {
    if (!this.ctx || !this.masterGain) return;
    const duration = 3.0;
    const decay = 3.0;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        const vol = Math.pow(1 - n, decay); 
        left[i] = (Math.random() * 2 - 1) * vol;
        right[i] = (Math.random() * 2 - 1) * vol;
    }

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.2;

    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  }

  // --- Triggers ---
  playGrowthPulse() {
      if(!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Higher pitch pulse for happiness
      osc.frequency.setValueAtTime(220, t); 
      osc.frequency.exponentialRampToValueAtTime(440, t + 0.5); 
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.1);
      gain.gain.linearRampToValueAtTime(0, t + 1.0);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.0);
  }

  playBirdSound(x: number, y: number, z: number) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createPanner();

    panner.panningModel = 'HRTF';
    panner.positionX.value = x;
    panner.positionY.value = y;
    panner.positionZ.value = z;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(2500, t + 0.1);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(this.masterGain);
    if (this.reverbNode) panner.connect(this.reverbNode);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  playLeafHit() {
      if(!this.ctx || !this.masterGain) return;
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.05; 
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for(let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      src.connect(gain);
      gain.connect(this.masterGain);
      src.start(t);
  }

  // --- Main Control ---
  setSeason(season: 'spring' | 'summer' | 'autumn' | 'winter') {
    if (!this.ctx) return;
    this.currentSeason = season;
    const t = this.ctx.currentTime;

    let reverbAmt = 0.2;

    switch(season) {
      case 'spring':
        reverbAmt = 0.2;
        break;
      case 'summer':
        reverbAmt = 0.1;
        break;
      case 'autumn':
        reverbAmt = 0.2;
        break;
      case 'winter':
        reverbAmt = 0.5; // Crystal clear reverb
        break;
    }

    if (this.reverbGain) this.reverbGain.gain.setTargetAtTime(reverbAmt, t, 1);
  }
}
