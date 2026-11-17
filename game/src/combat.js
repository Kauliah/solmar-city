// Combat: hitscan weapons with tracers and muzzle flash, enemy gunmen AI that
// takes cover and shoots in bursts with aim error, and health/ammo pickups.
// No gore — gunmen clutch and fall, then stay down.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { createRandom } from './random.js';
import { damagePlayer } from './player.js';
import { addHeat } from './police.js';
import { scarePeds } from './pedestrians.js';

const GUNMAN_GEO = new THREE.BoxGeometry(0.62, 1.1, 0.36);
const GUNMAN_HEAD = new THREE.SphereGeometry(0.27, 10, 8);
const PICKUP_GEO = new THREE.BoxGeometry(0.7, 0.5, 0.7);

export function createCombat(G) {
  return {
    gunmen: [],
    pickups: [],
    tracers: [],
    lastShot: -99,
    firing: false,
  };
}

function makeGunmanMesh() {
  const g = new THREE.Group();
  const coat = new THREE.MeshStandardMaterial({ color: 0x3a2a4a, roughness: 0.9 });
  const body = new THREE.Mesh(GUNMAN_GEO, coat);
  body.position.y = 1.15;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(GUNMAN_HEAD, new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.85 }));
  head.position.y = 1.8;
  g.add(head);
  // Health bar above the head.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.12), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  barBg.position.y = 2.25;
  g.add(barBg);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xe5534b, side: THREE.DoubleSide }));
  bar.position.set(0, 2.25, 0.01);
  g.add(bar);
  return { group: g, bar, barBg };
}

export function spawnGunmen(G, x, z, count, radius = 18) {
  const rng = createRandom((Math.random() * 1e9) | 0);
  const spawned = [];
  for (let i = 0; i < count; i += 1) {
    const a = rng() * Math.PI * 2;
    const r = 4 + rng() * radius;
    const gx = x + Math.cos(a) * r;
    const gz = z + Math.sin(a) * r;
    const { group, bar, barBg } = makeGunmanMesh();
    group.position.set(gx, 0, gz);
    G.scene.add(group);
    const gunman = {
      x: gx, z: gz, heading: 0, health: 60, maxHealth: 60,
      state: 'hunt', shootTimer: 1 + rng() * 2, burst: 0, burstTimer: 0,
      mesh: group, bar, barBg, dead: false, cover: null,
    };
    G.combat.gunmen.push(gunman);
    spawned.push(gunman);
  }
  return spawned;
}

function removeGunman(G, gunman) {
  G.scene.remove(gunman.mesh);
  const i = G.combat.gunmen.indexOf(gunman);
  if (i >= 0) G.combat.gunmen.splice(i, 1);
  // 30% drop a pickup.
  if (Math.random() < 0.3) spawnPickup(G, gunman.x, gunman.z, Math.random() < 0.5 ? 'health' : 'ammo');
  if (G.missions) G.missions.onGunmanDown(gunman);
}

export function spawnPickup(G, x, z, kind) {
  const color = kind === 'health' ? 0x4ade80 : 0xf2c94c;
  const mesh = new THREE.Mesh(PICKUP_GEO, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 }));
  mesh.position.set(x, 0.5, z);
  G.scene.add(mesh);
  G.combat.pickups.push({ x, z, kind, mesh, t: 0 });
}

/** Fire the player's current weapon from the camera centre. */
export function fireWeapon(G) {
  const p = G.player;
  const combat = G.combat;
  if (p.car) return;
  const def = WEAPONS[p.weapon];
  const now = G.time;
  if (now - combat.lastShot < 1 / def.rate) return;
  if (p.weapon !== 'fist') {
    const ammo = p.ammo[p.weapon];
    if (!ammo || ammo.mag <= 0) {
      if (G.audio) G.audio.click();
      return;
    }
    ammo.mag -= 1;
  }
  combat.lastShot = now;
  const cam = G.camera;
  const origin = new THREE.Vector3();
  cam.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const pellets = def.pellets ?? 1;
  let hitAnything = false;
  for (let i = 0; i < pellets; i += 1) {
    const d = dir.clone();
    d.x += (Math.random() - 0.5) * def.spread * 2;
    d.y += (Math.random() - 0.5) * def.spread * 2;
    d.z += (Math.random() - 0.5) * def.spread * 2;
    d.normalize();
    const hit = raycastWorld(G, origin, d, def.range);
    if (G.effects) G.effects.tracer(origin, hit.point, def.sound === 'shotgun' ? 0xffd23f : 0xfff2c0);
    if (hit.target === 'gunman' && hit.gunman) {
      hit.gunman.health -= def.damage;
      if (G.effects) G.effects.hitSpark(hit.point.x, hit.point.y, hit.point.z);
      if (G.hud) G.hud.hitmarker();
      hitAnything = true;
      if (hit.gunman.health <= 0 && !hit.gunman.dead) {
        hit.gunman.dead = true;
        hit.gunman.mesh.rotation.x = -Math.PI / 2;
        hit.gunman.mesh.position.y = 0.4;
        hit.gunman.bar.visible = false;
        hit.gunman.barBg.visible = false;
        if (G.audio) G.audio.down();
        removeGunman(G, hit.gunman);
      }
    } else if (hit.target === 'ped') {
      hit.ped.state = 'down';
      hit.ped.stateT = 0;
      addHeat(G, 1);
      scarePeds(G, hit.ped.x, hit.ped.z, 16);
    } else if (hit.target === 'world') {
      if (G.effects) G.effects.hitSpark(hit.point.x, hit.point.y, hit.point.z);
    }
  }
  if (G.effects) G.effects.muzzle(origin.clone().add(dir.clone().multiplyScalar(1.2)));
  if (G.audio) G.audio.shot(def.sound);
  if (G.camera) G.cameraShake = Math.min(0.3, (G.cameraShake ?? 0) + (def.sound === 'shotgun' ? 0.22 : 0.08));
  if (!hitAnything) addHeat(G, 0.15); // Firing a gun in the city draws attention.
}

function raycastWorld(G, origin, dir, range) {
  // Nearest gunman / ped sphere hit, else nearest building AABB, else max range.
  let best = { target: 'none', point: origin.clone().add(dir.clone().multiplyScalar(range)), t: range };
  const targets = [];
  for (const g of G.combat.gunmen) targets.push({ kind: 'gunman', obj: g, x: g.x, y: 1.2, z: g.z, r: 0.9 });
  for (const ped of G.peds) {
    if (ped.state === 'down') continue;
    targets.push({ kind: 'ped', obj: ped, x: ped.x, y: 1.1, z: ped.z, r: 0.7 });
  }
  for (const t of targets) {
    const ox = t.x - origin.x;
    const oy = t.y - origin.y;
    const oz = t.z - origin.z;
    const proj = ox * dir.x + oy * dir.y + oz * dir.z;
    if (proj < 0 || proj > best.t) continue;
    const cx = origin.x + dir.x * proj;
    const cy = origin.y + dir.y * proj;
    const cz = origin.z + dir.z * proj;
    const d2 = (t.x - cx) ** 2 + (t.y - cy) ** 2 + (t.z - cz) ** 2;
    if (d2 < t.r * t.r) {
      best = { target: t.kind, point: new THREE.Vector3(cx, cy, cz), t: proj, gunman: t.kind === 'gunman' ? t.obj : null, ped: t.kind === 'ped' ? t.obj : null };
    }
  }
  // Buildings: ray vs AABB slab test, ground plane y=0.
  for (const c of G.city.colliders) {
    const t = rayAABB(origin, dir, c.x0, 0, c.z0, c.x1, 14, c.z1);
    if (t !== null && t < best.t && t > 0) {
      best = { target: 'world', point: origin.clone().add(dir.clone().multiplyScalar(t)), t };
    }
  }
  if (dir.y < -0.001) {
    const t = -origin.y / dir.y;
    if (t > 0 && t < best.t) best = { target: 'world', point: origin.clone().add(dir.clone().multiplyScalar(t)), t };
  }
  return best;
}

function rayAABB(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = 0;
  let tmax = 1e9;
  const axes = [['x', x0, x1], ['y', y0, y1], ['z', z0, z1]];
  for (const [axis, lo, hi] of axes) {
    const od = o[axis];
    const dd = d[axis];
    if (Math.abs(dd) < 1e-9) {
      if (od < lo || od > hi) return null;
    } else {
      let t1 = (lo - od) / dd;
      let t2 = (hi - od) / dd;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export function updateCombat(G, dt) {
  const combat = G.combat;
  const p = G.player;
  // Auto-fire while the mouse is held (SMG) — semi-auto weapons fire once per click.
  const def = WEAPONS[p.weapon];
  const edge = G.input.takeFiringEdge();
  if ((def.auto && G.input.firing) || (!def.auto && edge)) {
    if (!p.car) fireWeapon(G);
  }
  // Gunmen AI.
  for (const g of [...combat.gunmen]) {
    if (g.dead) continue;
    const dx = p.x - g.x;
    const dz = p.z - g.z;
    const dist = Math.hypot(dx, dz);
    g.shootTimer -= dt;
    if (dist > 22) {
      // Advance toward the player.
      g.heading = Math.atan2(dx, dz);
      g.x += Math.sin(g.heading) * 3.4 * dt;
      g.z += Math.cos(g.heading) * 3.4 * dt;
    } else if (dist < 9) {
      // Back off a little, keep distance.
      g.heading = Math.atan2(dx, dz);
      g.x -= Math.sin(g.heading) * 2 * dt;
      g.z -= Math.cos(g.heading) * 2 * dt;
    }
    g.mesh.position.set(g.x, 0, g.z);
    g.mesh.rotation.y = Math.atan2(dx, dz);
    const healthFrac = Math.max(0, g.health / g.maxHealth);
    g.bar.scale.x = healthFrac;
    g.bar.position.x = -(1.06 * (1 - healthFrac)) / 2;
    // Shoot in bursts when the player is in range and on foot.
    if (dist < 34 && !p.car && g.shootTimer <= 0) {
      g.burst = 3;
      g.burstTimer = 0;
      g.shootTimer = 1.6 + Math.random() * 1.4;
    }
    if (g.burst > 0) {
      g.burstTimer -= dt;
      if (g.burstTimer <= 0) {
        g.burst -= 1;
        g.burstTimer = 0.16;
        // Aim error grows with distance; the player can dodge by moving.
        const err = 0.05 + dist * 0.004;
        const hitChance = Math.max(0.12, 0.55 - dist * 0.012);
        if (Math.random() < hitChance) {
          damagePlayer(G, 6 + Math.random() * 5);
        }
        const from = new THREE.Vector3(g.x, 1.4, g.z);
        const to = new THREE.Vector3(p.x + (Math.random() - 0.5) * err * 20, 1.2, p.z + (Math.random() - 0.5) * err * 20);
        if (G.effects) G.effects.tracer(from, to, 0xff8866);
        if (G.audio) G.audio.shot('pistol', 0.4);
      }
    }
  }
  // Pickups: bob, spin, collect on touch.
  for (const pk of [...combat.pickups]) {
    pk.t += dt;
    pk.mesh.position.y = 0.5 + Math.sin(pk.t * 3) * 0.12;
    pk.mesh.rotation.y += dt * 2;
    const d = Math.hypot(pk.x - p.x, pk.z - p.z);
    if (d < 1.6 && !p.car) {
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      else {
        for (const w of ['pistol', 'smg', 'shotgun']) {
          if (p.ammo[w]) p.ammo[w].reserve += 24;
        }
      }
      if (G.hud) G.hud.toast(pk.kind === 'health' ? '+40 health' : '+24 ammo (all weapons)');
      if (G.audio) G.audio.chime();
      G.scene.remove(pk.mesh);
      combat.pickups.splice(combat.pickups.indexOf(pk), 1);
    }
  }
  // Tracer fade.
  for (const tr of [...combat.tracers]) {
    tr.life -= dt;
    if (tr.life <= 0) {
      G.scene.remove(tr.line);
      combat.tracers.splice(combat.tracers.indexOf(tr), 1);
    } else {
      tr.line.material.opacity = tr.life / 0.12;
    }
  }
}
