// Pedestrians: walkers on the sidewalks who stroll between waypoints, flee
// screaming (a "!" bubble) when shots or crashes happen nearby, and get up and
// limp away when knocked down. No gore — they clutch and limp.
import * as THREE from 'three';
import { ROAD_AXES } from './config.js';
import { createRandom } from './random.js';

const COUNT = 24;
const SHIRT_COLORS = [0xd86a5a, 0x5a98b8, 0x7fae62, 0xf2c94c, 0x8a6a9a, 0xe8e4d8, 0x2f6fd8, 0xff6b4a];
const BODY_GEO = new THREE.BoxGeometry(0.55, 1.05, 0.34);
const HEAD_GEO = new THREE.SphereGeometry(0.26, 10, 8);
const LEG_GEO = new THREE.BoxGeometry(0.2, 0.8, 0.22);

const shirtMats = new Map();
function shirtMat(color) {
  if (!shirtMats.has(color)) shirtMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
  return shirtMats.get(color);
}
const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a878, roughness: 0.85 });
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.95 });

function makePedMesh(color, height) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(BODY_GEO, shirtMat(color));
  body.position.y = 1.15 * height;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(HEAD_GEO, skinMat);
  head.position.y = 1.78 * height;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(LEG_GEO, pantsMat);
  legL.position.set(-0.14, 0.4 * height, 0);
  g.add(legL);
  const legR = new THREE.Mesh(LEG_GEO, pantsMat);
  legR.position.set(0.14, 0.4 * height, 0);
  g.add(legR);
  // "!" bubble, hidden until the ped panics.
  const bubble = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
  bubble.position.y = 2.3 * height;
  bubble.visible = false;
  g.add(bubble);
  return { group: g, legL, legR, bubble };
}

/** A sidewalk waypoint near a road axis. */
function sidewalkPoint(rng) {
  const axis = ROAD_AXES[Math.floor(rng() * ROAD_AXES.length)];
  const along = -260 + rng() * 520;
  const side = rng() < 0.5 ? -1 : 1;
  if (rng() < 0.5) return [axis + side * 8.5, along];
  return [along, axis + side * 8.5];
}

export function createPeds(G) {
  const rng = createRandom(G.seed + 202);
  const peds = [];
  for (let i = 0; i < COUNT; i += 1) {
    const color = SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)];
    const height = 0.92 + rng() * 0.2;
    const [x, z] = sidewalkPoint(rng);
    const [tx, tz] = sidewalkPoint(rng);
    const { group, legL, legR, bubble } = makePedMesh(color, height);
    group.position.set(x, 0, z);
    G.scene.add(group);
    peds.push({
      id: `ped-${i}`,
      x, z, tx, tz,
      heading: Math.atan2(tx - x, tz - z),
      speed: 1.1 + rng() * 0.5,
      state: 'stroll', // stroll | flee | down
      stateT: 0,
      walkPhase: rng() * 6,
      height,
      mesh: group,
      legL, legR, bubble,
      special: null, // 'taxi' | 'mission' — set by missions.js
    });
  }
  return peds;
}

/** Scare every ped within `radius` of (x, z): they run away from the point. */
export function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < radius && ped.state !== 'down') {
      ped.state = 'flee';
      ped.stateT = 0;
      ped.fx = ped.x - x;
      ped.fz = ped.z - z;
      ped.bubble.visible = true;
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    ped.stateT += dt;
    if (ped.state === 'down') {
      ped.mesh.position.y = -0.4;
      if (ped.stateT > 3) {
        ped.state = 'flee';
        ped.stateT = 0;
        ped.fx = ped.x - G.player.x;
        ped.fz = ped.z - G.player.z;
        ped.mesh.position.y = 0;
      }
      continue;
    }
    let targetX = ped.tx;
    let targetZ = ped.tz;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      const len = Math.hypot(ped.fx, ped.fz) || 1;
      targetX = ped.x + (ped.fx / len) * 20;
      targetZ = ped.z + (ped.fz / len) * 20;
      speed = ped.speed * 3.2;
      if (ped.stateT > 6) {
        ped.state = 'stroll';
        ped.bubble.visible = false;
        [ped.tx, ped.tz] = sidewalkPoint(createRandom((Math.random() * 1e9) | 0));
      }
    }
    const dx = targetX - ped.x;
    const dz = targetZ - ped.z;
    const d = Math.hypot(dx, dz);
    if (d < 2) {
      const rng = createRandom((Math.random() * 1e9) | 0);
      [ped.tx, ped.tz] = sidewalkPoint(rng);
      continue;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-3 * dt, Math.min(3 * dt, dh * 6 * dt));
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    // Keep peds off the sea and out of buildings.
    if (ped.z > 266) ped.z = 266;
    if (Math.abs(ped.x) > 292) ped.x = Math.sign(ped.x) * 292;
    if (ped.z < -292) ped.z = -292;
    ped.walkPhase += dt * speed * 4;
    const swing = Math.sin(ped.walkPhase) * 0.45;
    ped.legL.rotation.x = swing;
    ped.legR.rotation.x = -swing;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    ped.bubble.lookAt(G.camera.position);
  }
}
