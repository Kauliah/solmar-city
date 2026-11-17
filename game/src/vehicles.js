// Cars: invented low-poly models, arcade driving physics, enter/exit/steal.
// A vehicle is a plain object { def, model, x, z, heading, speed, steer, mesh,
// wheels, health, locked, kind } — traffic and police reuse the same shape.
import * as THREE from 'three';
import { CARS } from './config.js';
import { collideCircle, isOnRoad } from './city.js';

const BODY_GEO = new THREE.BoxGeometry(1, 1, 1);
const WHEEL_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.9 });

const bodyMats = new Map();
function bodyMat(color) {
  if (!bodyMats.has(color)) {
    bodyMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 }));
  }
  return bodyMats.get(color);
}

const glassMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 });

/** Build the mesh for one car of `model` in `color`; returns { group, wheels, brakeLights }. */
export function buildCarMesh(model, color) {
  const def = CARS[model];
  const group = new THREE.Group();
  const dims = {
    hatch: { w: 1.8, l: 3.6, h: 0.62, cabW: 1.5, cabL: 1.9, cabH: 0.55, cabZ: -0.2 },
    sedan: { w: 1.9, l: 4.4, h: 0.62, cabW: 1.6, cabL: 2.2, cabH: 0.55, cabZ: -0.3 },
    sports: { w: 1.95, l: 4.3, h: 0.5, cabW: 1.5, cabL: 1.7, cabH: 0.45, cabZ: -0.5 },
    van: { w: 2.0, l: 4.8, h: 1.5, cabW: 1.7, cabL: 1.2, cabH: 0.4, cabZ: 0.9 },
    pickup: { w: 1.95, l: 4.6, h: 0.66, cabW: 1.6, cabL: 1.6, cabH: 0.55, cabZ: 0.6 },
    taxi: { w: 1.9, l: 4.4, h: 0.62, cabW: 1.6, cabL: 2.2, cabH: 0.55, cabZ: -0.3 },
    police: { w: 1.95, l: 4.5, h: 0.6, cabW: 1.6, cabL: 2.1, cabH: 0.5, cabZ: -0.3 },
  }[def.kind] ?? { w: 1.9, l: 4.4, h: 0.62, cabW: 1.6, cabL: 2.2, cabH: 0.55, cabZ: -0.3 };
  const body = new THREE.Mesh(BODY_GEO, bodyMat(color));
  body.scale.set(dims.w, dims.h, dims.l);
  body.position.y = 0.55 + dims.h / 2;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(BODY_GEO, glassMat);
  cabin.scale.set(dims.cabW, dims.cabH, dims.cabL);
  cabin.position.set(0, 0.55 + dims.h + dims.cabH / 2 - 0.04, dims.cabZ);
  cabin.castShadow = true;
  group.add(cabin);
  // Headlights + brake lights.
  const head = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, roughness: 0.3 }));
  head.scale.set(dims.w * 0.7, 0.14, 0.1);
  head.position.set(0, 0.72, dims.l / 2 + 0.01);
  group.add(head);
  const brake = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x330000, roughness: 0.3 }));
  brake.scale.set(dims.w * 0.7, 0.14, 0.1);
  brake.position.set(0, 0.72, -dims.l / 2 - 0.01);
  group.add(brake);
  // Taxi sign / police light bar.
  if (model === 'taxi') {
    const sign = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe9a0, roughness: 0.4 }));
    sign.scale.set(0.9, 0.22, 0.4);
    sign.position.set(0, 0.55 + dims.h + dims.cabH + 0.08, dims.cabZ);
    group.add(sign);
  }
  if (model === 'interceptor') {
    const bar = new THREE.Mesh(BODY_GEO, new THREE.MeshStandardMaterial({ color: 0x2244cc, emissive: 0x2244cc, roughness: 0.3 }));
    bar.scale.set(1.1, 0.16, 0.35);
    bar.position.set(0, 0.55 + dims.h + dims.cabH + 0.05, dims.cabZ);
    group.add(bar);
  }
  const wheels = [];
  const wx = dims.w / 2 - 0.08;
  const wz = dims.l / 2 - 0.7;
  for (const [x, z] of [[-wx, wz], [wx, wz], [-wx, -wz], [wx, -wz]]) {
    const wheel = new THREE.Mesh(WHEEL_GEO, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.36, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  return { group, wheels, brake, dims };
}

export function createVehicle(scene, model, color, x, z, heading, opts = {}) {
  const { group, wheels, brake, dims } = buildCarMesh(model, color);
  group.position.set(x, 0, z);
  group.rotation.y = heading;
  scene.add(group);
  return {
    id: opts.id ?? `car-${Math.floor(Math.random() * 1e9)}`,
    model,
    def: CARS[model],
    color,
    x, z, heading,
    speed: 0,
    steer: 0,
    mesh: group,
    wheels,
    brake,
    dims,
    health: CARS[model].durability,
    locked: opts.locked ?? false,
    hotwire: 0,
    kind: opts.kind ?? 'parked', // parked | player | traffic | police | owned
    driver: opts.driver ?? null,
    route: opts.route ?? null,
    routeIdx: 0,
    stopTimer: 0,
    honkTimer: 0,
    smoke: 0,
  };
}

/** Arcade driving: throttle, steering that tightens at low speed, drag, handbrake drift. */
export function driveVehicle(car, input, dt, colliders, others, onCrash) {
  const def = car.def;
  const throttle = input.throttle;
  const steerTarget = input.steer * (car.speed >= 0 ? 1 : -1);
  car.steer += (steerTarget * 0.55 - car.steer) * Math.min(1, dt * 8);
  const speedAbs = Math.abs(car.speed);
  const accel = throttle > 0 ? def.accel : throttle < 0 ? def.accel * 0.7 : 0;
  if (throttle !== 0) car.speed += Math.sign(throttle) * accel * dt * (car.speed < 0 ? 0.6 : 1);
  // Drag + rolling resistance; handbrake kills grip and speed fast.
  car.speed -= car.speed * (input.brake ? 2.2 : 0.35) * dt;
  if (throttle === 0 && speedAbs < 0.4) car.speed = 0;
  if (car.speed > def.topSpeed) car.speed = def.topSpeed;
  if (car.speed < -def.topSpeed * 0.45) car.speed = -def.topSpeed * 0.45;
  const turnRate = car.steer * def.grip * (0.35 + Math.min(1, speedAbs / 14));
  car.heading += turnRate * Math.sign(car.speed) * dt * (input.brake ? 1.6 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const fixed = collideCircle(colliders, nx, nz, 1.6);
  const hitWall = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
  car.x = fixed.x;
  car.z = fixed.z;
  // Soft collision with other cars: push apart, bleed speed, spark.
  for (const other of others) {
    if (other === car) continue;
    const dx = car.x - other.x;
    const dz = car.z - other.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.01) {
      const push = (3.4 - d) / 2;
      car.x += (dx / d) * push;
      car.z += (dz / d) * push;
      const impact = Math.abs(car.speed - (other.speed ?? 0));
      if (impact > 6) {
        car.speed *= 0.55;
        car.health -= impact * 0.4;
        if (onCrash) onCrash(car, other, impact);
      }
    }
  }
  if (hitWall && speedAbs > 8) {
    car.speed *= 0.5;
    car.health -= speedAbs * 0.35;
    if (onCrash) onCrash(car, null, speedAbs);
  }
  if (car.health < 40) car.smoke = 1;
  // World edge: the beach blocks cars, the sea is out of bounds.
  if (car.z > 292) { car.z = 292; car.speed *= 0.4; }
  if (Math.abs(car.x) > 296) { car.x = Math.sign(car.x) * 296; car.speed *= 0.4; }
  if (car.z < -296) { car.z = -296; car.speed *= 0.4; }
  // Sync the mesh; wheels spin with speed, fronts steer.
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  const spin = (car.speed * dt) / 0.36;
  for (let i = 0; i < 4; i += 1) {
    car.wheels[i].rotation.x += spin;
  }
  car.wheels[0].rotation.y = car.steer * 0.4;
  car.wheels[1].rotation.y = car.steer * 0.4;
  if (car.brake) car.brake.material.emissive.setHex(input.throttle < 0 || input.brake ? 0x880000 : 0x330000);
  return hitWall;
}

/** Nearest drivable car within `range` of (x, z). */
export function nearestCar(cars, x, z, range) {
  let best = null;
  let bestD = range;
  for (const car of cars) {
    if (car.kind === 'police') continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** Off-road penalty: driving on grass/sand is slower. */
export function offRoadFactor(x, z) {
  return isOnRoad(x, z) ? 1 : 0.55;
}
