// Solmar City — traffic: cars that follow the road grid, keep their lane,
// stop for the car ahead, and honk when blocked. They despawn off-screen
// and respawn to keep the streets alive. Any traffic car can be stolen.
import { ROADS } from './config.js';
import { spawnCar, stepCar } from './vehicles.js';
import { pick, range, rangeInt } from './random.js';

const TRAFFIC_MODELS = ['alba', 'meridian', 'taxi', 'dune', 'meridian', 'alba'];
const TRAFFIC_COUNT = 14;

function laneOffset(line, dir) {
  // Right-hand traffic: offset to the right of the travel direction.
  return line.axis === 'x' ? { x: 0, z: dir * 3.5 } : { x: dir * 3.5, z: 0 };
}

export function initTraffic(G) {
  G.traffic = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) spawnTrafficCar(G, true);
}

function randomRoute(G) {
  const line = pick(G.rng, G.roadLines);
  const dir = G.rng() < 0.5 ? 1 : -1;
  const t = range(G.rng, -260, 260);
  const off = laneOffset(line, dir);
  const x = line.axis === 'x' ? t : line.at + off.x;
  const z = line.axis === 'x' ? line.at + off.z : t;
  const heading = line.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  return { line, dir, x, z, heading };
}

function spawnTrafficCar(G, anywhere) {
  const model = pick(G.rng, TRAFFIC_MODELS);
  const route = randomRoute(G);
  const car = spawnCar(G, model, route.x, route.z, route.heading, {
    driver: 'traffic',
    color: pick(G.rng, [0xd94f3d, 0x3d7fd9, 0x3dd9a0, 0xf2c94c, 0xe8e8e8, 0x8a5ac8, 0x5a8a3d, 0xd98a3d]),
  });
  car.route = route;
  car.cruise = range(G.rng, 12, 20);
  car.honk = 0;
  if (!anywhere) {
    // Respawn far from the player so cars pop in off-screen.
    const px = G.player.x;
    const pz = G.player.z;
    if (Math.hypot(car.x - px, car.z - pz) < 90) {
      car.x = px + (car.x < px ? -160 : 160);
      car.z = pz + (car.z < pz ? -160 : 160);
    }
  }
  G.traffic.push(car);
  return car;
}

/** Pick a new road at the next intersection: keep going or turn. */
function nextLeg(G, car) {
  const line = car.route.line;
  const dir = car.route.dir;
  // At the end of the grid, turn around; at intersections, sometimes turn.
  const along = line.axis === 'x' ? car.x : car.z;
  if (along * dir > 270 || (G.rng() < 0.35 && Math.abs(along % 120) < 12)) {
    const cross = pick(G.rng, G.roadLines.filter((l) => l.axis !== line.axis));
    const at = line.axis === 'x' ? car.z : car.x;
    const newDir = G.rng() < 0.5 ? 1 : -1;
    const off = laneOffset(cross, newDir);
    car.route = {
      line: cross,
      dir: newDir,
      x: cross.axis === 'x' ? car.x : cross.at + off.x,
      z: cross.axis === 'x' ? cross.at + off.z : car.z,
      heading: cross.axis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI),
    };
    void at;
  }
}

function carAhead(G, car) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  let best = Infinity;
  for (const other of G.cars) {
    if (other === car || other.driver === 'player') continue;
    const dx = other.x - car.x;
    const dz = other.z - car.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < 14 && side < 3) best = Math.min(best, forward);
  }
  return best;
}

export function stepTraffic(G, dt) {
  const p = G.player;
  for (let i = G.traffic.length - 1; i >= 0; i -= 1) {
    const car = G.traffic[i];
    // Player stole it: it leaves the traffic pool.
    if (car.driver === 'player' || car.driver === null) {
      G.traffic.splice(i, 1);
      continue;
    }
    // Too far away: recycle to keep the count steady.
    if (Math.hypot(car.x - p.x, car.z - p.z) > 320) {
      G.scene.remove(car.mesh);
      G.cars.splice(G.cars.indexOf(car), 1);
      G.traffic.splice(i, 1);
      spawnTrafficCar(G, false);
      continue;
    }
    nextLeg(G, car);
    const ahead = carAhead(G, car);
    const wantSpeed = ahead < 12 ? 0 : car.cruise;
    const throttle = car.speed < wantSpeed ? 1 : 0;
    if (ahead < 9 && car.honk <= 0) {
      car.honk = 2.5;
      G.audio.honk(G);
    }
    car.honk -= dt;
    // Steer toward the lane centre.
    const route = car.route;
    const off = laneOffset(route.line, route.dir);
    const targetX = route.line.axis === 'x' ? car.x : route.line.at + off.x;
    const targetZ = route.line.axis === 'x' ? route.line.at + off.z : car.z;
    const wantHeading = Math.atan2(targetX - car.x, targetZ - car.z);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
    stepCar(G, car, dt, throttle, 0, false);
    // stepCar steers by heading already; keep the mesh aligned.
    car.mesh.rotation.y = car.heading;
  }
  // Keep the pool topped up.
  while (G.traffic.length < TRAFFIC_COUNT) spawnTrafficCar(G, false);
}
