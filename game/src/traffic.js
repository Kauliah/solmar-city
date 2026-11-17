// Traffic: cars that follow the city's road loops, keep their lane, brake for
// anything ahead, honk when stuck, and despawn/respawn off-screen so the count
// stays at 14. Traffic cars are stealable — pulling the driver out is a crime.
import { CARS } from './config.js';
import { createVehicle } from './vehicles.js';
import { createRandom } from './random.js';

const TRAFFIC_MODELS = ['alba', 'meridian', 'meridian', 'alba', 'dune', 'hauler', 'taxi', 'meridian'];
const COUNT = 14;

export function createTraffic(G) {
  const rng = createRandom(G.seed + 101);
  const cars = [];
  const loops = G.city.loops;
  for (let i = 0; i < COUNT; i += 1) {
    const loop = loops[Math.floor(rng() * loops.length)];
    const idx = Math.floor(rng() * loop.length);
    const model = TRAFFIC_MODELS[Math.floor(rng() * TRAFFIC_MODELS.length)];
    const color = CARS[model].colors[Math.floor(rng() * CARS[model].colors.length)];
    const [wx, wz] = loop[idx];
    const car = createVehicle(G.scene, model, color, wx, wz, 0, { kind: 'traffic', id: `traffic-${i}` });
    car.route = loop;
    car.routeIdx = idx;
    car.cruise = 8 + rng() * 4;
    car.driver = { name: 'driver' };
    cars.push(car);
  }
  return cars;
}

// Where a traffic car should aim: its own position projected onto the current
// road segment, 8 m further along it, in the right-hand lane (2.6 m right of
// the travel direction). Because the aim point is always ahead of the car's
// projection, the car never chases a point it has already passed and never
// turns around mid-segment. Returns the aim point plus how far along the
// segment the car has travelled, so the caller can advance waypoints from
// segment progress instead of distance to the next waypoint.
function roadTarget(loop, idx, x, z) {
  const a = loop[idx];
  const b = loop[(idx + 1) % loop.length];
  const sx = b[0] - a[0];
  const sz = b[1] - a[1];
  const segLen = Math.hypot(sx, sz) || 1;
  const ux = sx / segLen;
  const uz = sz / segLen;
  let along = (x - a[0]) * ux + (z - a[1]) * uz;
  if (along < 0) along = 0;
  if (along > segLen) along = segLen;
  const ahead = along + 8;
  return {
    x: a[0] + ux * ahead - uz * 2.6,
    z: a[1] + uz * ahead + ux * 2.6,
    along,
    segLen,
  };
}

export function updateTraffic(G, dt) {
  const player = G.player;
  const playerCar = player.car;
  for (const car of G.traffic) {
    const loop = car.route;
    // Step onto the next segment once the car has nearly finished this one.
    // Progress is measured along the segment, so a car that drifted wide of
    // the waypoint still advances instead of circling back to it. The guard
    // stops a run of very short segments from advancing forever in one frame.
    let seg = roadTarget(loop, car.routeIdx, car.x, car.z);
    let stepped = 0;
    while (seg.along >= seg.segLen - 3 && stepped < loop.length) {
      car.routeIdx = (car.routeIdx + 1) % loop.length;
      seg = roadTarget(loop, car.routeIdx, car.x, car.z);
      stepped += 1;
    }
    const dx = seg.x - car.x;
    const dz = seg.z - car.z;
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    // Blocked? Anything (player car, another car, a cop) within 9 m ahead.
    let blocked = false;
    const aheadX = car.x + Math.sin(car.heading) * 7;
    const aheadZ = car.z + Math.cos(car.heading) * 7;
    const others = [...G.traffic, ...G.police.cars];
    if (playerCar) others.push(playerCar);
    for (const o of others) {
      if (o === car) continue;
      if (Math.hypot(o.x - aheadX, o.z - aheadZ) < 5) { blocked = true; break; }
    }
    if (playerCar === null && Math.hypot(player.x - aheadX, player.z - aheadZ) < 3.5) blocked = true;
    if (blocked) {
      car.stopTimer += dt;
      car.speed = Math.max(0, car.speed - 20 * dt);
      if (car.stopTimer > 4 && car.honkTimer <= 0) {
        car.honkTimer = 2;
        if (G.audio) G.audio.honk();
      }
    } else {
      car.stopTimer = 0;
      car.speed = Math.min(car.cruise, car.speed + 8 * dt);
    }
    car.honkTimer = Math.max(0, car.honkTimer - dt);
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh * 2.4 * dt));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = (car.speed * dt) / 0.36;
    for (const w of car.wheels) w.rotation.x += spin;
    // Respawn far away if the player drove off and left it behind.
    const pd = Math.hypot(car.x - player.x, car.z - player.z);
    if (pd > 420) {
      const loop2 = G.city.loops[Math.floor(Math.random() * G.city.loops.length)];
      const [rx, rz] = loop2[Math.floor(Math.random() * loop2.length)];
      car.x = rx;
      car.z = rz;
      car.route = loop2;
      car.routeIdx = 0;
      car.speed = 0;
    }
  }
}
