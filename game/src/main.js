// Solmar City — boot, fixed-step 60 Hz loop, screens, and the debug handle.
// Screens: title (attract mode over the live city), play, pause, busted,
// wasted, how-to. ?shot=start|chase|drive|mission&seed=N stages a screenshot
// scene instead of running the loop.
import * as THREE from 'three';
import { STEP, CARS, POIS, WEAPONS, GARAGE_PRICE } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE } from './input.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { createVehicle, driveVehicle } from './vehicles.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPeds, updatePeds } from './pedestrians.js';
import { createPolice, updatePolice, applyBusted, applyWasted, addHeat } from './police.js';
import { createCombat, updateCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCameraRig } from './camera.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { readSave, writeSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : (Math.random() * 4294967296) | 0;

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2400);
camera.position.set(0, 10, 140);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- the shared game object ---------------------------------------------------
const G = {
  scene, camera, renderer, seed,
  time: 0,
  clockMinutes: 17 * 60 + 30, // Golden hour: 17:30.
  screen: 'title',
  cameraShake: 0,
  busted: false,
  wasted: false,
  gameComplete: false,
  saveData: readSave(),
  input: null, city: null, player: null, cars: [], traffic: [], peds: [],
  police: null, combat: null, missions: null, hud: null, audio: null,
  effects: null, cam: null,
};
G.input = createInput(canvas);
G.city = buildCity(scene, seed);
G.audio = createAudio();
G.effects = createEffects(G);
G.player = createPlayer(G);
G.police = createPolice(G);
G.combat = createCombat(G);
G.missions = createMissions(G);
G.hud = createHud(G);
G.cam = createCameraRig(camera);
G.traffic = createTraffic(G);
G.peds = createPeds(G);

// --- parked cars: Juno's Meridian, the mission cars, then roadside variety ----
function spawnParked() {
  const rng = createRandom(seed + 303);
  const spots = [];
  // Juno's own Meridian, by the spawn point.
  spots.push({ model: 'meridian', x: 12, z: 128, heading: Math.PI, kind: 'owned' });
  // The Vela GT for mission 2, at the Marina.
  spots.push({ model: 'vela', x: -200, z: 130, heading: Math.PI / 2, kind: 'parked' });
  // The Hauler for mission 5, in the Docks.
  spots.push({ model: 'hauler', x: 200, z: -190, heading: 0, kind: 'parked' });
  // A taxi downtown for fares.
  spots.push({ model: 'taxi', x: 58, z: 58, heading: -Math.PI / 2, kind: 'parked' });
  // Roadside variety.
  const axes = [-240, -120, 0, 120, 240];
  const models = ['alba', 'meridian', 'alba', 'dune', 'meridian', 'hauler', 'alba', 'taxi', 'meridian', 'dune', 'alba', 'meridian', 'hauler', 'alba', 'meridian', 'dune'];
  for (let i = 0; i < models.length; i += 1) {
    const axis = axes[Math.floor(rng() * axes.length)];
    const along = -250 + rng() * 500;
    const side = rng() < 0.5 ? -1 : 1;
    const horizontal = rng() < 0.5;
    const x = horizontal ? along : axis + side * 8.5;
    const z = horizontal ? axis + side * 8.5 : along;
    const heading = horizontal ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    spots.push({ model: models[i], x, z, heading, kind: 'parked', locked: i === 3 || i === 9 });
  }
  for (const s of spots) {
    const color = CARS[s.model].colors[Math.floor(rng() * CARS[s.model].colors.length)];
    const car = createVehicle(scene, s.model, color, s.x, s.z, s.heading, { kind: s.kind, locked: s.locked ?? false, id: `parked-${s.model}-${s.x}-${s.z}` });
    G.cars.push(car);
  }
}
spawnParked();

// --- screens ------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const screens = {
  title: $('screen-title'),
  pause: $('screen-pause'),
  over: $('screen-over'),
  howto: $('screen-howto'),
  shop: $('screen-shop'),
};
const hudEl = $('hud');

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    if (el) el.classList.toggle('on', key === name);
  }
  if (hudEl) hudEl.classList.toggle('on', name === 'play' || name === null);
  G.screen = name ?? 'play';
}

function startPlay(fresh) {
  if (fresh) {
    try { window.localStorage.removeItem('solmar.save.v1'); } catch { /* ignore */ }
    G.saveData = readSave();
    G.player.cash = 150;
    G.missions.done = [];
    G.missions.packagesFound = new Set();
  }
  showScreen('play');
  G.audio.unlock();
  if (!G.missions.active && G.missions.done.length === 0) {
    G.missions.start(1);
  } else if (!G.missions.active && G.missions.done.length > 0) {
    const next = G.missions.done.length + 1;
    if (next <= 8) G.missions.start(next);
  }
}

function applyLoadedSave() {
  const s = G.saveData;
  const p = G.player;
  p.cash = s.cash;
  p.owned = { ...p.owned, ...s.weapons };
  p.ammo = { ...p.ammo, ...s.ammo };
  p.ownedCars = s.ownedCars;
  G.missions.done = [...s.missionsDone];
  G.missions.packagesFound = new Set(s.packages);
  for (const i of s.packages) {
    if (G.city.packageMeshes[i]) G.city.packageMeshes[i].visible = false;
  }
}

// --- buttons ------------------------------------------------------------------
$('btn-new')?.addEventListener('click', () => {
  G.audio.unlock();
  G.audio.click();
  startPlay(true);
});
$('btn-continue')?.addEventListener('click', () => {
  G.audio.unlock();
  G.audio.click();
  applyLoadedSave();
  startPlay(false);
});
$('btn-howto')?.addEventListener('click', () => showScreen('howto'));
$('btn-close-howto')?.addEventListener('click', () => showScreen('title'));
$('btn-resume')?.addEventListener('click', () => showScreen('play'));
$('btn-restart-mission')?.addEventListener('click', () => {
  if (G.missions.active) {
    const id = G.missions.active.def.id;
    G.missions.active = null;
    G.missions.start(id);
  }
  showScreen('play');
});
$('btn-quit')?.addEventListener('click', () => {
  writeSave(G);
  showScreen('title');
});
$('btn-play-again')?.addEventListener('click', () => {
  if (G.busted) applyBusted(G);
  if (G.wasted) applyWasted(G);
  G.player.health = 100;
  showScreen('play');
});
$('btn-mute')?.addEventListener('click', () => {
  G.audio.setMuted(!G.audio.muted);
  $('btn-mute').textContent = G.audio.muted ? 'Sound: Off' : 'Sound: On';
});
// Weapon switching 1–4.
window.addEventListener('keydown', (event) => {
  const map = { Digit1: 'fist', Digit2: 'pistol', Digit3: 'smg', Digit4: 'shotgun' };
  const w = map[event.code];
  if (!w) return;
  const p = G.player;
  if (w !== 'fist' && !p.owned[w]) {
    G.hud.toast(`${WEAPONS[w].name} not owned — buy it at Harbor Hardware.`);
    return;
  }
  p.weapon = w;
  G.hud.toast(`${WEAPONS[w].name} equipped.`);
});

// Shop: Harbor Hardware (weapons) + Marina Motors (cars), on foot nearby.
let shopOpen = null;
function updateShop() {
  const p = G.player;
  if (p.car) { shopOpen = null; screens.shop?.classList.remove('on'); return; }
  const hw = Math.hypot(p.x - POIS.hardware.x, p.z - POIS.hardware.z);
  const mm = Math.hypot(p.x - POIS.motors.x, p.z - POIS.motors.z);
  const which = hw < 10 ? 'hardware' : mm < 10 ? 'motors' : null;
  if (which !== shopOpen) {
    shopOpen = which;
    if (screens.shop) {
      screens.shop.classList.toggle('on', !!which);
      if (which) {
        $('shop-title').textContent = which === 'hardware' ? 'Harbor Hardware — Weapons' : 'Marina Motors — Cars';
        renderShopItems(which);
      }
    }
  }
}
function renderShopItems(which) {
  const list = $('shop-items');
  list.innerHTML = '';
  const p = G.player;
  if (which === 'hardware') {
    for (const w of ['pistol', 'smg', 'shotgun']) {
      const def = WEAPONS[w];
      const owned = p.owned[w];
      const btn = document.createElement('button');
      btn.textContent = owned ? `${def.name} — OWNED` : `${def.name} — $${def.price}`;
      btn.disabled = owned || p.cash < def.price;
      btn.addEventListener('click', () => {
        p.cash -= def.price;
        p.owned[w] = true;
        p.weapon = w;
        G.audio.chime();
        renderShopItems(which);
      });
      list.appendChild(btn);
    }
  } else {
    for (const m of ['alba', 'meridian', 'vela', 'dune', 'hauler']) {
      const def = CARS[m];
      const owned = (p.ownedCars ?? ['meridian']).includes(m);
      const btn = document.createElement('button');
      btn.textContent = owned ? `${def.name} — OWNED` : `${def.name} — $${def.price}`;
      btn.disabled = owned || p.cash < def.price;
      btn.addEventListener('click', () => {
        p.cash -= def.price;
        p.ownedCars = [...(p.ownedCars ?? ['meridian']), m];
        G.audio.chime();
        renderShopItems(which);
      });
      list.appendChild(btn);
    }
  }
}

// --- the step -----------------------------------------------------------------
let autosaveT = 0;
function step(dt) {
  G.time += dt;
  G.clockMinutes += dt / 5; // 1 game minute per 5 sim seconds.
  const p = G.player;
  if (G.screen === 'title') {
    // Attract mode: the city lives, the camera drifts over Downtown.
    updateTraffic(G, dt);
    updatePeds(G, dt);
    const a = G.time * 0.05;
    camera.position.set(Math.sin(a) * 130, 55, Math.cos(a) * 130);
    camera.lookAt(0, 6, 0);
    return;
  }
  if (G.screen !== 'play') return;

  const actions = updatePlayer(G, dt);
  if (actions & ACTION_PAUSE) {
    showScreen('pause');
    return;
  }
  if (actions & ACTION_MUTE) {
    G.audio.setMuted(!G.audio.muted);
  }
  if (p.car) {
    const drive = G.input.drive();
    const others = [...G.cars, ...G.traffic, ...G.police.cars];
    driveVehicle(p.car, drive, dt, G.city.colliders, others, (car, other, impact) => {
      G.effects.crash(car.x, 1, car.z);
      G.effects.shake(Math.min(0.5, impact * 0.02));
      G.audio.thud();
      if (other && other.kind === 'traffic') addHeat(G, 0.5);
    });
    // Engine hum follows speed.
    G.audio.engine(Math.min(1, Math.abs(p.car.speed) / p.car.def.topSpeed));
    // Running over a pedestrian: they go down, the police notice.
    for (const ped of G.peds) {
      if (ped.state === 'down') continue;
      if (Math.hypot(ped.x - p.car.x, ped.z - p.car.z) < 2 && Math.abs(p.car.speed) > 4) {
        ped.state = 'down';
        ped.stateT = 0;
        G.effects.crash(ped.x, 1, ped.z);
        G.audio.thud();
        addHeat(G, 1);
        G.hud.feed('You hit a pedestrian — wanted level up.');
      }
    }
  } else {
    G.audio.engine(0);
    // Traffic cars can clip the player on foot.
    for (const car of G.traffic) {
      if (Math.hypot(car.x - p.x, car.z - p.z) < 1.8 && car.speed > 2 && G.time - (p.lastCarHit ?? -99) > 1) {
        p.lastCarHit = G.time;
        damagePlayer(G, 10);
        p.x += Math.sin(car.heading) * 2;
        p.z += Math.cos(car.heading) * 2;
      }
    }
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateCombat(G, dt);
  G.missions.update(dt);
  G.effects.update(dt);
  G.cam.update(G, dt);
  G.hud.update(dt);
  updateShop();

  autosaveT += dt;
  if (autosaveT > 15) {
    autosaveT = 0;
    writeSave(G);
  }

  if (G.busted) {
    applyBusted(G);
    $('over-title').textContent = 'BUSTED';
    $('over-text').textContent = `The Solmar police caught you. -$${250} fine. You wake up at Solmar General.`;
    showScreen('over');
  }
  if (G.wasted) {
    applyWasted(G);
    $('over-title').textContent = 'WASTED';
    $('over-text').textContent = 'You blacked out. You wake up at Solmar General, 10% lighter.';
    showScreen('over');
  }
}

// --- debug handle (the play-test script drives the game through this) ----------
window.__solmar = {
  get time() { return G.time; },
  get screen() { return G.screen; },
  get player() { return G.player; },
  get cars() { return G.cars; },
  get traffic() { return G.traffic; },
  get peds() { return G.peds; },
  get police() { return G.police; },
  get combat() { return G.combat; },
  get missions() { return G.missions; },
  get colliders() { return G.city.colliders; },
  get cash() { return G.player.cash; },
  get wanted() { return G.police.wanted; },
  get save() { return { write: () => writeSave(G), read: () => G.saveData }; },
  start: (fresh) => startPlay(fresh),
};

// --- main loop ----------------------------------------------------------------
let accumulator = 0;
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  if (G.screen !== 'title') renderer.render(scene, camera);
  else renderer.render(scene, camera);
}

function runShot(name) {
  stageShot(name, G);
  // The start shot keeps the title screen over the city vista; the other
  // shots show the live HUD over the action.
  if (name === 'start') showScreen('title');
  else {
    showScreen('play');
    G.hud.update(0);
  }
  G.cam.snap(G);
  if (name === 'start') {
    // Cover vista: high over the Marina avenue, looking across the plaza at
    // the Downtown towers in the golden-hour light — not the over-shoulder
    // cam the snap just put behind the player.
    G.camera.position.set(0, 26, 150);
    G.camera.lookAt(0, 8, -60);
  }
  let painted = 0;
  function paint() {
    renderer.render(scene, camera);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  // Title screen shows the live city behind the menu; stats on the buttons.
  const s = G.saveData;
  const hasSave = s.missionsDone.length > 0 || s.cash !== 150 || s.packages.length > 0;
  const btnContinue = $('btn-continue');
  if (btnContinue) {
    btnContinue.style.display = hasSave ? 'block' : 'none';
    if (hasSave) btnContinue.textContent = `Continue — $${Math.floor(s.cash)} · ${s.missionsDone.length}/8 missions`;
  }
  const stats = $('title-stats');
  if (stats) {
    stats.textContent = hasSave
      ? `Best wanted survived: ${'★'.repeat(s.bestWanted || 0)} · Packages ${s.packages.length}/20`
      : 'New to Solmar? Start a New Game — Juno owes Iris Delgado, and the city is waiting.';
  }
  const missionList = $('mission-list');
  if (missionList) {
    missionList.innerHTML = '';
    for (const m of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const done = s.missionsDone.includes(m);
      const li = document.createElement('li');
      li.textContent = `${done ? '✓' : '·'} Mission ${m}`;
      missionList.appendChild(li);
    }
  }
  showScreen('title');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
