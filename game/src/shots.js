// Screenshot scenes: each plays the real rules forward from a fresh world with a fixed
// seed, steered by a simple autopilot, then freezes and lets main.js paint it.
// ?shot=start|chase|drive|mission (with &seed=N).
import * as THREE from 'three';
import { STEP } from './config.js';
import { spawnCar, driveCar } from './vehicles.js';
import { stepTraffic } from './traffic.js';
import { stepPedestrians } from './pedestrians.js';
import { stepPolice } from './police.js';
import { stepCombat } from './combat.js';
import { stepCamera } from './camera.js';

function fakeInput(steer) {
  return {
    held(name) {
      if (name === 'forward') return true;
      if (name === 'left') return steer < 0;
      if (name === 'right') return steer > 0;
      return false;
    },
    takeMouseDelta() { return { x: 0, y: 0 }; },
    takeActions() { return 0; },
    mouseDown: false,
  };
}

function stepAmbient(G, dt) {
  stepTraffic(G, dt);
  stepPedestrians(G, dt);
  stepPolice(G, dt);
  G.effects.update(dt);
}

// Drive straight down an avenue, steering gently to stay on the road.
function autopilotDrive(G, car, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    G.time += STEP;
    const laneX = Math.round(car.mesh.position.x / 120) * 120;
    const err = laneX - car.mesh.position.x;
    const steer = err > 2 ? -1 : err < -2 ? 1 : 0;
    driveCar(G, car, fakeInput(steer), STEP);
    stepAmbient(G, STEP);
    if (G.player.inCar === car) G.player.mesh.position.copy(car.mesh.position);
  }
}

// Let the chase-cam converge on the car after the autopilot has driven it.
function settleCamera(G) {
  for (let i = 0; i < 90; i += 1) stepCamera(G, fakeInput(0), STEP);
}

export function stageShot(name, G, input) {
  const L = G.landmarks;
  G.screen = 'play';
  G.hud.hideOverlays();
  if (name === 'chase') {
    // Police chase: Juno in the Vela GT, 3 stars, two Interceptors closing in.
    const car = spawnCar(G, 'vela', 0, 40, 0, { driver: 'player' });
    G.player.inCar = car;
    G.player.mesh.visible = false;
    car.speed = 30;
    G.police.addHeat(3);
    G.police.spawn(2);
    G.hud.setObjective('Lose the cops — reach the Hills lookout');
    G.hud.setStars(3);
    autopilotDrive(G, car, 2.5);
    settleCamera(G);
    G.hud.update();
    return;
  }
  if (name === 'drive') {
    // Cruising Downtown in traffic, pedestrians on the sidewalks.
    const car = spawnCar(G, 'meridian', 0, -100, 0, { driver: 'player' });
    G.player.inCar = car;
    G.player.mesh.visible = false;
    car.speed = 14;
    G.hud.setObjective('Cruise Downtown — Solmar is yours to explore');
    autopilotDrive(G, car, 3.5);
    settleCamera(G);
    G.hud.update();
    return;
  }
  if (name === 'mission') {
    // Mission 6 shootout at Pier 9, on foot, gunmen in view, muzzle flash in the air.
    G.player.mesh.position.set(-176, 0, 312);
    G.player.heading = 0;
    G.player.weapon = 'smg';
    G.player.ammo = G.player.ammoByWeapon.smg;
    G.player.ammo.mag = 24;
    G.missions.index = 5;
    G.missions.start();
    G.missions.steps = G.missions.steps.filter((s) => s.type === 'kill');
    G.missions.stepIndex = 0;
    G.missions.beginStep();
    G.camera.yaw = 0;
    G.camera.pitch = 0.3;
    for (let i = 0; i < 90; i += 1) {
      G.time += STEP;
      stepCombat(G, STEP);
      stepAmbient(G, STEP);
    }
    const dir = new THREE.Vector3(0, -0.05, 1);
    G.effects.muzzle(new THREE.Vector3(-176, 1.4, 313), dir);
    G.effects.burst(new THREE.Vector3(-180, 1.2, 322), 0xffc94c, 12, 3, 3);
    G.hud.setObjective("Kings' Gambit — defeat 8 Harbor Kings gunmen");
    settleCamera(G);
    G.hud.update();
    return;
  }
  // Default: start — title screen over a Downtown/Marina vista at golden hour.
  G.screen = 'title';
  G.hud.showTitle(false, 'A fresh start in Solmar. Iris is waiting at the cafe.');
  G.three.camera.position.set(140, 55, 120);
  G.three.camera.lookAt(30, 12, -30);
  for (let i = 0; i < 240; i += 1) {
    G.time += STEP;
    stepAmbient(G, STEP);
  }
  G.hud.update();
}
