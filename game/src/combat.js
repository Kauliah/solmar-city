// Solmar City — combat: hitscan weapons with tracers and muzzle flash,
// Harbor Kings gunmen with health bars who take cover and shoot in bursts,
// and ammo/health pickups that drop from defeated enemies.
import * as THREE from 'three';
import { WEAPONS } from './config.js';
import { scarePeds } from './pedestrians.js';
import { hurtPlayer } from './player.js';
import { policeHeat } from './police.js';

export function createCombat(G) {
  return {
    enemies: [],
    pickups: [],
    cooldown: 0,
    tracerPool: [],
    muzzle: 0,
  };
}

function enemyMesh(G, kind) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: kind === 'king' ? 0x8a2a2a : 0x2a3a5a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98a5a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.8;
  group.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.7), pants);
  gun.position.set(0.3, 1.3, 0.4);
  group.add(gun);
  // Health bar: a small sprite above the head, scaled by health.
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.14), new THREE.MeshBasicMaterial({ color: 0x1a1d22 }));
  barBg.position.y = 2.25;
  const barFg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.1), new THREE.MeshBasicMaterial({ color: 0xff4a2a }));
  barFg.position.set(0, 2.25, 0.01);
  group.add(barBg);
  group.add(barFg);
  group.userData.barFg = barFg;
  group.userData.barBg = barBg;
  G.scene.add(group);
  return group;
}

export function spawnEnemy(G, x, z, kind = 'king') {
  const mesh = enemyMesh(G, kind);
  const enemy = {
    x, z,
    hp: kind === 'king' ? 60 : 100,
    maxHp: kind === 'king' ? 60 : 100,
    mesh,
    kind,
    shootTimer: 1 + G.rng() * 2,
    burst: 0,
    burstTimer: 0,
    cover: null,
    dead: false,
  };
  mesh.position.set(x, 0, z);
  G.combat.enemies.push(enemy);
  return enemy;
}

export function clearEnemies(G) {
  for (const e of G.combat.enemies) G.scene.remove(e.mesh);
  G.combat.enemies.length = 0;
}

/** Player fires the current weapon toward the camera aim point. */
export function playerShoot(G) {
  const c = G.combat;
  const p = G.player;
  if (c.cooldown > 0 || p.car) return;
  const w = WEAPONS[p.weapon];
  if (p.weapon !== 'fists') {
    const ammo = p.ammo[p.weapon];
    if (!ammo || ammo.mag <= 0) {
      G.audio.click(G);
      return;
    }
    ammo.mag -= 1;
  }
  c.cooldown = w.rate;
  const pellets = w.pellets ?? 1;
  // Aim from the camera through the screen centre.
  const origin = new THREE.Vector3();
  G.camera.getWorldPosition(origin);
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  for (let i = 0; i < pellets; i += 1) {
    const d = dir.clone();
    d.x += (G.rng() - 0.5) * w.spread * 2;
    d.y += (G.rng() - 0.5) * w.spread * 2;
    d.z += (G.rng() - 0.5) * w.spread * 2;
    d.normalize();
    const end = origin.clone().addScaledVector(d, w.range);
    // Hit test: nearest enemy within 1.1 m of the ray.
    let best = null;
    let bestT = Infinity;
    for (const e of G.combat.enemies) {
      if (e.dead) continue;
      const to = new THREE.Vector3(e.x - origin.x, 1.2 - origin.y, e.z - origin.z);
      const t = to.dot(d);
      if (t < 0 || t > w.range) continue;
      const closest = origin.clone().addScaledVector(d, t);
      const dist = Math.hypot(e.x - closest.x, 1.2 - closest.y, e.z - closest.z);
      if (dist < 1.2 && t < bestT) { bestT = t; best = e; }
    }
    if (best) {
      end.copy(origin).addScaledVector(d, bestT);
      best.hp -= w.damage;
      G.effects.hitmarker(G);
      if (best.hp <= 0) killEnemy(G, best);
      else G.audio.hit(G);
    }
    G.effects.tracer(G, origin, end);
  }
  // Muzzle flash at the player's gun, not at the camera: a flash 1.2 m in
  // front of the lens would fill the frame with a pale box.
  G.effects.muzzle(G, new THREE.Vector3(
    p.x + Math.sin(p.heading) * 0.9, 1.35, p.z + Math.cos(p.heading) * 0.9,
  ));
  G.audio.shot(G, p.weapon);
  G.shake = Math.min(0.3, G.shake + 0.08);
  // Gunfire draws the law and scares the street.
  G.wanted = Math.min(5, G.wanted + (p.weapon === 'fists' ? 0 : 1));
  policeHeat(G, 10);
  scarePeds(G, p.x, p.z, 40);
  G.missions.onShotFired(G);
}

function killEnemy(G, enemy) {
  enemy.dead = true;
  G.scene.remove(enemy.mesh);
  G.combat.enemies = G.combat.enemies.filter((e) => e !== enemy);
  G.effects.burst(G, enemy.x, enemy.z);
  G.audio.thud(G);
  // Half the time they drop a pickup.
  if (G.rng() < 0.5) {
    const kind = G.rng() < 0.5 ? 'health' : 'ammo';
    spawnPickup(G, kind, enemy.x + 1, enemy.z + 1);
  }
  G.missions.onEnemyKilled(G, enemy);
}

export function spawnPickup(G, kind, x, z) {
  const color = kind === 'health' ? 0x3dd9a0 : 0xf2c94c;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.6, 0.6),
    new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 }),
  );
  mesh.position.set(x, 0.8, z);
  mesh.rotation.y = Math.PI / 4;
  G.scene.add(mesh);
  const pickup = { kind, x, z, mesh, bob: 0 };
  G.combat.pickups.push(pickup);
  return pickup;
}

export function stepCombat(G, dt) {
  const c = G.combat;
  const p = G.player;
  c.cooldown = Math.max(0, c.cooldown - dt);
  // Enemy AI: close in, take a beat, fire a burst with aim error.
  for (const e of c.enemies) {
    if (e.dead) continue;
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const dist = Math.hypot(dx, dz);
    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    e.mesh.userData.barFg.scale.x = Math.max(0.01, e.hp / e.maxHp);
    e.mesh.userData.barFg.position.x = -(1 - e.hp / e.maxHp) * 0.5;
    // Face the camera so the bar reads: rotate the bars toward the camera.
    e.mesh.userData.barBg.lookAt(G.camera.position);
    e.mesh.userData.barFg.lookAt(G.camera.position);
    if (dist > 26) {
      e.x += (dx / dist) * 4.5 * dt;
      e.z += (dz / dist) * 4.5 * dt;
    } else if (dist < 8) {
      e.x -= (dx / dist) * 2 * dt;
      e.z -= (dz / dist) * 2 * dt;
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 40 && p.health > 0) {
      e.burst = 3;
      e.burstTimer = 0;
      e.shootTimer = 2 + G.rng() * 1.5;
    }
    if (e.burst > 0) {
      e.burstTimer -= dt;
      if (e.burstTimer <= 0) {
        e.burst -= 1;
        e.burstTimer = 0.14;
        // Aim error grows with distance; the player can dodge by moving.
        const err = 0.06 + dist * 0.002;
        const hit = Math.abs(G.rng() - 0.5) < 0.5 - err * 2 && !p.car;
        const from = new THREE.Vector3(e.x, 1.4, e.z);
        const to = new THREE.Vector3(p.x + (G.rng() - 0.5) * 2, 1.2, p.z + (G.rng() - 0.5) * 2);
        G.effects.tracer(G, from, to);
        G.audio.shot(G, 'pistol', true);
        if (hit) hurtPlayer(G, 8);
      }
    }
  }
  // Pickups bob and are collected on touch.
  for (let i = c.pickups.length - 1; i >= 0; i -= 1) {
    const pk = c.pickups[i];
    pk.bob += dt;
    pk.mesh.position.y = 0.8 + Math.sin(pk.bob * 3) * 0.15;
    pk.mesh.rotation.y += dt * 2;
    if (Math.hypot(pk.x - p.x, pk.z - p.z) < 1.6) {
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 30);
      else {
        for (const key of ['pistol', 'smg', 'shotgun']) {
          if (p.ammo[key]) p.ammo[key].reserve += WEAPONS[key].mag;
        }
      }
      G.audio.chime(G);
      G.scene.remove(pk.mesh);
      c.pickups.splice(i, 1);
    }
  }
  // Fists: a short-range swing.
  if (G.punchQueued) {
    G.punchQueued = false;
    if (p.weapon === 'fists' && c.cooldown <= 0) {
      c.cooldown = WEAPONS.fists.rate;
      for (const e of [...c.enemies]) {
        if (Math.hypot(e.x - p.x, e.z - p.z) < WEAPONS.fists.range) {
          e.hp -= WEAPONS.fists.damage;
          if (e.hp <= 0) killEnemy(G, e);
        }
      }
      G.audio.swing(G);
    }
  }
}
