// Procedural WebAudio — zero external files. One AudioContext, resumed on the
// first gesture; engine hum follows speed, plus siren, shots, thuds, chimes and
// mission stings. Everything is guarded: headless browsers without audio just
// stay silent instead of throwing.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: sawtooth through a low-pass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two-tone square wave, LFO flips the pitch.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 750;
      sirenLfo = ctx.createOscillator();
      sirenLfo.frequency.value = 0.9;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBurst(duration, filterFreq, volume, type = 'lowpass') {
    if (!ensure()) return;
    resume();
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function tone(freq, duration, volume, type = 'sine', when = 0) {
    if (!ensure()) return;
    resume();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  return {
    unlock() { ensure(); resume(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() { return muted; },
    engine(speed01) {
      if (!ensure()) return;
      resume();
      engineGain.gain.value = 0.03 + speed01 * 0.06;
      engineOsc.frequency.value = 52 + speed01 * 130;
      engineFilter.frequency.value = 380 + speed01 * 900;
    },
    engineOff() {
      if (engineGain) engineGain.gain.value = 0;
    },
    siren(on) {
      if (!ensure()) return;
      resume();
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
    },
    shot(kind, volume = 1) {
      if (kind === 'shotgun') noiseBurst(0.22, 900, 0.5 * volume);
      else if (kind === 'smg') noiseBurst(0.08, 2400, 0.3 * volume, 'bandpass');
      else if (kind === 'pistol') noiseBurst(0.12, 1600, 0.4 * volume, 'bandpass');
      else noiseBurst(0.06, 800, 0.25 * volume);
      tone(90, 0.08, 0.25 * volume, 'sine');
    },
    thud() { noiseBurst(0.12, 300, 0.4); },
    punch() { noiseBurst(0.08, 500, 0.35); },
    hurt() { tone(180, 0.18, 0.25, 'sawtooth'); },
    chime() { tone(880, 0.18, 0.3); tone(1318, 0.3, 0.3, 'sine', 0.09); },
    click() { tone(660, 0.06, 0.2, 'square'); },
    door() { noiseBurst(0.09, 700, 0.25); tone(140, 0.09, 0.2, 'sine'); },
    down() { tone(220, 0.3, 0.3, 'sawtooth'); tone(165, 0.4, 0.3, 'sawtooth', 0.12); },
    honk() { tone(370, 0.35, 0.25, 'square'); tone(466, 0.35, 0.2, 'square'); },
    sting(kind) {
      if (kind === 'complete') {
        tone(523, 0.16, 0.3);
        tone(659, 0.16, 0.3, 'sine', 0.12);
        tone(784, 0.4, 0.35, 'sine', 0.24);
      } else {
        tone(392, 0.14, 0.25);
        tone(523, 0.22, 0.25, 'sine', 0.1);
      }
    },
  };
}
