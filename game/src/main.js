// Solmar City — boot, fixed-step loop, screens, interactions and shot capture modes.
// The game moves between title / play / paused / over; the world behind the title
// screen stays alive so the menu shows the real city.
import * as THREE from 'three';
import { STEP, WEAPONS } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_MUTE, ACTION_CLICK } from './input.js';
import { buildCity } from './city.js';
import { createPlayer, stepPlayer } from './player.js';
import { createCamera, stepCamera } from './camera.js';
import { createTraffic, stepTraffic, ejectDriver } from './traffic.js';
import { createPedestrians, stepPedestrians, spawnWalker, fleeFrom } from './pedestrians.js';
import { createPolice, stepPolice } from './police.js';
import { spawnCar, driveCar, nearestCar, exitCar, trySteal } from './vehicles.js';
import { createCombat, playerShoot, playerPunch, reloadWeapon, stepCombat, stepPickups } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { loadSave, storeSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const G = {
  scene,
  three: { scene, camera, renderer },
  rng: createRandom(seed),
  time: 0,
  screen: 'title',
  cameraShake: 0,
  cars: [],
  pickups: [],
  save: loadSave(),
};
G.camera = createCamera(G);
G.effects = createEffects(scene);
G.audio = createAudio();
G.hud = createHud(G);
buildCity(G);
G.player = createPlayer(G);
G.player.ammoByWeapon = {
  pistol: { mag: 12, reserve: 120 },
  smg: { mag: 28, reserve: 0 },
  shotgun: { mag: 6, reserve: 0 },
};
G.player.ammo = G.player.ammoByWeapon.pistol;
G.traffic = createTraffic(G);
G.traffic.ejectDriver = ejectDriver;
G.pedestrians = createPedestrians(G);
G.pedestrians.spawnWalker = spawnWalker;
G.pedestrians.fleeFrom = fleeFrom;
G.police = createPolice(G);
G.combat = createCombat(G);
G.missions = createMissions(G);
G.missions.index = G.save.missionsDone.length;

// Player's own Meridian + parked cars to steal around the city.
spawnCar(G, 'meridian', 4, 66, Math.PI, { driver: null });
spawnCar(G, 'alba', -116, 64, 0, { driver: null });
spawnCar(G, 'meridian', 124, -116, Math.PI / 2, { driver: null });
spawnCar(G, 'vela', -176, 124, 0, { driver: null });
spawnCar(G, 'dune', 60, -124, 0, { driver: null, locked: true });
spawnCar(G, 'taxi', -60, 124, Math.PI, { driver: null });
spawnCar(G, 'taxi', 180, -60, 0, { driver: null });
spawnCar(G, 'hauler', 176, 124, Math.PI / 2, { driver: null });

function announce(message) { status.textContent = message; }

function syncSave() {
  G.save.cash = G.player.cash;
  G.save.playSeconds = Math.floor(G.time);
  storeSave(G.save);
}

function switchWeapon(key) {
  const p = G.player;
  const map = { Digit1: 'fists', Digit2: 'pistol', Digit3: 'smg', Digit4: 'shotgun' };
  const w = map[key];
  if (!w) return;
  if (w !== 'fists' && !G.save.weapons.includes(w)) {
    G.hud.banner(`You don't own the ${WEAPONS[w].name} — buy it at Harbor Hardware.`, '#ff6b4a');
    return;
  }
  p.weapon = w;
  if (w !== 'fists') p.ammo = p.ammoByWeapon[w];
  G.audio.click();
  G.hud.feed(`Weapon: ${WEAPONS[w].name}.`);
}
window.addEventListener('keydown', (event) => {
  if (event.code.startsWith('Digit')) switchWeapon(event.code);
});

function useNearbyPlace() {
  const p = G.player;
  const pos = p.inCar ? p.inCar.mesh.position : p.mesh.position;
  const L = G.landmarks;
  const near = (target, r) => Math.hypot(target.x - pos.x, target.z - pos.z) < r;
  if (near(L.garage, 10)) {
    if (p.cash < 150) { G.hud.banner('Tune-Up Garage: $150 — you are short.', '#ff6b4a'); return true; }
    if (G.police.stars === 0 && (!p.inCar || p.inCar.health >= p.inCar.def.durability)) {
      G.hud.banner('Nothing to fix right now.', '#f4f0e6');
      return true;
    }
    p.cash -= 150;
    G.save.cash = p.cash;
    G.police.clearStars();
    if (p.inCar) {
      p.inCar.health = p.inCar.def.durability;
      const colors = p.inCar.def.colors;
      const c = colors[Math.floor(Math.random() * colors.length)];
      p.inCar.mesh.children[0].material.color.set(c);
    }
    G.hud.banner('Tune-Up Garage: wanted cleared, car fixed, fresh paint. -$150', '#3ad86b');
    G.audio.pickup();
    return true;
  }
  if (near(L.hardware, 10)) {
    const shop = [
      { key: 'smg', price: 900, name: 'Hornet-9 SMG' },
      { key: 'shotgun', price: 700, name: 'Boomstick shotgun' },
    ];
    for (const item of shop) {
      if (!G.save.weapons.includes(item.key)) {
        if (p.cash < item.price) { G.hud.banner(`Harbor Hardware: ${item.name} costs $${item.price}.`, '#ff6b4a'); return true; }
        p.cash -= item.price;
        G.save.cash = p.cash;
        G.save.weapons.push(item.key);
        G.hud.banner(`Bought the ${item.name}! Press 3 or 4 to equip.`, '#3ad86b');
        G.audio.pickup();
        return true;
      }
    }
    G.hud.banner('Harbor Hardware: you own everything. Ammo restocked $50.', '#f4f0e6');
    if (p.cash >= 50) { p.cash -= 50; p.ammoByWeapon.pistol.reserve += 120; p.ammoByWeapon.smg.reserve += 140; p.ammoByWeapon.shotgun.reserve += 24; G.save.cash = p.cash; }
    return true;
  }
  return false;
}

let hotwireCar = null;

function handleEnter() {
  const p = G.player;
  if (p.inCar) {
    // The Tune-Up Garage and shops work from the driver's seat.
    if (useNearbyPlace()) return;
    exitCar(G, p.inCar);
    return;
  }
  const car = nearestCar(G, p.mesh.position, 4.5);
  if (car) {
    if (car.locked) { hotwireCar = car; G.hud.banner('Locked — hold E to hotwire…', '#f2c94c'); return; }
    trySteal(G, car, 0);
    return;
  }
  if (useNearbyPlace()) return;
  // Start / retry the story at Iris's cafe.
  const L = G.landmarks;
  if (Math.hypot(L.cafe.x - p.mesh.position.x, L.cafe.z - p.mesh.position.z) < 9) {
    if (!G.missions.active) G.missions.start();
    return;
  }
  G.hud.banner('Nothing to enter here — find a car, or visit the cafe, garage or hardware store.', '#f4f0e6');
}

function stepWorld(input, dt) {
  G.time += dt;
  stepPlayer(G, input, dt);
  if (G.player.inCar) driveCar(G, G.player.inCar, input, dt);
  else G.audio.engine(0);
  stepTraffic(G, dt);
  stepPedestrians(G, dt);
  stepPolice(G, dt);
  stepCombat(G, dt);
  stepPickups(G, dt);
  G.missions.step(dt);
  G.effects.update(dt);
  stepCamera(G, input, dt);
  G.hud.update();
}

function handleActions(input) {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    G.audio.setMuted(!G.audio.muted);
    G.hud.feed(G.audio.muted ? 'Sound muted.' : 'Sound on.');
  }
  if (G.screen === 'title') {
    if (actions & ACTION_CONFIRM) startGame(false);
    return;
  }
  if (G.screen === 'over') {
    if (actions & ACTION_CONFIRM) showTitle();
    return;
  }
  if (actions & ACTION_PAUSE) {
    if (G.screen === 'play') {
      G.screen = 'paused';
      G.hud.showPause();
      syncSave();
      announce('Paused.');
    } else if (G.screen === 'paused') {
      G.screen = 'play';
      G.hud.hideOverlays();
      announce('Playing.');
    }
    return;
  }
  if (G.screen !== 'play') return;
  if (actions & ACTION_ENTER) handleEnter();
  if (actions & ACTION_PUNCH) playerPunch(G);
  if (actions & ACTION_RELOAD) reloadWeapon(G);
  if (actions & ACTION_CLICK) playerShoot(G);
  // Shooting: hold to fire (SMG auto, others semi — one shot per press is enforced by fireTimer).
  if (input.mouseDown) playerShoot(G);
  // Hotwire progress while E is held near a locked car.
  if (hotwireCar) {
    if (input.held('enter')) {
      if (trySteal(G, hotwireCar, 1 / 60)) hotwireCar = null;
    } else {
      hotwireCar.hotwire = 0;
      G.hud.setHotwire(0);
      hotwireCar = null;
    }
  }
}

function startGame(fresh) {
  if (fresh) {
    G.save = { cash: 500, ownedCars: ['meridian'], weapons: ['fists', 'pistol'], missionsDone: [], packages: [], bestRace: {}, bestWanted: 0, totalEarned: 0, playSeconds: 0 };
    clearSave();
    G.player.cash = 500;
    G.player.health = 100;
    G.missions.index = 0;
    G.missions.active = false;
  }
  G.player.cash = G.save.cash;
  G.screen = 'play';
  G.hud.hideOverlays();
  G.audio.resume();
  // The story starts (or resumes) with the next mission — no trip to the cafe needed.
  if (!G.missions.active && G.missions.index < 8) G.missions.start();
  announce('Playing. Follow the yellow marker — or just explore Solmar.');
}

function showTitle() {
  G.screen = 'title';
  const hasSave = G.save.missionsDone.length > 0 || G.save.totalEarned > 0;
  const stats = hasSave
    ? `Missions done: ${G.save.missionsDone.length}/8 · Earned: $${G.save.totalEarned} · Packages: ${G.save.packages.length}/20 · Best wanted: ${G.save.bestWanted}★`
    : 'A fresh start in Solmar. Iris is waiting at the cafe.';
  G.hud.showTitle(hasSave, stats);
  announce('Solmar City. Press Space or click to start.');
}

// Title-screen buttons.
document.getElementById('continue-btn').addEventListener('click', () => startGame(false));
document.getElementById('new-btn').addEventListener('click', () => startGame(true));
document.getElementById('how-btn').addEventListener('click', () => {
  const t = document.getElementById('how-text');
  t.style.display = t.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('resume-btn').addEventListener('click', () => { G.screen = 'play'; G.hud.hideOverlays(); });
document.getElementById('restart-mission-btn').addEventListener('click', () => {
  G.missions.retry();
  G.screen = 'play';
  G.hud.hideOverlays();
});
document.getElementById('quit-btn').addEventListener('click', () => { syncSave(); showTitle(); });
document.getElementById('again-btn').addEventListener('click', () => {
  G.player.health = 100;
  G.player.mesh.position.copy(G.landmarks.hospital);
  G.player.mesh.visible = true;
  G.player.inCar = null;
  G.police.clearStars();
  G.screen = 'play';
  G.hud.hideOverlays();
});
document.getElementById('menu-btn').addEventListener('click', () => { syncSave(); showTitle(); });

function runShot(name) {
  const input = createInput(canvas);
  stageShot(name, G, input);
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
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  let titleAngle = 0;
  showTitle();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input);
    if (G.screen === 'title') {
      // Ambient city behind the menu: slow orbit over Downtown, traffic + peds alive.
      G.time += 1 / 60;
      stepTraffic(G, 1 / 60);
      stepPedestrians(G, 1 / 60);
      G.effects.update(1 / 60);
      titleAngle += 0.00045;
      const cx = 30 + Math.sin(titleAngle) * 130;
      const cz = -30 + Math.cos(titleAngle) * 130;
      camera.position.set(cx, 55, cz);
      camera.lookAt(30, 12, -30);
      G.hud.update();
    } else if (G.screen === 'play') {
      while (accumulator >= STEP) {
        stepWorld(input, STEP);
        accumulator -= STEP;
        if (G.screen !== 'play') break;
      }
    } else {
      accumulator = 0;
    }
    if (G.screen !== 'title') renderer.render(scene, camera);
    else renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}

// Debug handle for play-testing: a stable view over the live game state.
function carProxy(car) {
  return {
    get x() { return car.mesh.position.x; },
    set x(v) { car.mesh.position.x = v; },
    get z() { return car.mesh.position.z; },
    set z(v) { car.mesh.position.z = v; },
    get speed() { return car.speed; },
    set speed(v) { car.speed = v; },
    get model() { return car.model; },
    get def() { return car.def; },
  };
}
const ammoProxy = {
  get pistol() { return G.player.ammoByWeapon.pistol; },
  set pistol(v) { G.player.ammoByWeapon.pistol = v; if (G.player.weapon === 'pistol') G.player.ammo = v; },
  get smg() { return G.player.ammoByWeapon.smg; },
  set smg(v) { G.player.ammoByWeapon.smg = v; if (G.player.weapon === 'smg') G.player.ammo = v; },
  get shotgun() { return G.player.ammoByWeapon.shotgun; },
  set shotgun(v) { G.player.ammoByWeapon.shotgun = v; if (G.player.weapon === 'shotgun') G.player.ammo = v; },
};
window.__solmar = {
  get time() { return G.time; },
  get colliders() { return G.colliders; },
  get traffic() { return G.traffic.cars; },
  get peds() { return G.pedestrians.list; },
  get cars() { return G.cars; },
  get screen() { return G.screen; },
  get cash() { return G.player.cash; },
  get wanted() { return G.police.stars; },
  set wanted(v) { G.police.stars = v; G.police.heat = v; G.hud.setStars(v); },
  get police() { return G.police; },
  missions: {
    get active() { return G.missions.active ? { id: G.missions.index + 1 } : null; },
    get done() { return G.save.missionsDone; },
  },
  player: {
    get x() { return G.player.mesh.position.x; },
    set x(v) { G.player.mesh.position.x = v; },
    get z() { return G.player.mesh.position.z; },
    set z(v) { G.player.mesh.position.z = v; },
    get car() { return G.player.inCar ? carProxy(G.player.inCar) : null; },
    set car(v) { if (v === null && G.player.inCar) exitCar(G, G.player.inCar); },
    get weapon() { return G.player.weapon; },
    set weapon(w) { G.player.weapon = w; if (w !== 'fists') G.player.ammo = G.player.ammoByWeapon[w]; },
    get ammo() { return ammoProxy; },
  },
  save: { write() { syncSave(); } },
};

if (shot) runShot(shot);
else runGame();
