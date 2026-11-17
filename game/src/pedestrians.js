// Solmar City — pedestrians: walkers strolling the sidewalks with varied
// clothes and heights, a limb-swing walk, and a flee response (run away with
// a "!" bubble) when shots or crashes happen nearby.
import * as THREE from 'three';
import { ROADS } from './config.js';
import { PED_COLORS } from './palette.js';
import { pick, range, rangeInt } from './random.js';
import { policeHeat } from './police.js';

const PED_COUNT = 24;

export function initPedestrians(G) {
  G.peds = [];
  const geoBody = new THREE.BoxGeometry(0.55, 0.8, 0.35);
  const geoHead = new THREE.BoxGeometry(0.36, 0.36, 0.36);
  const geoLeg = new THREE.BoxGeometry(0.2, 0.7, 0.24);
  for (let i = 0; i < PED_COUNT; i += 1) spawnPed(G, geoBody, geoHead, geoLeg, true);
}

function spawnPed(G, geoBody, geoHead, geoLeg, anywhere) {
  const rng = G.rng;
  const road = pick(rng, ROADS);
  const along = range(rng, -280, 280);
  const side = rng() < 0.5 ? 1 : -1;
  const horizontal = rng() < 0.5;
  const x = horizontal ? along : road + side * 10;
  const z = horizontal ? road + side * 10 : along;
  const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_COLORS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(rng, [0x2a3442, 0x5a5348, 0x3a3f47, 0x8a5a3d]) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(rng, [0xc98a5a, 0x8a5a3d, 0xe8b88a, 0x6a4a2a]) });
  const group = new THREE.Group();
  const h = range(rng, 0.9, 1.1);
  const torso = new THREE.Mesh(geoBody, shirt);
  torso.position.y = 1.05 * h;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(geoHead, skin);
  head.position.y = 1.62 * h;
  group.add(head);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(geoLeg, pants);
    leg.position.set(sx * 0.14, 0.35 * h, 0);
    group.add(leg);
    legs.push(leg);
  }
  group.scale.setScalar(h);
  group.position.set(x, 0, z);
  G.scene.add(group);
  const ped = {
    x, z,
    heading: rng() * Math.PI * 2,
    speed: range(rng, 1.2, 2.2),
    mesh: group,
    legs,
    phase: rng() * 6,
    flee: 0,
    target: null,
    car: null, // traffic car this ped drives, if any
    knocked: 0,
  };
  G.peds.push(ped);
  return ped;
}

/** Make every ped within radius flee from (x, z). */
export function scarePeds(G, x, z, radius) {
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.flee = 4 + G.rng() * 2;
  }
}

export function stepPedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.knocked > 0) {
      ped.knocked -= dt;
      ped.mesh.rotation.x = Math.min(1.4, ped.mesh.rotation.x + dt * 6);
      if (ped.knocked <= 0) {
        ped.mesh.rotation.x = 0;
        ped.flee = 5;
      }
      continue;
    }
    ped.mesh.rotation.x = 0;
    let speed = ped.speed;
    let heading = ped.heading;
    if (ped.flee > 0) {
      ped.flee -= dt;
      speed = 6.5;
      // Run directly away from the player.
      heading = Math.atan2(ped.x - p.x, ped.z - p.z);
    } else {
      // Stroll along the sidewalk; turn at the grid edge or randomly.
      const onRoad = ROADS.some((r) => Math.abs(ped.z - r) < 11 || Math.abs(ped.x - r) < 11);
      if (!onRoad || G.rng() < dt * 0.02) {
        const road = pick(G.rng, ROADS);
        const side = G.rng() < 0.5 ? 1 : -1;
        const horizontal = G.rng() < 0.5;
        ped.target = horizontal ? { x: range(G.rng, -280, 280), z: road + side * 10 }
          : { x: road + side * 10, z: range(G.rng, -280, 280) };
      }
      if (ped.target) {
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const d = Math.hypot(dx, dz);
        if (d < 2) ped.target = null;
        else heading = Math.atan2(dx, dz);
      }
    }
    // Smooth heading turns.
    let dh = heading - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += Math.max(-3 * dt, Math.min(3 * dt, dh));
    ped.x += Math.sin(ped.heading) * speed * dt;
    ped.z += Math.cos(ped.heading) * speed * dt;
    ped.x = Math.max(-295, Math.min(295, ped.x));
    ped.z = Math.max(-295, Math.min(295, ped.z));
    ped.phase += dt * speed * 4;
    const s = Math.sin(ped.phase);
    ped.legs[0].rotation.x = s * 0.6;
    ped.legs[1].rotation.x = -s * 0.6;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // A car hitting a ped knocks them down (no gore — they get up and limp off).
    const car = p.car;
    if (car && Math.abs(car.speed) > 4 && Math.hypot(ped.x - car.x, ped.z - car.z) < 2.2) {
      ped.knocked = 2.5;
      G.effects.spark(G, ped.x, ped.z);
      G.audio.thud(G);
      G.wanted = Math.min(5, G.wanted + 1);
      policeHeat(G, 8);
      scarePeds(G, ped.x, ped.z, 30);
    }
  }
}
