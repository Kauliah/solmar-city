// Solmar City — procedural WebAudio: engine hum that follows speed, skid
// screech, two-tone siren, per-weapon gunshots, thuds, chimes and mission
// stings. Zero external files; one AudioContext, resumed on first gesture.
import { WEAPONS } from './config.js';

export function createAudio(G) {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    muted: false,
    sirenTimer: 0,
  };
  window.addEventListener('solmar-mute', () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  });
  // Browsers only let audio start after a gesture: resume then, not before.
  const resume = () => {
    if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {});
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  return audio;
}

function ensure(G) {
  const a = G.audio;
  if (a.ctx) return a.ctx.state === 'running';
  try {
    a.ctx = new (window.AudioContext || window.webkitAudioContext)();
    a.master = a.ctx.createGain();
    a.master.gain.value = a.muted ? 0 : 0.5;
    a.master.connect(a.ctx.destination);
    // Engine: a low sawtooth whose pitch follows the player's speed.
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 50;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const filter = a.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;
    a.engineOsc.connect(filter);
    filter.connect(a.engineGain);
    a.engineGain.connect(a.master);
    a.engineOsc.start();
    return a.ctx.state === 'running';
  } catch {
    return false;
  }
}

function noiseBurst(G, duration, freq, gain) {
  const a = G.audio;
  if (!ensure(G) || a.muted) return;
  const len = Math.floor(a.ctx.sampleRate * duration);
  const buf = a.ctx.createBuffer(1, len, a.ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.ctx.createBufferSource();
  src.buffer = buf;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  const g = a.ctx.createGain();
  g.gain.value = gain;
  src.connect(filter);
  filter.connect(g);
  g.connect(a.master);
  src.start();
}

function tone(G, freq, duration, type, gain, slideTo) {
  const a = G.audio;
  if (!ensure(G) || a.muted) return;
  const osc = a.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.ctx.currentTime + duration);
  const g = a.ctx.createGain();
  g.gain.setValueAtTime(gain, a.ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, a.ctx.currentTime + duration);
  osc.connect(g);
  g.connect(a.master);
  osc.start();
  osc.stop(a.ctx.currentTime + duration);
}

export function updateEngine(G) {
  const a = G.audio;
  if (!a.ctx || a.muted || a.ctx.state !== 'running') return;
  const car = G.player.car;
  const speed = car ? Math.abs(car.speed) : 0;
  const target = car ? 0.05 + (speed / car.def.topSpeed) * 0.12 : 0;
  a.engineGain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.1);
  a.engineOsc.frequency.setTargetAtTime(50 + speed * 4, a.ctx.currentTime, 0.1);
  // Skid screech while handbraking at speed.
  if (car && G.input.handbrake() && speed > 10 && Math.random() < 0.3) {
    noiseBurst(G, 0.15, 900, 0.08);
  }
}

export function shot(G, weapon, distant = false) {
  const w = WEAPONS[weapon] ?? WEAPONS.pistol;
  noiseBurst(G, weapon === 'shotgun' ? 0.3 : 0.12, weapon === 'smg' ? 2400 : 1600, distant ? 0.1 : 0.35);
  tone(G, 120, 0.1, 'sine', distant ? 0.08 : 0.25, 40);
}

export function swing(G) { noiseBurst(G, 0.1, 1200, 0.12); }
export function hit(G) { tone(G, 900, 0.06, 'square', 0.15); }
export function thud(G) { noiseBurst(G, 0.18, 300, 0.3); tone(G, 70, 0.15, 'sine', 0.3, 35); }
export function chime(G) { tone(G, 880, 0.15, 'sine', 0.2); setTimeout(() => tone(G, 1320, 0.2, 'sine', 0.2), 90); }
export function click(G) { tone(G, 600, 0.05, 'square', 0.12); }
export function door(G) { thud(G); }
export function hurt(G) { tone(G, 200, 0.2, 'sawtooth', 0.2, 90); }
export function honk(G) { tone(G, 370, 0.25, 'square', 0.15); setTimeout(() => tone(G, 370, 0.2, 'square', 0.15), 120); }

export function siren(G) {
  const a = G.audio;
  if (!ensure(G) || a.muted) return;
  // Two-tone wail: alternate 700/950 Hz every 0.4 s for a few cycles.
  for (let i = 0; i < 6; i += 1) {
    setTimeout(() => tone(G, i % 2 ? 950 : 700, 0.38, 'sine', 0.12), i * 400);
  }
}

export function sting(G, good) {
  if (good) {
    tone(G, 523, 0.15, 'sine', 0.25);
    setTimeout(() => tone(G, 659, 0.15, 'sine', 0.25), 130);
    setTimeout(() => tone(G, 784, 0.3, 'sine', 0.25), 260);
  } else {
    tone(G, 220, 0.3, 'sawtooth', 0.2, 110);
    setTimeout(() => tone(G, 165, 0.4, 'sawtooth', 0.2, 80), 250);
  }
}
