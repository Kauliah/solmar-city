// Juno Reyes on foot: third-person movement, sprint, jump, punch, health and regen.
// The mesh is a simple articulated figure whose limbs swing with the stride.
import * as THREE from 'three';
import { clamp } from './random.js';
import { collideCircle, inCityBounds } from './city.js';

const WALK_SPEED = 5.2;
const SPRINT_SPEED = 8.5;

export function createPlayerMesh() {
  const group = new THREE.Group();
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff6b4a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.36), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.84;
  group.add(hair);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.26), pants);
  legL.position.set(-0.17, 0.39, 0);
  legL.geometry.translate(0, -0.39, 0);
  legL.position.y = 0.78;
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.22), shirt);
  armL.position.set(-0.42, 1.5, 0);
  armL.geometry.translate(0, -0.34, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

export function createPlayer(G) {
  const mesh = createPlayerMesh();
  mesh.position.copy(G.landmarks.spawn);
  G.scene.add(mesh);
  return {
    mesh,
    heading: 0,
    speed: 0,
    health: 100,
    armor: 0,
    cash: G.save.cash,
    weapon: 'pistol',
    ammo: { mag: 12, reserve: 120 },
    inCar: null,
    vy: 0,
    grounded: true,
    punchTimer: 0,
    hurtTimer: 0,
    regenTimer: 0,
    walkPhase: 0,
  };
}

export function stepPlayer(G, input, dt) {
  const p = G.player;
  if (p.inCar) return;
  const camYaw = G.camera.yaw;
  let mx = 0;
  let mz = 0;
  if (input.held('forward')) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
  if (input.held('back')) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
  if (input.held('left')) { mx += Math.sin(camYaw - Math.PI / 2); mz += Math.cos(camYaw - Math.PI / 2); }
  if (input.held('right')) { mx += Math.sin(camYaw + Math.PI / 2); mz += Math.cos(camYaw + Math.PI / 2); }
  const moving = mx !== 0 || mz !== 0;
  const speed = input.held('sprint') ? SPRINT_SPEED : WALK_SPEED;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    p.mesh.position.x += mx * speed * dt;
    p.mesh.position.z += mz * speed * dt;
    p.heading = Math.atan2(mx, mz);
    p.walkPhase += dt * speed * 1.6;
  }
  // Jump: simple vertical arc, no fall damage.
  if (input.held('jump') && p.grounded) {
    p.vy = 6.5;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.vy -= 18 * dt;
    p.mesh.position.y += p.vy * dt;
    if (p.mesh.position.y <= 0) {
      p.mesh.position.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }
  // Keep inside the city and out of buildings.
  p.mesh.position.x = clamp(p.mesh.position.x, -296, 296);
  p.mesh.position.z = clamp(p.mesh.position.z, -296, 294);
  collideCircle(G, p.mesh.position, 0.5);
  if (!inCityBounds(p.mesh.position.x, p.mesh.position.z)) {
    p.mesh.position.x = clamp(p.mesh.position.x, -296, 296);
    p.mesh.position.z = clamp(p.mesh.position.z, -296, 294);
  }
  // Limb swing.
  const swing = moving ? Math.sin(p.walkPhase) * 0.55 : 0;
  const u = p.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  p.mesh.rotation.y = p.heading;
  // Slow regen out of combat.
  if (p.hurtTimer > 0) p.hurtTimer -= dt;
  else if (p.health < 100) {
    p.regenTimer += dt;
    if (p.regenTimer > 1) {
      p.regenTimer = 0;
      p.health = Math.min(100, p.health + 2);
    }
  }
  if (p.punchTimer > 0) p.punchTimer -= dt;
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.hurtTimer > 0.2) return;
  p.hurtTimer = 0.6;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  G.camera.shake = Math.min(1, G.camera.shake + 0.35);
  G.hud.flashDamage();
  if (p.health <= 0) {
    p.health = 0;
    G.police.wasted(G);
  }
}
