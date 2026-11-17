// Combat: hitscan weapons with tracers and muzzle flash, Harbor Kings gunmen who take
// cover and shoot in bursts, and health/ammo pickups. No gore — gunmen fall and stay down.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { clamp } from './random.js';
import { damagePlayer } from './player.js';
import { knockPed } from './pedestrians.js';

function tracerLine(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  setTimeout(() => { G.scene.remove(line); geo.dispose(); }, 70);
}

export function createCombat(G) {
  return {
    enemies: [],
    fireTimer: 0,
    muzzle: null,
    spawnGunmen(positions, count) {
      for (let i = 0; i < count; i += 1) {
        const pos = positions[i % positions.length];
        const mesh = makeGunman(G);
        mesh.position.set(pos.x + (Math.random() - 0.5) * 6, 0, pos.z + (Math.random() - 0.5) * 6);
        G.scene.add(mesh);
        const enemy = { mesh, health: 100, state: 'fight', shootTimer: 1 + Math.random(), burst: 0, bar: makeHealthBar() };
        enemy.bar.position.set(0, 2.3, 0);
        mesh.add(enemy.bar);
        this.enemies.push(enemy);
      }
    },
    clearEnemies() {
      for (const e of this.enemies) G.scene.remove(e.mesh);
      this.enemies = [];
    },
    aliveCount() {
      return this.enemies.filter((e) => e.health > 0).length;
    },
  };
}

function makeGunman(G) {
  const group = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: 0x2a2a3a });
  const skin = new THREE.MeshLambertMaterial({ color: 0xb87a4a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 0.4), suit);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
  head.position.y = 1.78;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x8a1a1a }));
  cap.position.y = 1.98;
  group.add(cap);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.3, 0.4);
  group.add(gun);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 0.26), suit);
  legL.position.set(-0.17, 0.39, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.17;
  group.add(legR);
  return group;
}

function makeHealthBar() {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.8, depthWrite: false }));
  const fg = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2e2e, depthWrite: false }));
  fg.position.z = 0.01;
  group.add(bg); group.add(fg);
  group.userData.fg = fg;
  return group;
}

export function playerShoot(G) {
  const p = G.player;
  const combat = G.combat;
  if (combat.fireTimer > 0 || p.inCar) return;
  const w = WEAPONS[p.weapon];
  if (p.weapon !== 'fists') {
    if (p.ammo.mag <= 0) {
      G.hud.banner('Out of ammo — press R to reload', '#ff6b4a');
      G.audio.click();
      combat.fireTimer = 0.3;
      return;
    }
    p.ammo.mag -= 1;
  }
  combat.fireTimer = w.rate;
  const cam = G.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  const origin = cam.position.clone();
  // Muzzle flash at the player's hands.
  const muzzlePos = p.mesh.position.clone();
  muzzlePos.y = 1.4;
  muzzlePos.addScaledVector(new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading)), 0.6);
  G.effects.muzzle(muzzlePos, dir);
  G.audio.shot(p.weapon);
  const pellets = w.pellets || 1;
  let hitSomething = false;
  for (let i = 0; i < pellets; i += 1) {
    const d = dir.clone();
    d.x += (Math.random() - 0.5) * w.spread * 2;
    d.y += (Math.random() - 0.5) * w.spread * 2;
    d.z += (Math.random() - 0.5) * w.spread * 2;
    d.normalize();
    const end = origin.clone().addScaledVector(d, w.range);
    // Enemies first.
    let best = null;
    let bestT = w.range;
    for (const e of combat.enemies) {
      if (e.health <= 0) continue;
      const to = new THREE.Vector3().subVectors(e.mesh.position.clone().setY(1.2), origin);
      const t = to.dot(d);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(d, t);
      if (closest.distanceTo(e.mesh.position.clone().setY(1.2)) < 1.1) { best = e; bestT = t; }
    }
    if (best) {
      best.health -= w.damage;
      best.bar.userData.fg.scale.x = Math.max(0.01, best.health / 100);
      best.bar.userData.fg.position.x = -(1.06 - 1.06 * Math.max(0, best.health / 100)) / 2;
      end.copy(origin).addScaledVector(d, bestT);
      hitSomething = true;
      if (best.health <= 0) {
        best.mesh.rotation.x = -Math.PI / 2;
        best.mesh.position.y = 0.3;
        G.effects.burst(best.mesh.position, 0xff2e2e, 10, 3, 3);
        G.hud.feed('Kings gunman down.');
        G.missions.onKill(G);
      }
    }
    // Pedestrians can be hit too — they fall and the cops notice.
    for (const ped of G.pedestrians.list) {
      if (ped.downTimer > 0) continue;
      const to = new THREE.Vector3().subVectors(ped.mesh.position.clone().setY(1.1), origin);
      const t = to.dot(d);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(d, t);
      if (closest.distanceTo(ped.mesh.position.clone().setY(1.1)) < 0.9) {
        knockPed(G, ped);
        hitSomething = true;
      }
    }
    tracerLine(G, muzzlePos, end);
  }
  if (hitSomething) G.hud.hitmarker();
  // Shooting in public draws heat.
  G.police.addHeat(0.4);
  G.pedestrians.fleeFrom(G, p.mesh.position, 26);
}

export function playerPunch(G) {
  const p = G.player;
  if (p.punchTimer > 0 || p.inCar) return;
  p.punchTimer = 0.45;
  G.audio.punch();
  const forward = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  const fist = p.mesh.position.clone().addScaledVector(forward, 1.2);
  fist.y = 1.3;
  for (const e of G.combat.enemies) {
    if (e.health <= 0) continue;
    if (e.mesh.position.distanceTo(fist) < 1.6) {
      e.health -= WEAPONS.fists.damage;
      G.hud.hitmarker();
      if (e.health <= 0) {
        e.mesh.rotation.x = -Math.PI / 2;
        G.missions.onKill(G);
      }
    }
  }
  for (const ped of G.pedestrians.list) {
    if (ped.downTimer > 0) continue;
    if (ped.mesh.position.distanceTo(fist) < 1.4) knockPed(G, ped);
  }
}

export function reloadWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  if (p.weapon === 'fists' || p.ammo.mag === w.mag || p.ammo.reserve <= 0) return;
  const need = w.mag - p.ammo.mag;
  const take = Math.min(need, p.ammo.reserve);
  p.ammo.mag += take;
  p.ammo.reserve -= take;
  G.audio.click();
  G.hud.banner(`Reloaded ${w.name}.`, '#f4f0e6');
}

export function stepCombat(G, dt) {
  const combat = G.combat;
  if (combat.fireTimer > 0) combat.fireTimer -= dt;
  const p = G.player;
  for (const e of combat.enemies) {
    if (e.health <= 0) continue;
    const toPlayer = new THREE.Vector3().subVectors(p.mesh.position, e.mesh.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    e.mesh.lookAt(p.mesh.position.x, 0, p.mesh.position.z);
    e.bar.lookAt(G.three.camera.position);
    if (dist > 26) {
      // Close the distance.
      toPlayer.normalize();
      e.mesh.position.addScaledVector(toPlayer, 3.2 * dt);
    } else if (dist > 6) {
      // Strafe a little, shoot in bursts.
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.burst = 3;
        e.shootTimer = 1.6 + Math.random() * 1.4;
      }
      if (e.burst > 0) {
        e.burst -= dt * 6;
        if (Math.random() < dt * 6) {
          G.audio.shot('pistol');
          const from = e.mesh.position.clone().setY(1.4);
          const to = p.mesh.position.clone().setY(1.2);
          to.x += (Math.random() - 0.5) * 2.4;
          to.z += (Math.random() - 0.5) * 2.4;
          tracerLine(G, from, to);
          // 1 in 4 bursts lands a hit.
          if (Math.random() < 0.25) damagePlayer(G, 9);
        }
      }
    }
  }
}

// Health / ammo pickups dropped in the world.
export function spawnPickup(G, x, z, kind) {
  const color = kind === 'health' ? 0x3ad86b : 0xf2c94c;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 }),
  );
  mesh.position.set(x, 0.8, z);
  mesh.rotation.y = Math.PI / 4;
  G.scene.add(mesh);
  const pickup = { mesh, kind, bob: Math.random() * Math.PI * 2 };
  G.pickups.push(pickup);
  return pickup;
}

export function stepPickups(G, dt) {
  const p = G.player;
  for (const pk of [...G.pickups]) {
    pk.bob += dt * 3;
    pk.mesh.position.y = 0.8 + Math.sin(pk.bob) * 0.15;
    pk.mesh.rotation.y += dt * 1.5;
    const d = Math.hypot(pk.mesh.position.x - p.mesh.position.x, pk.mesh.position.z - p.mesh.position.z);
    if (d < 1.6 && !p.inCar) {
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      else p.ammo.reserve += 48;
      G.scene.remove(pk.mesh);
      G.pickups.splice(G.pickups.indexOf(pk), 1);
      G.audio.pickup();
      G.hud.feed(pk.kind === 'health' ? 'Picked up health.' : 'Picked up ammo.');
    }
  }
}

export { clamp };
