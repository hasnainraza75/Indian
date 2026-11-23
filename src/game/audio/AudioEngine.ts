import { EngineSoundProfile, SoundSettings, WeatherType, WeaponId } from '../types';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private envGain: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineSubGain: GainNode | null = null;

  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private rainGain: GainNode | null = null;
  private skidGain: GainNode | null = null;

  private musicTimer: number | null = null;
  private musicStep = 0;

  private settings: SoundSettings = {
    engine: 0.85,
    environment: 0.7,
    effects: 0.85,
    music: 0.4,
    muted: false
  };

  private initialized = false;
  private suspended = false;
  private lastGear = 1;

  initOnUserGesture(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended' && !this.suspended) {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      this.ctx = ctx;

      this.masterGain = ctx.createGain();
      this.engineGain = ctx.createGain();
      this.envGain = ctx.createGain();
      this.fxGain = ctx.createGain();
      this.musicGain = ctx.createGain();

      this.engineGain.connect(this.masterGain);
      this.envGain.connect(this.masterGain);
      this.fxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(ctx.destination);

      this.setupEngineSynth(ctx);
      this.setupSirenSynth(ctx);
      this.setupNoiseBeds(ctx);
      this.startAmbientMusicLoop();

      this.initialized = true;
      this.applySettings(this.settings);
    } catch {
      // Web Audio unavailable
    }
  }

  private setupEngineSynth(ctx: AudioContext): void {
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc2 = ctx.createOscillator();
    this.engineFilter = ctx.createBiquadFilter();
    this.engineSubGain = ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.value = 55;
    this.engineOsc2.frequency.value = 110;

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 280;
    this.engineFilter.Q.value = 2.8;

    this.engineSubGain.gain.value = 0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineSubGain);
    if (this.engineGain) {
      this.engineSubGain.connect(this.engineGain);
    }
    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  private setupSirenSynth(ctx: AudioContext): void {
    this.sirenOsc = ctx.createOscillator();
    this.sirenGain = ctx.createGain();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    if (this.envGain) {
      this.sirenGain.connect(this.envGain);
    }
    this.sirenOsc.start();
  }

  private setupNoiseBeds(ctx: AudioContext): void {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Rain ambient bed
    const rainSource = ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 1100;
    rainFilter.Q.value = 0.7;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    if (this.envGain) this.rainGain.connect(this.envGain);
    rainSource.start();

    // Tire skid bed
    const skidSource = ctx.createBufferSource();
    skidSource.buffer = buffer;
    skidSource.loop = true;
    const skidFilter = ctx.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1850;
    skidFilter.Q.value = 4.5;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    skidSource.connect(skidFilter);
    skidFilter.connect(this.skidGain);
    if (this.fxGain) this.skidGain.connect(this.fxGain);
    skidSource.start();
  }

  private startAmbientMusicLoop(): void {
    if (this.musicTimer !== null) return;
    // Atmospheric procedural bassline & synth pulse (original, non-copyrighted)
    const bassNotes = [55, 55, 65.41, 73.42, 49, 49, 61.74, 65.41];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.suspended || this.settings.muted || this.settings.music < 0.02) {
        return;
      }
      const now = this.ctx.currentTime;
      const freq = bassNotes[this.musicStep % bassNotes.length];
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = this.musicStep % 2 === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.35);

      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.11, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.musicGain);
      osc.start(now);
      osc.stop(now + 0.44);
      this.musicStep++;
    }, 450);
  }

  applySettings(settings: SoundSettings): void {
    this.settings = { ...settings };
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(settings.muted ? 0 : 1, now, 0.05);
    this.engineGain?.gain.setTargetAtTime(settings.engine * 0.55, now, 0.05);
    this.envGain?.gain.setTargetAtTime(settings.environment * 0.55, now, 0.05);
    this.fxGain?.gain.setTargetAtTime(settings.effects * 0.65, now, 0.05);
    this.musicGain?.gain.setTargetAtTime(settings.music * 0.4, now, 0.05);
  }

  setPaused(paused: boolean): void {
    this.suspended = paused;
    if (!this.ctx) return;
    if (paused) {
      this.ctx.suspend().catch(() => {});
    } else {
      this.ctx.resume().catch(() => {});
    }
  }

  updateVehicleAudio(
    active: boolean,
    profile: EngineSoundProfile,
    rpmNorm: number,
    throttle: boolean,
    gear: number,
    skidIntensity: number
  ): void {
    if (!this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineSubGain) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || profile === 'silent') {
      this.engineSubGain.gain.setTargetAtTime(0, now, 0.08);
      this.skidGain?.gain.setTargetAtTime(0, now, 0.06);
      this.lastGear = 1;
      return;
    }

    if (gear > this.lastGear && gear > 1) {
      this.playGearShift();
    }
    this.lastGear = gear;

    let baseHz = 48;
    let maxHz = 180;
    let wave1: OscillatorType = 'sawtooth';
    let wave2: OscillatorType = 'triangle';
    let filterHz = 360;
    let vol = 0.28;

    switch (profile) {
      case 'bullet':
        baseHz = 28;
        maxHz = 88;
        wave1 = 'sawtooth';
        wave2 = 'square';
        filterHz = 240;
        vol = 0.34;
        break;
      case 'sport_bike':
        baseHz = 72;
        maxHz = 295;
        wave1 = 'sawtooth';
        wave2 = 'sawtooth';
        filterHz = 680;
        vol = 0.25;
        break;
      case 'supercar':
        baseHz = 62;
        maxHz = 265;
        wave1 = 'sawtooth';
        wave2 = 'triangle';
        filterHz = 620;
        vol = 0.28;
        break;
      case 'muscle':
        baseHz = 38;
        maxHz = 148;
        wave1 = 'sawtooth';
        wave2 = 'square';
        filterHz = 320;
        vol = 0.32;
        break;
      case 'suv':
        baseHz = 44;
        maxHz = 145;
        filterHz = 290;
        vol = 0.26;
        break;
      case 'diesel':
        baseHz = 30;
        maxHz = 95;
        wave1 = 'square';
        wave2 = 'sawtooth';
        filterHz = 210;
        vol = 0.33;
        break;
      case 'electric':
        baseHz = 140;
        maxHz = 620;
        wave1 = 'sine';
        wave2 = 'triangle';
        filterHz = 1400;
        vol = 0.18;
        break;
      case 'helicopter':
        baseHz = 14;
        maxHz = 28;
        wave1 = 'square';
        wave2 = 'sawtooth';
        filterHz = 190;
        vol = 0.36;
        break;
      case 'plane':
        baseHz = 95;
        maxHz = 310;
        wave1 = 'sawtooth';
        wave2 = 'sine';
        filterHz = 540;
        vol = 0.26;
        break;
      case 'boat':
        baseHz = 42;
        maxHz = 140;
        wave1 = 'triangle';
        wave2 = 'sawtooth';
        filterHz = 340;
        vol = 0.25;
        break;
      case 'creature':
        baseHz = 36;
        maxHz = 82;
        wave1 = 'triangle';
        wave2 = 'sine';
        filterHz = 180;
        vol = 0.22;
        break;
    }

    if (this.engineOsc1.type !== wave1) this.engineOsc1.type = wave1;
    if (this.engineOsc2.type !== wave2) this.engineOsc2.type = wave2;

    const pitch = baseHz + (maxHz - baseHz) * Math.min(1, Math.max(0, rpmNorm));
    this.engineOsc1.frequency.setTargetAtTime(pitch, now, 0.04);
    this.engineOsc2.frequency.setTargetAtTime(pitch * (profile === 'electric' ? 2.0 : 1.5), now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(filterHz + rpmNorm * 480 + (throttle ? 140 : 0), now, 0.05);
    this.engineSubGain.gain.setTargetAtTime(vol * (throttle ? 1.0 : 0.65), now, 0.06);

    if (this.skidGain) {
      this.skidGain.gain.setTargetAtTime(Math.min(0.26, skidIntensity * 0.25), now, 0.04);
    }
  }

  updateEnvironmentAudio(
    weather: WeatherType,
    nearestPoliceDist: number,
    policeRelativeSpeed: number,
    timeSec: number
  ): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.rainGain) {
      const targetRain = weather === 'rain' ? 0.14 : weather === 'thunderstorm' ? 0.22 : 0;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.25);
    }

    if (this.sirenOsc && this.sirenGain) {
      if (nearestPoliceDist < 130) {
        const proximity = Math.max(0, 1 - nearestPoliceDist / 130);
        // Doppler shift factor
        const doppler = 1 + Math.max(-0.18, Math.min(0.18, policeRelativeSpeed / 120));
        const wail = 620 + Math.sin(timeSec * 4.5) * 210;
        this.sirenOsc.frequency.setTargetAtTime(wail * doppler, now, 0.04);
        this.sirenGain.gain.setTargetAtTime(proximity * 0.16, now, 0.08);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  playEngineStart(): void {
    if (!this.ctx || !this.engineGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(34, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.32);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.55);
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
    osc.connect(g);
    g.connect(this.engineGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  playGearShift(): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
    g.gain.setValueAtTime(0.12, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(g);
    g.connect(this.fxGain);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  playHorn(isHeavy = false): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    const freqs = isHeavy ? [185, 233] : [390, 495];
    freqs.forEach((f) => {
      if (!this.ctx || !this.fxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = isHeavy ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(g);
      g.connect(this.fxGain);
      osc.start(now);
      osc.stop(now + 0.3);
    });
  }

  playCollision(intensity = 0.6): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.24);
    g.gain.setValueAtTime(Math.min(0.45, 0.14 + intensity * 0.3), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.fxGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playWeaponFire(weapon: WeaponId): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();

    if (weapon === 'fists') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.12);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc.connect(g);
      g.connect(this.fxGain);
      osc.start(now);
      osc.stop(now + 0.14);
      return;
    }

    if (weapon === 'electric_blaster') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(980, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.18);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(g);
      g.connect(this.fxGain);
      osc.start(now);
      osc.stop(now + 0.21);
      return;
    }

    const startHz = weapon === 'launcher' ? 220 : weapon === 'shotgun' ? 320 : 540;
    const dur = weapon === 'launcher' ? 0.35 : weapon === 'shotgun' ? 0.22 : 0.13;
    osc.type = 'square';
    osc.frequency.setValueAtTime(startHz, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + dur);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.fxGain);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  playReload(): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    [0, 0.22].forEach((offset, idx) => {
      if (!this.ctx || !this.fxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(idx === 0 ? 480 : 720, now + offset);
      g.gain.setValueAtTime(0.14, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
      osc.connect(g);
      g.connect(this.fxGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  playExplosion(): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 0.65);
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(g);
    g.connect(this.fxGain);
    osc.start(now);
    osc.stop(now + 0.72);
  }

  playThunder(): void {
    if (!this.ctx || !this.envGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 1.4);
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(g);
    g.connect(this.envGain);
    osc.start(now);
    osc.stop(now + 1.55);
  }

  playUiSuccess(isCheat = false): void {
    if (!this.ctx || !this.fxGain) return;
    const now = this.ctx.currentTime;
    const notes = isCheat ? [523.25, 659.25, 783.99, 1046.5] : [440, 587.33];
    notes.forEach((f, idx) => {
      if (!this.ctx || !this.fxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      g.gain.setValueAtTime(0.14, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
      osc.connect(g);
      g.connect(this.fxGain);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.2);
    });
  }

  dispose(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.initialized = false;
  }
}
