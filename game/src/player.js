// Solmar City — the player on foot: third-person WASD movement relative to
// the camera, sprint, jump, health with slow regen, and collision.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { collideCircle } from './city.js';
import { wasted } from './police.js';

export function createPlayer(G) {
  const p = {
    x: 0, z: 120,
    y: 0, vy: 0,
    heading: 0,
    health: PLAYER.health,
    armour: 0,
    onGround: true,
    car: null,
    weapon: 'fists',
    ammo: {},
    lastHurt: -99,
    moving: false,
    mesh: null,
  };
  p.ammo = { pistol: { mag: 12, reserve: 96 }, smg: { mag: 28, reserve: 168 }, shotgun: { mag: 6, reserve: 36 } };
  return p;
}

export function buildPlayerMesh(G) {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x17a398 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2a3442 });
  const hair = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.8;
  head.castShadow = true;
  group.add(head);
  const hairM = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.46), hair);
  hairM.position.y = 2.02;
  group.add(hairM);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.3), pants);
    leg.position.set(sx * 0.18, 0.38, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), shirt);
    arm.position.set(sx * 0.48, 1.15, 0);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  group.userData.walkPhase = 0;
  G.scene.add(group);
  return group;
}

/** Swing the limbs while walking; called every rendered frame. */
export function animatePlayerMesh(G, dt) {
  const p = G.player;
  const mesh = p.mesh;
  if (!mesh) return;
  mesh.position.set(p.x, p.y, p.z);
  mesh.rotation.y = p.heading;
  if (p.moving) {
    mesh.userData.walkPhase += dt * 11;
    const s = Math.sin(mesh.userData.walkPhase);
    mesh.userData.legs[0].rotation.x = s * 0.7;
    mesh.userData.legs[1].rotation.x = -s * 0.7;
    mesh.userData.arms[0].rotation.x = -s * 0.55;
    mesh.userData.arms[1].rotation.x = s * 0.55;
  } else {
    mesh.userData.legs[0].rotation.x *= 0.8;
    mesh.userData.legs[1].rotation.x *= 0.8;
    mesh.userData.arms[0].rotation.x *= 0.8;
    mesh.userData.arms[1].rotation.x *= 0.8;
  }
  mesh.visible = !p.car;
}

export function stepPlayer(G, dt) {
  const p = G.player;
  if (p.car) return; // driving is handled by vehicles.js
  const input = G.input;
  const fwd = input.throttle();
  const strafe = input.steer();
  const sprint = input.sprint();
  p.moving = fwd !== 0 || strafe !== 0;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  // Movement is camera-relative: W walks away from the camera.
  const cam = G.cameraYaw;
  const sin = Math.sin(cam);
  const cos = Math.cos(cam);
  let mx = 0;
  let mz = 0;
  if (fwd !== 0) { mx += -sin * fwd; mz += -cos * fwd; }
  if (strafe !== 0) { mx += cos * strafe; mz += -sin * strafe; }
  const len = Math.hypot(mx, mz);
  if (len > 0) {
    mx /= len;
    mz /= len;
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    const [cx, cz] = collideCircle(G, nx, nz, PLAYER.radius);
    p.x = cx;
    p.z = cz;
    p.heading = Math.atan2(mx, mz);
  }
  // Jump + gravity; no fall damage, the ground is flat.
  if (p.onGround && G.jumpQueued) {
    p.vy = PLAYER.jumpSpeed;
    p.onGround = false;
  }
  G.jumpQueued = false;
  if (!p.onGround) {
    p.vy -= PLAYER.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  // Slow health regen out of combat.
  if (G.time - p.lastHurt > PLAYER.regenDelay && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + PLAYER.regenRate * dt);
  }
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.health <= 0) return;
  let left = amount;
  if (p.armour > 0) {
    const absorbed = Math.min(p.armour, left);
    p.armour -= absorbed;
    left -= absorbed;
  }
  p.health -= left;
  p.lastHurt = G.time;
  G.effects.damageFlash(G);
  G.audio.hurt(G);
  if (p.health <= 0) {
    p.health = 0;
    wasted(G);
  }
}
