// Procedural WebAudio — zero external files. One AudioContext, resumed on first gesture;
// engine hum follows speed, sirens wail, shots crack, stings mark mission beats.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = filterFreq || 1200;
      const g = ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  return {
    resume,
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; },
    get muted() { return muted; },
    click() { blip(660, 0.06, 'square', 0.12); },
    engine(speed01) {
      if (!ensure() || muted) { if (engineGain) engineGain.gain.value = 0; return; }
      engineOsc.frequency.value = 50 + speed01 * 130;
      engineGain.gain.value = 0.02 + speed01 * 0.05;
    },
    shot(kind) {
      if (kind === 'shotgun') { noise(0.22, 0.5, 700); blip(120, 0.18, 'sine', 0.4, 45); }
      else if (kind === 'smg') { noise(0.09, 0.3, 1800); blip(200, 0.07, 'square', 0.18, 90); }
      else { noise(0.12, 0.35, 1400); blip(170, 0.1, 'square', 0.22, 70); }
    },
    punch() { noise(0.08, 0.3, 500); },
    impact() { noise(0.15, 0.35, 300); blip(90, 0.15, 'sine', 0.3, 40); },
    pickup() { blip(880, 0.12, 'sine', 0.25); setTimeout(() => blip(1320, 0.16, 'sine', 0.25), 90); },
    missionDone() {
      blip(523, 0.14, 'triangle', 0.3);
      setTimeout(() => blip(659, 0.14, 'triangle', 0.3), 130);
      setTimeout(() => blip(784, 0.26, 'triangle', 0.32), 260);
    },
    fail() { blip(330, 0.25, 'sawtooth', 0.2, 165); },
    siren(dt) {
      if (!ensure() || muted) return;
      sirenTimer += dt;
      const phase = Math.floor(sirenTimer * 2.2) % 2;
      blip(phase ? 720 : 540, 0.22, 'sine', 0.05);
    },
    horn() { blip(370, 0.18, 'square', 0.12); setTimeout(() => blip(440, 0.18, 'square', 0.1), 20); },
  };
}
