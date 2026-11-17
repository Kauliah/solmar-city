// Solmar City — boot, the fixed-step 60 Hz loop, screens (title / play /
// paused / busted-wasted), interactions (enter car, shops, weapons, reload)
// and the ?shot= capture modes that stage a scene and set __shotReady.
import * as THREE from 'three';
import { STEP, CARS, WEAPONS, MISSIONS, HARDWARE_POS, MOTORS_POS, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_RELOAD, ACTION_JUMP } from './input.js';
import { applyPaletteToDocument } from './palette.js';
import { buildCity } from './city.js';
import { createPlayer, buildPlayerMesh, stepPlayer, animatePlayerMesh } from './player.js';
import { spawnCar, stepCar, nearestCar, enterCar, exitCar } from './vehicles.js';
import { initTraffic, stepTraffic } from './traffic.js';
import { initPedestrians, stepPedestrians, scarePeds } from './pedestrians.js';
import { createPolice, stepPolice, policeHeat } from './police.js';
import { createCombat, stepCombat, playerShoot, spawnEnemy } from './combat.js';
import { createMissions, initMissionWorld, startMission, stepMissions, stepTaxi, startTaxiFare, currentMission } from './missions.js';
import * as missionsMod from './missions.js';
import { createHud, updateHud, flash, setObjective, tick } from './hud.js';
import { createCamera, updateCamera } from './camera.js';
import * as effectsMod from './effects.js';
import * as audioMod from './audio.js';
import { createSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

applyPaletteToDocument();

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);

const G = {
  THREE,
  scene,
  camera,
  renderer,
  rng: createRandom(seed),
  time: 0,
  cash: 500,
  wanted: 0,
  policeNear: false,
  cars: [],
  peds: [],
  traffic: [],
  nextCarId: 1,
  colliders: [],
  roadLines: [],
  intersections: [],
  markers: [],
  ownedCars: ['meridian'],
  bestTimes: {},
  screen: 'title',
  jumpQueued: false,
  punchQueued: false,
  hotwiring: null,
  freezeCam: false,
  gameOverKind: null,
};

G.input = createInput(canvas);
G.player = createPlayer(G);
// Debug handle for play-testing (read-only state inspection from the console).
window.__solmar = G;
G.police = createPolice(G);
G.combat = createCombat(G);
G.missions = Object.assign(createMissions(G), {
  failStep: (g, reason) => missionsMod.failStep(g, reason),
  start: (g, i) => startMission(g, i),
  onShotFired: (g) => missionsMod.onShotFired(g),
  onEnemyKilled: (g, e) => missionsMod.onEnemyKilled(g, e),
});
G.effects = Object.assign(effectsMod.createEffects(G), {
  spark: effectsMod.spark,
  smoke: effectsMod.smoke,
  burst: effectsMod.burst,
  muzzle: effectsMod.muzzle,
  tracer: effectsMod.tracer,
  hitmarker: effectsMod.hitmarker,
  damageFlash: effectsMod.damageFlash,
  step: effectsMod.stepEffects,
});
G.audio = Object.assign(audioMod.createAudio(G), {
  shot: audioMod.shot,
  swing: audioMod.swing,
  hit: audioMod.hit,
  thud: audioMod.thud,
  chime: audioMod.chime,
  click: audioMod.click,
  door: audioMod.door,
  hurt: audioMod.hurt,
  honk: audioMod.honk,
  siren: audioMod.siren,
  sting: audioMod.sting,
  updateEngine: audioMod.updateEngine,
});
G.save = createSave(G);
G.hud = { flash, setObjective, tick };
G.player.mesh = buildPlayerMesh(G);

buildCity(G);
createCamera(G);
initTraffic(G);
initPedestrians(G);
initMissionWorld(G);
createHud(G);

// Parked cars the player can steal, parked at the roadside (just off the
// asphalt so traffic keeps flowing), spread across the districts.
const PARKED = [
  ['alba', -111, 200, 0], ['meridian', 60, -111, Math.PI / 2], ['vela', -200, 130, 0],
  ['hauler', 200, 130, Math.PI], ['dune', -60, -231, Math.PI / 2], ['taxi', 129, 60, 0],
  ['taxi', -180, -111, Math.PI], ['meridian', 249, 129, -Math.PI / 2], ['alba', 9, 249, 0],
];
for (const [model, x, z, h] of PARKED) spawnCar(G, model, x, z, h, {});
// One locked car that needs a 2 s hotwire (press E, stay close).
const locked = spawnCar(G, 'vela', -160, 231, Math.PI / 2, { locked: true });
// Juno's own Meridian, parked by the start.
spawnCar(G, 'meridian', 14, 132, Math.PI, { owned: true });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function announce(message) {
  status.textContent = message;
}

function showScreen(name) {
  G.screen = name;
  for (const id of ['screen-title', 'screen-pause', 'screen-over']) {
    document.getElementById(id).classList.toggle('on', `screen-${name}` === id);
  }
  document.getElementById('hud').classList.toggle('on', name === 'play');
}

function applySave(data) {
  if (!data) return;
  G.cash = data.cash ?? 500;
  G.ownedCars = data.ownedCars ?? ['meridian'];
  G.missions.done = data.missionsDone ?? [];
  G.missions.index = data.missionIndex ?? 0;
  G.missions.packages = data.packages ?? 0;
  G.bestTimes = data.bestTimes ?? {};
  const owned = new Set(G.ownedCars);
  for (const key of Object.keys(WEAPONS)) {
    if (key !== 'fists' && data.weapons?.includes(key)) {
      G.player.ammo[key] = { mag: WEAPONS[key].mag, reserve: WEAPONS[key].reserve };
    }
  }
}

function newGame() {
  G.save.clear();
  G.cash = 500;
  G.ownedCars = ['meridian'];
  G.missions.done = [];
  G.missions.index = 0;
  G.missions.packages = 0;
  G.player.health = 100;
  G.player.armour = 0;
  G.player.x = 8;
  G.player.z = 128;
  G.player.weapon = 'fists';
  G.wanted = 0;
  showScreen('play');
  startMission(G, 0);
  announce('Playing Solmar City. Drive to Iris\u2019s caf\u00e9 in Old Town.');
}

function continueGame() {
  const data = G.save.read(G);
  applySave(data);
  G.player.health = 100;
  G.player.x = 8;
  G.player.z = 128;
  showScreen('play');
  const mission = currentMission(G);
  if (mission) startMission(G, G.missions.index);
  else flash(G, 'Free roam \u2014 all 8 missions done. Solmar is yours.');
  announce('Continuing Solmar City.');
}

function quitToMenu() {
  G.save.write(G);
  showScreen('title');
  refreshTitle();
  announce('Main menu.');
}

function refreshTitle() {
  const data = G.save.read(G);
  document.getElementById('btn-continue').disabled = !data;
  const done = data?.missionsDone?.length ?? 0;
  document.getElementById('title-stats').textContent = data
    ? `Save found: $${(data.cash ?? 0).toLocaleString('en-US')} \u00b7 ${done}/8 missions done \u00b7 ${data.packages ?? 0}/20 packages`
    : 'No save yet \u2014 start a new game.';
}

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-continue').addEventListener('click', continueGame);
document.getElementById('btn-howto').addEventListener('click', () => {
  document.getElementById('howto').classList.toggle('on');
});
document.getElementById('btn-missions').addEventListener('click', () => {
  const lines = MISSIONS.map((m) => `${G.missions.done.includes(m.id) ? '\u2713' : '\u25cb'} ${m.id}. ${m.title} \u2014 $${m.reward}`).join('\n');
  flash(G, lines);
  document.getElementById('howto').textContent = lines;
  document.getElementById('howto').classList.add('on');
});
document.getElementById('btn-resume').addEventListener('click', () => showScreen('play'));
document.getElementById('btn-restart').addEventListener('click', () => {
  if (G.missions.active) startMission(G, G.missions.index);
  showScreen('play');
});
document.getElementById('btn-quit').addEventListener('click', quitToMenu);
document.getElementById('btn-again').addEventListener('click', () => {
  G.player.health = 100;
  showScreen('play');
});
document.getElementById('btn-menu').addEventListener('click', quitToMenu);

// Weapon switching (1-4) and reload live here so input.js stays generic.
window.addEventListener('keydown', (event) => {
  const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
  const weapons = ['fists', 'pistol', 'smg', 'shotgun'];
  const i = keys.indexOf(event.code);
  if (i >= 0) {
    const w = weapons[i];
    if (w === 'fists' || G.player.ammo[w]) {
      G.player.weapon = w;
      flash(G, `${WEAPONS[w].name} ready.`);
    } else {
      flash(G, `${WEAPONS[w].name} not owned \u2014 buy it at Harbor Hardware.`);
    }
  }
});

function tryInteract() {
  const p = G.player;
  if (p.car) { exitCar(G); return; }
  // Shops: Harbor Hardware (weapons) and Marina Motors (cars).
  const hd = Math.hypot(p.x - HARDWARE_POS[0], p.z - HARDWARE_POS[1]);
  if (hd < 8) {
    const order = ['pistol', 'smg', 'shotgun'];
    const next = order.find((w) => !G.player.ammo[w]);
    if (!next) { flash(G, 'Harbor Hardware: you own every weapon.'); return; }
    if (G.cash >= WEAPONS[next].price) {
      G.cash -= WEAPONS[next].price;
      G.player.ammo[next] = { mag: WEAPONS[next].mag, reserve: WEAPONS[next].reserve };
      G.player.weapon = next;
      flash(G, `Bought the ${WEAPONS[next].name} for $${WEAPONS[next].price}.`);
      G.audio.chime(G);
      G.save.write(G);
    } else {
      flash(G, `${WEAPONS[next].name} costs $${WEAPONS[next].price} \u2014 you have $${G.cash}.`);
    }
    return;
  }
  const md = Math.hypot(p.x - MOTORS_POS[0], p.z - MOTORS_POS[1]);
  if (md < 8) {
    const order = ['alba', 'meridian', 'taxi', 'dune', 'hauler', 'vela'];
    const next = order.find((m) => !G.ownedCars.includes(m));
    if (!next) { flash(G, 'Marina Motors: you own every model.'); return; }
    if (G.cash >= CARS[next].price) {
      G.cash -= CARS[next].price;
      G.ownedCars.push(next);
      spawnCar(G, next, MOTORS_POS[0] + 12, MOTORS_POS[1], Math.PI / 2, { owned: true });
      flash(G, `Bought the ${CARS[next].name} for $${CARS[next].price}. It is parked outside.`);
      G.audio.chime(G);
      G.save.write(G);
    } else {
      flash(G, `${CARS[next].name} costs $${CARS[next].price} \u2014 you have $${G.cash}.`);
    }
    return;
  }
  // Otherwise: enter / steal the nearest car.
  const car = nearestCar(G, p.x, p.z);
  if (!car) return;
  if (car.locked && car.hotwire < 2) {
    G.hotwiring = car;
    flash(G, 'Locked \u2014 hotwiring\u2026 stay close (2 s).');
    return;
  }
  if (enterCar(G, car)) {
    flash(G, `Driving the ${car.def.name}.`);
    if (car.driver === 'player' && G.wanted === 0 && car.model === 'taxi') startTaxiFare(G);
  }
}

function step(dt) {
  const input = G.input;
  const p = G.player;
  const actions = input.takeActions();
  if (actions & ACTION_JUMP) G.jumpQueued = true;
  if (actions & ACTION_PUNCH) G.punchQueued = true;
  if (actions & ACTION_PAUSE) {
    if (G.screen === 'play') showScreen('pause');
    else if (G.screen === 'pause') showScreen('play');
  }
  if (actions & ACTION_ENTER) tryInteract();
  if (actions & ACTION_RELOAD) {
    const w = WEAPONS[p.weapon];
    const ammo = p.ammo[p.weapon];
    if (ammo && w.mag !== Infinity && ammo.mag < w.mag && ammo.reserve > 0) {
      const need = w.mag - ammo.mag;
      const take = Math.min(need, ammo.reserve);
      ammo.mag += take;
      ammo.reserve -= take;
      G.audio.click(G);
    }
  }
  // Hold E on a locked car to hotwire it (2 s): the one-shot E press starts
  // the timer, and the loop below finishes it while the player stays close.
  const near = nearestCar(G, p.x, p.z);
  if (near && near.locked && !p.car && G.hotwiring === near) {
    near.hotwire += dt;
    if (near.hotwire >= 2) {
      near.locked = false;
      flash(G, 'Hotwired! The car is yours.');
      G.audio.chime(G);
    }
  } else if (G.hotwiring && G.hotwiring !== near) {
    G.hotwiring.hotwire = 0;
    G.hotwiring = null;
  }
  // Shooting: mouse click (or hold for automatics).
  const weapon = WEAPONS[p.weapon];
  if (!p.car && (input.mousePressed() || (weapon.auto && input.mouseHeld()))) playerShoot(G);

  // Drive or walk.
  if (p.car) {
    const car = p.car;
    stepCar(G, car, dt, input.throttle(), input.steer(), input.handbrake());
    // The player's world position IS the car's while driving: missions, the
    // garage, police distance and the minimap all read p.x/p.z.
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    // Speeding through a red light near police adds a little heat.
    if (Math.abs(car.speed) > 30 && G.policeNear && G.rng() < dt * 0.05) {
      G.wanted = Math.min(5, G.wanted + 1);
      policeHeat(G, 6);
    }
    if (car.hp <= 0) {
      G.effects.burst(G, car.x, car.z);
      G.audio.thud(G);
      G.scene.remove(car.mesh);
      G.cars.splice(G.cars.indexOf(car), 1);
      p.car = null;
      p.x = car.x + 3;
      p.z = car.z + 3;
      flash(G, 'Your car is wrecked. Find another ride.');
    }
  } else {
    stepPlayer(G, dt);
  }
  stepTraffic(G, dt);
  stepPedestrians(G, dt);
  stepPolice(G, dt);
  stepCombat(G, dt);
  stepMissions(G, dt);
  stepTaxi(G, dt);
  effectsMod.stepEffects(G, dt);
  audioMod.updateEngine(G);
  updateCamera(G, dt);
  animatePlayerMesh(G, dt);
  G.time += dt;
}

function renderFrame() {
  updateHud(G, 1 / 60);
  renderer.render(scene, camera);
}

function runGame() {
  refreshTitle();
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (G.screen === 'play') {
      while (accumulator >= STEP) {
        step(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // Attract mode behind the title: traffic and pedestrians keep moving.
      if (G.screen === 'title') {
        stepTraffic(G, STEP);
        stepPedestrians(G, STEP);
        G.time += STEP;
        updateCamera(G, STEP);
      }
    }
    renderFrame();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') showScreen('pause');
  });
  announce('Solmar City. Press New Game to start.');
  requestAnimationFrame(frame);
}

function runShot(name) {
  showScreen('play');
  stageShot(name, G);
  // Let the staged scene settle for two frames, then declare it ready.
  let painted = 0;
  function paint() {
    renderFrame();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

if (shot) runShot(shot);
else runGame();
