// Juno Reyes on foot: camera-relative WASD movement, sprint, jump, crouch,
// punch, and the enter/exit/steal interaction (E) with cars. Health regens
// slowly out of combat; falling never hurts (Solmar is flat).
import * as THREE from 'three';
import { PLAYER, WEAPONS } from './config.js';
import { collideCircle } from './city.js';
import { nearestCar } from './vehicles.js';
import { ACTION_ENTER, ACTION_PUNCH } from './input.js';
import { addHeat } from './police.js';
import { scarePeds } from './pedestrians.js';

const BODY_GEO = new THREE.BoxGeometry(0.6, 1.1, 0.36);
const HEAD_GEO = new THREE.SphereGeometry(0.28, 10, 8);
const LEG_GEO = new THREE.BoxGeometry(0.22, 0.85, 0.24);

export function createPlayer(G) {
  const mesh = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff6b4a, roughness: 0.85 });
  const body = new THREE.Mesh(BODY_GEO, jacket);
  body.position.y = 1.15;
  body.castShadow = true;
  mesh.add(body);
  const head = new THREE.Mesh(HEAD_GEO, new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.85 }));
  head.position.y = 1.82;
  head.castShadow = true;
  mesh.add(head);
  const legL = new THREE.Mesh(LEG_GEO, new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 }));
  legL.position.set(-0.16, 0.42, 0);
  mesh.add(legL);
  const legR = new THREE.Mesh(LEG_GEO, new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 }));
  legR.position.set(0.16, 0.42, 0);
  mesh.add(legR);
  mesh.position.set(0, 0, 130);
  G.scene.add(mesh);
  return {
    x: 0, z: 130,
    heading: 0, // facing, radians; forward = (sin, cos)
    camYaw: 0, camPitch: 0.32,
    y: 0, vy: 0, grounded: true,
    health: PLAYER.health,
    armour: 0,
    cash: 150,
    weapon: 'fist',
    ammo: { pistol: { mag: 12, reserve: 96 }, smg: { mag: 28, reserve: 112 }, shotgun: { mag: 6, reserve: 24 } },
    owned: { pistol: false, smg: false, shotgun: false },
    car: null,
    mesh, legL, legR,
    walkPhase: 0,
    lastDamage: -99,
    punchTimer: 0,
    punchCooldown: 0,
    hotwireTarget: null,
    hotwireT: 0,
  };
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.health <= 0) return;
  let rest = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, rest);
    p.armour -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  p.lastDamage = G.time;
  if (G.effects) G.effects.damageFlash();
  if (G.audio) G.audio.hurt();
  if (p.health <= 0) {
    p.health = 0;
    G.wasted = true;
  }
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  const look = input.takeLook();
  p.camYaw -= look.dx * 0.0032;
  p.camPitch = Math.max(-0.15, Math.min(1.1, p.camPitch + look.dy * 0.0028));

  const actions = input.takeActions();
  if (actions & ACTION_PUNCH) punch(G);
  if (actions & ACTION_ENTER) enterOrExit(G);

  // Hotwire progress on a locked car.
  if (p.hotwireTarget) {
    const t = p.hotwireTarget;
    const d = Math.hypot(t.x - p.x, t.z - p.z);
    p.hotwireT += dt;
    if (p.hotwireT >= 2) {
      t.locked = false;
      p.hotwireTarget = null;
      if (G.hud) G.hud.toast('Hotwired! The car is yours.');
      enterCar(G, t);
    }
    if (d > 4.5) { p.hotwireTarget = null; p.hotwireT = 0; }
  }

  if (p.car) {
    // Driving is handled by vehicles.driveVehicle in main.js; hide the ped mesh.
    p.mesh.visible = false;
    p.x = p.car.x;
    p.z = p.car.z;
    p.heading = p.car.heading;
    return actions;
  }
  p.mesh.visible = true;

  const walk = input.walk();
  const speed = walk.crouch ? PLAYER.crouchSpeed : walk.sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Camera-relative movement: forward is where the camera looks.
  const fx = Math.sin(p.camYaw);
  const fz = Math.cos(p.camYaw);
  const rx = Math.cos(p.camYaw);
  const rz = -Math.sin(p.camYaw);
  let mx = fx * walk.forward + rx * walk.strafe;
  let mz = fz * walk.forward + rz * walk.strafe;
  const ml = Math.hypot(mx, mz);
  if (ml > 0.01) {
    mx /= ml;
    mz /= ml;
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    const fixed = collideCircle(G.city.colliders, nx, nz, PLAYER.radius);
    p.x = fixed.x;
    p.z = fixed.z;
    p.heading = Math.atan2(mx, mz);
    p.walkPhase += dt * speed * 2.2;
  }
  // Jump + gravity (flat ground, y = 0).
  if (walk.jump && p.grounded) {
    p.vy = PLAYER.jumpSpeed;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= 22 * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }
  // Slow health regen out of combat.
  if (G.time - p.lastDamage > PLAYER.regenDelay && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + PLAYER.regenRate * dt);
  }
  // Beach edge: water blocks walking.
  if (p.z > 292) p.z = 292;
  if (Math.abs(p.x) > 296) p.x = Math.sign(p.x) * 296;
  if (p.z < -296) p.z = -296;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);

  const swing = Math.sin(p.walkPhase) * (ml > 0.01 ? 0.5 : 0);
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.mesh.position.set(p.x, p.y, p.z);
  p.mesh.rotation.y = p.heading;
  p.mesh.visible = true;
  return actions;
}

function punch(G) {
  const p = G.player;
  if (p.car || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  p.punchTimer = 0.25;
  if (G.audio) G.audio.punch();
  // Hit the nearest ped or gunman within 2 m in front.
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  for (const ped of G.peds) {
    const dx = ped.x - p.x;
    const dz = ped.z - p.z;
    if (Math.hypot(dx, dz) < 2.2 && dx * fx + dz * fz > 0) {
      ped.state = 'down';
      ped.stateT = 0;
      addHeat(G, 1);
      scarePeds(G, p.x, p.z, 14);
      if (G.hud) G.hud.feed('You knocked a pedestrian down — the police noticed.');
      return;
    }
  }
  for (const g of G.combat.gunmen) {
    const dx = g.x - p.x;
    const dz = g.z - p.z;
    if (Math.hypot(dx, dz) < 2.4 && dx * fx + dz * fz > 0) {
      g.health -= WEAPONS.fist.damage;
      if (G.effects) G.effects.hitSpark(g.x, 1.4, g.z);
      return;
    }
  }
}

function enterOrExit(G) {
  const p = G.player;
  if (p.car) {
    exitCar(G);
    return;
  }
  const car = nearestCar([...G.cars, ...G.traffic], p.x, p.z, 3.6);
  if (!car) return;
  if (car.locked) {
    p.hotwireTarget = car;
    p.hotwireT = 0;
    if (G.hud) G.hud.toast('Locked — hold on, hotwiring…');
    return;
  }
  enterCar(G, car);
}

export function enterCar(G, car) {
  const p = G.player;
  const wasTraffic = car.kind === 'traffic';
  if (wasTraffic) {
    // Pull the driver out: they flee, the theft is a crime if anyone sees it.
    const i = G.traffic.indexOf(car);
    if (i >= 0) G.traffic.splice(i, 1);
    car.kind = 'player';
    car.driver = null;
    addHeat(G, 1);
    scarePeds(G, car.x, car.z, 16);
    if (G.hud) G.hud.feed(`You stole a ${car.def.name} — wanted level up.`);
    if (G.audio) G.audio.siren(true);
  } else if (car.kind === 'parked') {
    car.kind = 'player';
    const seen = G.police.cars.length > 0 || Math.random() < 0.6;
    if (seen) addHeat(G, 1);
  } else {
    car.kind = 'player';
  }
  p.car = car;
  p.x = car.x;
  p.z = car.z;
  p.mesh.visible = false;
  if (G.audio) G.audio.door();
  if (G.missions) G.missions.onEnterCar(car);
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  // Step out to the left of the car.
  const lx = car.x + Math.cos(car.heading) * 1.8;
  const lz = car.z - Math.sin(car.heading) * 1.8;
  const fixed = collideCircle(G.city.colliders, lx, lz, PLAYER.radius);
  p.x = fixed.x;
  p.z = fixed.z;
  p.y = 0;
  p.camYaw = car.heading;
  car.speed = 0;
  car.kind = car.kind === 'player' ? 'parked' : car.kind;
  p.car = null;
  p.mesh.visible = true;
  if (G.audio) G.audio.door();
}
