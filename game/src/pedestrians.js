// Pedestrians: walkers strolling the sidewalks, varied clothes and heights, limbs swinging.
// They flee (with a "!" bubble) when shots or crashes happen nearby, and limp away when hit.
import * as THREE from 'three';
import { AVENUES, STREETS } from './config.js';
import { pick, range } from './random.js';
import { createPlayerMesh } from './player.js';

const PED_COUNT = 24;
const SHIRT_COLORS = [0xe8a87c, 0xa8c8d8, 0xd8e8c8, 0xf2d8a7, 0xc8a8d8, 0x8ab8a8, 0xe8c8c8];

function sidewalkPoint(rng) {
  // A point just off a road: on a sidewalk strip.
  if (rng() < 0.5) {
    const a = pick(rng, AVENUES);
    return new THREE.Vector3(a + (rng() < 0.5 ? -9 : 9), 0, range(rng, -280, 280));
  }
  const s = pick(rng, STREETS);
  return new THREE.Vector3(range(rng, -280, 280), 0, s + (rng() < 0.5 ? -9 : 9));
}

export function createPedestrians(G) {
  const peds = { list: [] };
  for (let i = 0; i < PED_COUNT; i += 1) {
    spawnWalker(G, 0, 0, 'walk', peds);
  }
  return peds;
}

export function spawnWalker(G, x, z, state, store) {
  const list = store ? store.list : G.pedestrians.list;
  const mesh = createPlayerMesh();
  const shirtMat = mesh.children[0].material.clone();
  shirtMat.color = new THREE.Color(pick(G.rng, SHIRT_COLORS));
  mesh.children[0].material = shirtMat;
  const scale = range(G.rng, 0.9, 1.12);
  mesh.scale.setScalar(scale);
  const pos = (x === 0 && z === 0) ? sidewalkPoint(G.rng) : new THREE.Vector3(x, 0, z);
  mesh.position.copy(pos);
  mesh.castShadow = true;
  G.scene.add(mesh);
  // "!" bubble shown while fleeing.
  const bubble = makeBubble(G);
  bubble.position.set(0, 2.4, 0);
  mesh.add(bubble);
  const ped = {
    mesh, bubble,
    state: state || 'walk',
    heading: range(G.rng, 0, Math.PI * 2),
    speed: range(G.rng, 1.2, 2.0),
    target: sidewalkPoint(G.rng),
    fleeFrom: null,
    downTimer: 0,
    phase: range(G.rng, 0, Math.PI * 2),
  };
  list.push(ped);
  return ped;
}

function makeBubble(G) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(32, 28, 24, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff2e2e';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('!', 32, 42);
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.1, 1.1, 1);
  sprite.visible = false;
  return sprite;
}

export function stepPedestrians(G, dt) {
  for (const ped of G.pedestrians.list) {
    if (ped.downTimer > 0) {
      ped.downTimer -= dt;
      ped.mesh.rotation.x = -Math.PI / 2 * Math.min(1, ped.downTimer);
      if (ped.downTimer <= 0) {
        ped.mesh.rotation.x = 0;
        ped.state = 'flee';
        ped.fleeFrom = G.player.mesh.position.clone();
      }
      continue;
    }
    let target = ped.target;
    let speed = ped.speed;
    if (ped.state === 'flee' && ped.fleeFrom) {
      const away = new THREE.Vector3().subVectors(ped.mesh.position, ped.fleeFrom);
      away.y = 0;
      if (away.lengthSq() < 0.01) away.set(1, 0, 0);
      away.normalize();
      target = new THREE.Vector3().copy(ped.mesh.position).addScaledVector(away, 30);
      speed = 5.2;
      ped.bubble.visible = true;
      if (ped.mesh.position.distanceTo(ped.fleeFrom) > 45) {
        ped.state = 'walk';
        ped.bubble.visible = false;
        ped.target = sidewalkPoint(G.rng);
      }
    }
    const dx = target.x - ped.mesh.position.x;
    const dz = target.z - ped.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) {
      if (ped.state === 'walk') ped.target = sidewalkPoint(G.rng);
      continue;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    ped.mesh.position.x += Math.sin(ped.heading) * speed * dt;
    ped.mesh.position.z += Math.cos(ped.heading) * speed * dt;
    ped.mesh.rotation.y = ped.heading;
    ped.phase += dt * speed * 2.4;
    const swing = Math.sin(ped.phase) * 0.5;
    const u = ped.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.7;
    u.armR.rotation.x = swing * 0.7;
  }
}

export function fleeFrom(G, pos, radius) {
  for (const ped of G.pedestrians.list) {
    const d = Math.hypot(ped.mesh.position.x - pos.x, ped.mesh.position.z - pos.z);
    if (d < radius && ped.downTimer <= 0) {
      ped.state = 'flee';
      ped.fleeFrom = pos.clone();
    }
  }
}

// A hit pedestrian falls, then gets up and limps away. No gore — they clutch and leave.
export function knockPed(G, ped) {
  if (ped.downTimer > 0) return;
  ped.downTimer = 2.2;
  ped.bubble.visible = false;
  G.police.addHeat(1);
}
