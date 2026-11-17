// Solmar City — cars: boxy low-poly models with distinct silhouettes, arcade
// driving physics, enter/exit, and stealing (walk up, press E; the driver
// flees, or fights back at high wanted levels).
import * as THREE from 'three';
import { CARS } from './config.js';
import { collideCircle } from './city.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);

export function buildCarMesh(model, color) {
  const def = CARS[model];
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1b2a3a });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });

  const len = model === 'hauler' ? 5.6 : model === 'dune' ? 4.9 : model === 'vela' ? 4.4 : 4.2;
  const wid = model === 'hauler' ? 2.2 : 1.9;
  const bodyH = model === 'hauler' ? 1.5 : 0.75;

  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);

  // Cabin: short for the sports car, tall box for the van.
  const cabLen = model === 'hauler' ? 1.4 : model === 'vela' ? 1.6 : 2.0;
  const cabH = model === 'hauler' ? 0.9 : 0.62;
  const cabZ = model === 'hauler' ? len / 2 - 0.9 : -0.2;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.25, cabH, cabLen), glassMat);
  cabin.position.set(0, 0.65 + bodyH / 2 + cabH / 2 - 0.05, cabZ);
  cabin.castShadow = true;
  group.add(cabin);

  // Pickup bed / van cargo box.
  if (model === 'dune') {
    const bed = new THREE.Mesh(new THREE.BoxGeometry(wid - 0.3, 0.5, 1.6), darkMat);
    bed.position.set(0, 1.15, 1.4);
    group.add(bed);
  }
  if (model === 'hauler') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(wid, 1.6, 3.4), bodyMat);
    box.position.set(0, 1.5, -0.8);
    box.castShadow = true;
    group.add(box);
  }

  // Headlights + brake lights (emissive so they read in screenshots).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), headMat);
    h.position.set(sx * (wid / 2 - 0.35), 0.7, len / 2 + 0.02);
    group.add(h);
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), brakeMat);
    b.position.set(sx * (wid / 2 - 0.35), 0.7, -len / 2 - 0.02);
    group.add(b);
  }
  group.userData.brakeMat = brakeMat;

  // Wheels: spin with speed, front pair steers.
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  const wheels = [];
  for (const [wx, wz] of [[-wid / 2, len / 2 - 0.9], [wid / 2, len / 2 - 0.9], [-wid / 2, -len / 2 + 0.9], [wid / 2, -len / 2 + 0.9]]) {
    const w = new THREE.Mesh(WHEEL_GEO, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  group.userData.wheels = wheels;
  group.userData.def = def;
  group.userData.model = model;
  group.userData.len = len;
  group.userData.wid = wid;
  return group;
}

export function spawnCar(G, model, x, z, heading, opts = {}) {
  const color = opts.color ?? CARS[model].color;
  const mesh = buildCarMesh(model, color);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  G.scene.add(mesh);
  const car = {
    id: G.nextCarId++,
    model,
    def: CARS[model],
    mesh,
    x, z,
    heading,
    speed: 0,
    steer: 0,
    hp: CARS[model].hp,
    driver: opts.driver ?? null, // 'traffic' | 'police' | 'player' | null (parked)
    locked: opts.locked ?? false,
    hotwire: 0,
    owned: opts.owned ?? false,
    smoke: 0,
    brakeLight: false,
  };
  G.cars.push(car);
  return car;
}

/** Nearest car within reach of the player (for E to enter / steal). */
export function nearestCar(G, x, z, maxDist = 4.5) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.driver === 'player') continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function carRadius(car) {
  return Math.max(car.mesh.userData.len, car.mesh.userData.wid) / 2 + 0.4;
}

export function stepCar(G, car, dt, throttle, steerInput, handbrake) {
  const def = car.def;
  const accel = throttle > 0 ? def.accel : throttle < 0 ? def.brake : 0;
  car.speed += accel * throttle * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  const max = def.topSpeed * (car.hp < 30 ? 0.55 : 1);
  car.speed = Math.max(-def.topSpeed * 0.35, Math.min(max, car.speed));
  // Steering only bites while moving; handbrake makes the tail loose.
  const steerTarget = steerInput * def.steer * (handbrake ? 1.5 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * (car.speed / def.topSpeed) * dt * 1.9;
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const [cx, cz] = collideCircle(G, nx, nz, carRadius(car));
  if (cx !== nx || cz !== nz) {
    // Hit a building: scrape speed off, spark, shake.
    if (Math.abs(car.speed) > 6) {
      G.effects.spark(G, car.x, car.z);
      G.audio.thud(G);
      G.shake = Math.min(0.5, G.shake + 0.25);
      car.hp -= Math.abs(car.speed) * 0.4;
    }
    car.speed *= 0.4;
  }
  car.x = cx;
  car.z = cz;
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Wheels spin and the front pair steers.
  const spin = (car.speed * dt) / 0.42;
  car.mesh.userData.wheels.forEach((w, i) => {
    w.rotation.x += spin;
    if (i < 2) w.rotation.y = car.steer * 0.35;
  });
  // Brake lights flare when slowing.
  const braking = throttle < 0 || handbrake;
  car.mesh.userData.brakeMat.color.setHex(braking ? 0xff4a2a : 0x881512);
  // Damage smoke when the car is nearly dead.
  if (car.hp < 30) {
    car.smoke += dt;
    if (car.smoke > 0.12) {
      car.smoke = 0;
      G.effects.smoke(G, car.x, car.z);
    }
  }
}

export function enterCar(G, car) {
  if (car.driver === 'police' && G.wanted > 0) return false; // alarm: not while wanted
  if (car.locked && car.hotwire < 2) return false;
  if (car.driver === 'traffic') {
    // Pull the driver out: they flee on foot, wanted goes up if seen.
    const ped = G.peds.find((p) => p.car === car);
    if (ped) {
      ped.car = null;
      ped.flee = 6;
      ped.x = car.x + 2;
      ped.z = car.z + 2;
    }
    car.driver = null;
    if (G.policeNear) G.wanted = Math.min(5, G.wanted + 1);
  }
  car.driver = 'player';
  G.player.car = car;
  G.player.x = car.x;
  G.player.z = car.z;
  G.audio.door(G);
  return true;
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  G.player.car = null;
  G.player.x = car.x + Math.cos(car.heading + Math.PI / 2) * 2.2;
  G.player.z = car.z - Math.sin(car.heading + Math.PI / 2) * 2.2;
  G.player.y = 0;
  G.player.vy = 0;
}
