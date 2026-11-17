// Cars: invented models, arcade driving, enter/exit/steal, damage and smoke.
// A car is a THREE.Group (body + cabin + 4 wheels + lights) plus a sim record in G.cars.
import * as THREE from 'three';
import { CAR_MODELS, WANTED } from './config.js';
import { angleLerp, clamp, pick } from './random.js';
import { collideCircle } from './city.js';

let nextCarId = 1;

export function buildCarMesh(modelKey, color) {
  const def = CAR_MODELS[modelKey];
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(def.width, def.height * 0.62, def.length), paint);
  body.position.y = def.height * 0.45;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(def.width * 0.85, def.height * 0.5, def.length * 0.5), glass);
  cabin.position.set(0, def.height * 0.95, -def.length * 0.05);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(wx * (def.width / 2 - 0.05), 0.36, wz * (def.length / 2 - 0.55));
    w.castShadow = true;
    group.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b8 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.08), lightMat);
    h.position.set(sx * def.width * 0.32, def.height * 0.5, def.length / 2 + 0.02);
    group.add(h);
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0xff2e2e });
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), brakeMat);
    b.position.set(sx * def.width * 0.32, def.height * 0.5, -def.length / 2 - 0.02);
    group.add(b);
    b.visible = false;
  }
  group.userData.brakeLights = group.children.filter((c) => c.material === brakeMat);
  return { group, wheels };
}

export function spawnCar(G, modelKey, x, z, heading, opts = {}) {
  const def = CAR_MODELS[modelKey];
  const color = opts.color || pick(G.rng, def.colors);
  const { group, wheels } = buildCarMesh(modelKey, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  G.scene.add(group);
  const car = {
    id: nextCarId,
    model: modelKey,
    def,
    mesh: group,
    wheels,
    heading,
    speed: 0,
    steer: 0,
    health: def.durability,
    color,
    driver: opts.driver || null, // 'player' | 'traffic' | 'police' | 'ped' | null (parked)
    isPolice: modelKey === 'interceptor',
    locked: !!opts.locked,
    hotwire: 0,
    mission: opts.mission || null,
    taxi: modelKey === 'taxi',
    smokeTimer: 0,
  };
  nextCarId += 1;
  G.cars.push(car);
  return car;
}

export function removeCar(G, car) {
  G.scene.remove(car.mesh);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}

// Arcade driving: throttle, steering that tightens with speed, handbrake drift.
export function driveCar(G, car, input, dt) {
  const def = car.def;
  const fwd = input.held('forward') ? 1 : input.held('back') ? -0.6 : 0;
  const steerIn = (input.held('left') ? 1 : 0) - (input.held('right') ? 1 : 0);
  const handbrake = input.held('jump');
  const targetSteer = steerIn * (car.speed >= 0 ? 1 : -1);
  car.steer = angleLerp(car.steer, targetSteer * 0.55, Math.min(1, dt * 8));
  const grip = handbrake ? def.grip * 0.4 : def.grip;
  car.heading += car.steer * grip * (car.speed / def.topSpeed) * dt * 2.2;
  if (fwd !== 0) car.speed += fwd * def.accel * dt * (input.held('sprint') ? 1.25 : 1);
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 18 * dt);
  car.speed = clamp(car.speed, -def.topSpeed * 0.45, def.topSpeed);
  const nx = car.mesh.position.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.mesh.position.z + Math.cos(car.heading) * car.speed * dt;
  const oldX = car.mesh.position.x;
  const oldZ = car.mesh.position.z;
  car.mesh.position.x = nx;
  car.mesh.position.z = nz;
  const hitWall = collideCircle(G, car.mesh.position, def.length * 0.42);
  if (hitWall) {
    car.speed *= 0.4;
    if (Math.abs(car.speed) > 6) {
      G.effects.burst(car.mesh.position, 0xffc94c, 8, 3, 2);
      G.audio.impact();
      G.camera.shake = Math.min(1, G.camera.shake + 0.25);
    }
  }
  // Car-car bumps: push apart, lose a little speed and health on hard hits.
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = car.mesh.position.x - other.mesh.position.x;
    const dz = car.mesh.position.z - other.mesh.position.z;
    const d = Math.hypot(dx, dz);
    const min = (car.def.length + other.def.length) * 0.32;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d; const uz = dz / d;
      car.mesh.position.x += ux * push;
      car.mesh.position.z += uz * push;
      other.mesh.position.x -= ux * push;
      other.mesh.position.z -= uz * push;
      const impact = Math.abs(car.speed - other.speed);
      if (impact > 8) {
        car.health -= impact * 0.4;
        other.health -= impact * 0.4;
        G.effects.burst(car.mesh.position, 0xffc94c, 6, 2.5, 2);
        G.audio.impact();
        G.camera.shake = Math.min(1, G.camera.shake + 0.2);
        if (car.driver === 'player' || other.driver === 'player') G.police.addHeat(0.2);
      }
      car.speed *= 0.85;
    }
  }
  // Skid marks + smoke when sliding or damaged.
  if (handbrake && Math.abs(car.speed) > 8) {
    G.effects.skid(car.mesh.position.x, car.mesh.position.z, car.heading);
    if (Math.random() < 0.4) G.effects.smoke(car.mesh.position, 1);
  }
  if (car.health < def.durability * 0.35) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.25;
      G.effects.smoke(new THREE.Vector3(car.mesh.position.x, 1.2, car.mesh.position.z), 1);
    }
  }
  if (car.health <= 0 && car.driver === 'player') {
    // Wrecked: force the player out on foot.
    exitCar(G, car);
    G.hud.banner('Your car is wrecked!', '#ff6b4a');
  }
  car.mesh.rotation.y = car.heading;
  const spin = car.speed * dt * 2.4;
  for (const w of car.wheels) w.rotation.x += spin;
  const braking = input.held('back') || handbrake;
  for (const b of car.mesh.userData.brakeLights) b.visible = braking;
  G.audio.engine(Math.abs(car.speed) / def.topSpeed);
  return { movedX: car.mesh.position.x - oldX, movedZ: car.mesh.position.z - oldZ };
}

export function nearestCar(G, pos, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    if (car.isPolice && G.wanted.stars > 0) continue; // police cars are not stealable while wanted
    const d = Math.hypot(car.mesh.position.x - pos.x, car.mesh.position.z - pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.inCar = car;
  car.driver = 'player';
  p.mesh.visible = false;
  G.hud.setCar(car.def.name);
  G.audio.click();
  if (car.driver === 'player' && car.mission === 'stolen') G.police.addHeat(WANTED.gainSteal);
}

export function exitCar(G, car) {
  const p = G.player;
  const side = car.heading + Math.PI / 2;
  p.mesh.position.set(
    car.mesh.position.x + Math.sin(side) * 2.4,
    0,
    car.mesh.position.z + Math.cos(side) * 2.4,
  );
  p.heading = car.heading;
  p.inCar = null;
  car.driver = null;
  car.speed = 0;
  p.mesh.visible = true;
  G.hud.setCar(null);
  G.audio.click();
}

// Steal: walk up and press E. Parked cars are free; traffic cars throw the driver out
// (a wanted star if a cop or a pedestrian saw it); locked cars need a 2 s hotwire.
export function trySteal(G, car, dt) {
  if (!car) return false;
  if (car.locked) {
    car.hotwire += dt;
    G.hud.setHotwire(car.hotwire / 2);
    if (car.hotwire < 2) return false;
    car.locked = false;
    G.hud.setHotwire(0);
  }
  if (car.driver === 'traffic') {
    G.traffic.ejectDriver(G, car);
    G.police.addHeat(WANTED.gainSteal);
    G.hud.banner('Car stolen! The cops noticed.', '#ff6b4a');
  } else if (car.driver === 'ped') {
    G.pedestrians.fleeFrom(G, car.mesh.position, 30);
    G.police.addHeat(WANTED.gainSteal);
  }
  enterCar(G, car);
  return true;
}
