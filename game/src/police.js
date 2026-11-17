// Wanted level + police. Stars 1–5: patrol cars chase, ram and box in; at 3+ a
// helicopter spotlights the player; at 2+ roadblocks appear. Hide out of sight
// to cool down, or pay $150 at the Tune-Up Garage to clear the heat instantly.
import * as THREE from 'three';
import { POIS, GARAGE_PRICE, BUSTED_FINE, WASTED_LOSS, WANTED_DECAY_SECONDS } from './config.js';
import { createVehicle } from './vehicles.js';
import { createRandom } from './random.js';

export function createPolice(G) {
  const heliGroup = new THREE.Group();
  const heliBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 6), new THREE.MeshStandardMaterial({ color: 0x2a3040, roughness: 0.5 }));
  heliGroup.add(heliBody);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.7), new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 }));
  rotor.position.y = 1;
  heliGroup.add(rotor);
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(9, 46, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -24;
  spot.rotation.x = Math.PI;
  heliGroup.add(spot);
  const spotRing = new THREE.Mesh(
    new THREE.CircleGeometry(9, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  spotRing.rotation.x = -Math.PI / 2;
  spotRing.position.y = -46;
  heliGroup.add(spotRing);
  heliGroup.visible = false;
  G.scene.add(heliGroup);
  return {
    wanted: 0,
    heat: 0, // 0..5 fractional; wanted = ceil(heat)
    decayTimer: 0,
    cars: [],
    heli: heliGroup,
    heliRotor: rotor,
    spotRing,
    bustedTimer: 0,
    roadblockAt: null,
  };
}

export function addHeat(G, amount) {
  const p = G.police;
  p.heat = Math.min(5, p.heat + amount);
  p.wanted = Math.ceil(p.heat);
  p.decayTimer = 0;
  if (G.hud) G.hud.flashWanted();
}

function spawnCop(G, nearX, nearZ) {
  const rng = createRandom((Math.random() * 1e9) | 0);
  const angle = rng() * Math.PI * 2;
  const x = Math.max(-280, Math.min(280, nearX + Math.cos(angle) * 60));
  const z = Math.max(-280, Math.min(280, nearZ + Math.sin(angle) * 60));
  const car = createVehicle(G.scene, 'interceptor', 0x1a2a44, x, z, 0, { kind: 'police', id: `cop-${G.time.toFixed(0)}-${G.police.cars.length}` });
  car.cruise = 30;
  G.police.cars.push(car);
  if (G.audio) G.audio.siren(true);
  return car;
}

function removeCop(G, car) {
  G.scene.remove(car.mesh);
  const i = G.police.cars.indexOf(car);
  if (i >= 0) G.police.cars.splice(i, 1);
  if (G.police.cars.length === 0 && G.audio) G.audio.siren(false);
}

/** Wanted target count of pursuit cars by stars. */
function wantedCars(stars) {
  return [0, 1, 2, 3, 4, 5][stars] ?? 0;
}

export function updatePolice(G, dt) {
  const p = G.police;
  const player = G.player;
  const px = player.car ? player.car.x : player.x;
  const pz = player.car ? player.car.z : player.z;
  const pSpeed = player.car ? Math.abs(player.car.speed) : 0;

  // Decay: out of sight of any cop for 20 s drops one star.
  let seen = false;
  for (const cop of p.cars) {
    if (Math.hypot(cop.x - px, cop.z - pz) < 55) { seen = true; break; }
  }
  if (p.wanted > 0 && !seen) {
    p.decayTimer += dt;
    if (p.decayTimer >= WANTED_DECAY_SECONDS) {
      p.heat = Math.max(0, p.heat - 1);
      p.wanted = Math.ceil(p.heat);
      p.decayTimer = 0;
    }
  } else {
    p.decayTimer = 0;
  }

  // Match pursuit count to stars.
  const want = wantedCars(p.wanted);
  while (p.cars.length < want) spawnCop(G, px, pz);
  while (p.cars.length > want) removeCop(G, p.cars[p.cars.length - 1]);

  // Helicopter at 3+ stars: hover above the player, spotlight ring on the ground.
  const heliOn = p.wanted >= 3;
  p.heli.visible = heliOn;
  if (heliOn) {
    p.heli.position.set(px + 8, 48, pz - 6);
    p.heliRotor.rotation.y += dt * 22;
    // The ring hangs under the helicopter (local 0,-46,0); the group carries
    // it, so it never needs a world position — setting one here put the ring
    // in the sky, twice as far from the player as the helicopter itself.
    p.spotRing.material.opacity = 0.16 + Math.sin(G.time * 6) * 0.06;
  }

  // Pursuit steering: chase the player's position with a little prediction,
  // ram when close, back off and re-approach when boxed in.
  for (const cop of p.cars) {
    const ahead = pSpeed * 0.7;
    const tx = px + Math.sin(player.heading ?? 0) * ahead;
    const tz = pz + Math.cos(player.heading ?? 0) * ahead;
    const dx = tx - cop.x;
    const dz = tz - cop.z;
    const dist = Math.hypot(dx, dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - cop.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    const aggression = 0.8 + p.wanted * 0.25;
    cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh * 3.2 * dt));
    const targetSpeed = dist > 26 ? 34 + p.wanted * 1.5 : 26 + p.wanted;
    cop.speed = Math.min(targetSpeed, cop.speed + 18 * dt * aggression);
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.heading;
    const spin = (cop.speed * dt) / 0.36;
    for (const w of cop.wheels) w.rotation.x += spin;
    // Ram the player car: shove + damage + shake.
    if (player.car && dist < 3.6) {
      player.car.speed *= 0.92;
      player.car.health -= 6 * dt * 10;
      if (G.effects) G.effects.shake(0.35);
      if (G.audio) G.audio.thud();
      cop.speed *= 0.8;
    }
    // Busted: on foot, slow, a cop within 3 m for 2 s.
    if (!player.car && dist < 3.2 && pSpeed < 1 && player.health > 0) {
      p.bustedTimer += dt;
      if (p.bustedTimer > 2) {
        G.busted = true;
        return;
      }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
    if (dist > 380) removeCop(G, cop);
  }

  // Tune-Up Garage: drive in with a car, $150 clears wanted and repairs.
  if (player.car) {
    const gd = Math.hypot(player.car.x - POIS.garage.x, player.car.z - POIS.garage.z);
    if (gd < 9 && p.wanted > 0 && player.cash >= GARAGE_PRICE) {
      player.cash -= GARAGE_PRICE;
      p.heat = 0;
      p.wanted = 0;
      player.car.health = player.car.def.durability;
      player.car.color = [0xff6b4a, 0x17a398, 0xf2c94c, 0x5a98b8][Math.floor(Math.random() * 4)];
      if (G.hud) G.hud.toast('Tune-Up Garage — wanted cleared, car repaired. -$150');
      if (G.audio) G.audio.chime();
    }
  }
}

/** Player caught: lose cash, respawn at the hospital, heat cleared. */
export function applyBusted(G) {
  const player = G.player;
  player.cash = Math.max(0, player.cash - BUSTED_FINE);
  player.health = 100;
  player.armour = 0;
  player.x = POIS.hospital.x;
  player.z = POIS.hospital.z;
  player.heading = 0;
  if (player.car) {
    player.car.kind = 'parked';
    player.car = null;
  }
  G.police.heat = 0;
  G.police.wanted = 0;
  G.busted = false;
}

/** Player wasted: lose 10% cash, respawn at the hospital, keep missions. */
export function applyWasted(G) {
  const player = G.player;
  player.cash = Math.floor(player.cash * (1 - WASTED_LOSS));
  player.health = 100;
  player.armour = 0;
  player.x = POIS.hospital.x;
  player.z = POIS.hospital.z;
  player.heading = 0;
  if (player.car) {
    player.car.kind = 'parked';
    player.car = null;
  }
  G.police.heat = Math.max(0, G.police.heat - 1);
  G.police.wanted = Math.ceil(G.police.heat);
  G.wasted = false;
}
