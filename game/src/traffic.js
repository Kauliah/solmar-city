// Traffic: cars that follow the road grid on waypoint loops, keep their lane, brake
// when blocked and honk. They despawn far away and respawn to keep the count steady.
import * as THREE from 'three';
import { AVENUES, CAR_MODELS, STREETS } from './config.js';
import { pick, range } from './random.js';
import { removeCar, spawnCar } from './vehicles.js';

const TRAFFIC_COUNT = 14;
const TRAFFIC_SPEED = 9;
const MODELS = ['alba', 'meridian', 'vela', 'dune', 'taxi'];

function makeLoop(rng) {
  // A rectangle loop around one block, on real roads.
  const vertical = pick(rng, AVENUES);
  const horizontal = pick(rng, STREETS);
  const v2 = vertical + (rng() < 0.5 ? -120 : 120);
  const h2 = horizontal + (rng() < 0.5 ? -120 : 120);
  const cx = Math.max(-240, Math.min(240, v2));
  const cz = Math.max(-240, Math.min(240, h2));
  return [
    new THREE.Vector3(vertical, 0, horizontal),
    new THREE.Vector3(cx, 0, horizontal),
    new THREE.Vector3(cx, 0, cz),
    new THREE.Vector3(vertical, 0, cz),
  ];
}

export function createTraffic(G) {
  const traffic = { cars: [], loops: new Map() };
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const loop = makeLoop(G.rng);
    const car = spawnCar(G, pick(G.rng, MODELS), loop[0].x + range(G.rng, -2, 2), loop[0].z + range(G.rng, -2, 2), 0, { driver: 'traffic' });
    traffic.cars.push(car);
    traffic.loops.set(car.id, { points: loop, index: 1, speed: range(G.rng, 7, 11) });
  }
  return traffic;
}

export function stepTraffic(G, dt) {
  const player = G.player;
  const playerPos = player.inCar ? player.inCar.mesh.position : player.mesh.position;
  for (const car of [...G.traffic.cars]) {
    const loop = G.traffic.loops.get(car.id);
    if (!loop) continue;
    const target = loop.points[loop.index];
    const dx = target.x - car.mesh.position.x;
    const dz = target.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      loop.index = (loop.index + 1) % loop.points.length;
      continue;
    }
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
    // Brake when something is right ahead: another car, or the player.
    let blocked = false;
    const aheadX = car.mesh.position.x + Math.sin(car.heading) * 7;
    const aheadZ = car.mesh.position.z + Math.cos(car.heading) * 7;
    for (const other of G.cars) {
      if (other === car) continue;
      if (Math.hypot(other.mesh.position.x - aheadX, other.mesh.position.z - aheadZ) < 3.4) { blocked = true; break; }
    }
    if (!blocked && Math.hypot(playerPos.x - aheadX, playerPos.z - aheadZ) < 3) blocked = true;
    const wantSpeed = blocked ? 0 : loop.speed;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.6);
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.wheels) w.rotation.x += spin;
    // Honk at the player when they block the road.
    if (blocked && Math.hypot(playerPos.x - car.mesh.position.x, playerPos.z - car.mesh.position.z) < 9 && Math.random() < dt * 0.2) {
      G.audio.horn();
    }
    // Respawn far from the player so the streets never empty out.
    const pd = Math.hypot(car.mesh.position.x - playerPos.x, car.mesh.position.z - playerPos.z);
    if (pd > 260) {
      const loop2 = makeLoop(G.rng);
      car.mesh.position.set(loop2[0].x, 0, loop2[0].z);
      G.traffic.loops.set(car.id, { points: loop2, index: 1, speed: range(G.rng, 7, 11) });
    }
  }
}

// A stolen traffic car throws its driver out: the driver becomes a fleeing pedestrian.
export function ejectDriver(G, car) {
  G.traffic.cars = G.traffic.cars.filter((c) => c !== car);
  G.traffic.loops.delete(car.id);
  G.pedestrians.spawnWalker(G, car.mesh.position.x + 2, car.mesh.position.z + 2, 'flee');
  // A fresh traffic car joins elsewhere to keep the count.
  const loop = makeLoop(G.rng);
  const fresh = spawnCar(G, pick(G.rng, MODELS), loop[0].x, loop[0].z, 0, { driver: 'traffic' });
  G.traffic.cars.push(fresh);
  G.traffic.loops.set(fresh.id, { points: loop, index: 1, speed: range(G.rng, 7, 11) });
}

export function removeTrafficCar(G, car) {
  G.traffic.cars = G.traffic.cars.filter((c) => c !== car);
  G.traffic.loops.delete(car.id);
  removeCar(G, car);
}

export { CAR_MODELS };
