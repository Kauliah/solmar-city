// Solmar City — screenshot scenes behind ?shot=start|chase|drive|mission.
// Each one plays the real rules forward from a fresh world with a fixed seed,
// steered by scripted inputs (drive forward, hold the line), then freezes and
// sets window.__shotReady. Same seed, same frame.
import { STEP } from './config.js';
import { spawnCar, stepCar, enterCar } from './vehicles.js';
import { stepTraffic } from './traffic.js';
import { stepPedestrians } from './pedestrians.js';
import { stepPolice } from './police.js';
import { stepCombat, spawnEnemy, playerShoot } from './combat.js';
import { startMission } from './missions.js';
import { updateCamera } from './camera.js';
import { animatePlayerMesh } from './player.js';
import { stepEffects } from './effects.js';
import { updateHud } from './hud.js';

/** Advance the living world without player input. */
function advance(G, seconds, drive) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (drive) {
      const car = G.player.car;
      if (car) {
        stepCar(G, car, STEP, drive.throttle, drive.steer ?? 0, false);
        G.player.x = car.x;
        G.player.z = car.z;
        G.player.heading = car.heading;
      }
    }
    stepTraffic(G, STEP);
    stepPedestrians(G, STEP);
    stepPolice(G, STEP);
    stepCombat(G, STEP);
    stepEffects(G, STEP);
    updateCamera(G, STEP);
    animatePlayerMesh(G, STEP);
    G.time += STEP;
  }
}

function showTitleDom() {
  document.getElementById('screen-title').classList.add('on');
  document.getElementById('screen-pause').classList.remove('on');
  document.getElementById('screen-over').classList.remove('on');
  document.getElementById('hud').classList.remove('on');
  const stats = document.getElementById('title-stats');
  if (stats) stats.textContent = '8 story missions \u00b7 5 districts \u00b7 steal any car \u00b7 outrun the law';
}

function stageStart(G) {
  G.time = 2 * 3600; // 17:00, golden hour
  G.player.x = 120;
  G.player.z = -60;
  G.player.heading = Math.PI;
  G.cameraYaw = Math.PI * 0.9;
  // Vista camera: high over the avenue, looking across Downtown at the tower.
  G.freezeCam = true;
  G.camPos = { x: 40, y: 65, z: 80 };
  G.camLook = { x: 170, y: 25, z: -170 };
  advance(G, 3, null);
  showTitleDom();
}

function stageChase(G) {
  G.time = 2 * 3600;
  G.cash = 2450;
  G.wanted = 3;
  // Player in the Vela GT, barrelling north up the x=0 avenue.
  const car = spawnCar(G, 'vela', 0, -160, 0, {});
  enterCar(G, car);
  car.speed = 30;
  // Two Interceptors in pursuit — one alongside ahead-left, one sweeping in
  // from ahead-right so both read in the chase camera's frame.
  const cop1 = spawnCar(G, 'police', -8, 12, 0.2, { driver: 'police' });
  cop1.speed = 33;
  const cop2 = spawnCar(G, 'police', 9, 42, Math.PI * 0.85, { driver: 'police' });
  cop2.speed = 31;
  G.police.cars.push(cop1, cop2);
  G.cameraYaw = Math.PI;
  G.hud.setObjective(G, 'Escape the police \u2014 lose 3 stars of heat!');
  advance(G, 4.5, { throttle: 1, steer: 0 });
  // Frame the pursuit: pull both Interceptors ahead of the Vela GT, in the
  // chase camera's view, as if they are cutting it off.
  const px = car.x;
  const pz = car.z;
  cop1.x = px - 7;
  cop1.z = pz + 20;
  cop1.heading = 0.15;
  cop1.mesh.position.set(cop1.x, 0, cop1.z);
  cop1.mesh.rotation.y = cop1.heading;
  cop2.x = px + 7;
  cop2.z = pz + 34;
  cop2.heading = -0.1;
  cop2.mesh.position.set(cop2.x, 0, cop2.z);
  cop2.mesh.rotation.y = cop2.heading;
  updateCamera(G, STEP);
}

function stageDrive(G) {
  G.time = 2 * 3600;
  G.cash = 1250;
  G.wanted = 0;
  // Cruising Downtown in the Meridian, traffic and pedestrians around.
  const car = spawnCar(G, 'meridian', 120, -200, 0, {});
  enterCar(G, car);
  car.speed = 18;
  G.cameraYaw = Math.PI;
  G.hud.setObjective(G, 'Cruise Downtown \u2014 explore Solmar City');
  advance(G, 3.5, { throttle: 0.7, steer: 0 });
}

function stageMission(G) {
  G.time = 2 * 3600;
  G.cash = 3100;
  G.wanted = 2;
  // No fresh police during the short staged scene: the frame is about the
  // shootout, and a spawned Interceptor would park itself in front of it.
  G.police.spawnTimer = 999;
  G.player.weapon = 'pistol';
  G.player.ammo.pistol = { mag: 12, reserve: 96 };
  // Mission 6: the Pier 9 shootout, staged for real.
  startMission(G, 5);
  G.player.x = -240;
  G.player.z = 295;
  G.player.heading = Math.PI; // facing south, down the pier
  G.cameraYaw = 0.12;
  // Kings close in on the pier itself for a denser firefight.
  spawnEnemy(G, -232, 312, 'king');
  spawnEnemy(G, -248, 318, 'king');
  spawnEnemy(G, -226, 300, 'king');
  spawnEnemy(G, -254, 306, 'king');
  advance(G, 1.5, null);
  // Fire a shot at the nearest King LAST, so the tracer and muzzle flash are
  // still in the frame when it is captured.
  playerShoot(G);
}

/**
 * Set the world to the named scene and return; main.js renders twice and
 * sets window.__shotReady.
 */
export function stageShot(name, G) {
  G.screen = 'play';
  if (name === 'chase') stageChase(G);
  else if (name === 'drive') stageDrive(G);
  else if (name === 'mission') stageMission(G);
  else stageStart(G);
  updateHud(G, STEP);
}
