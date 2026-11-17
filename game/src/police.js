// Solmar City — wanted level and police: stars 1–5, patrol cars that chase,
// ram and box the player in, a helicopter spotlight at 3+ stars, busted and
// wasted handling, and the Tune-Up Garage that clears the heat for $150.
import { GARAGE_POS, HOSPITAL_POS, WANTED } from './config.js';
import { spawnCar, stepCar } from './vehicles.js';

export function createPolice(G) {
  return {
    cars: [],
    heli: null,
    heliAngle: 0,
    heat: 0,          // seconds since the player was last seen committing a crime
    hiddenTimer: 0,   // seconds out of sight while wanted
    bustedTimer: 0,
    spawnTimer: 0,
  };
}

/** The player did something loud: police attention jumps. */
export function policeHeat(G, seconds) {
  G.police.heat = Math.max(G.police.heat, seconds);
}

function spawnPoliceCar(G) {
  const p = G.player;
  const angle = G.rng() * Math.PI * 2;
  const x = Math.max(-280, Math.min(280, p.x + Math.cos(angle) * 70));
  const z = Math.max(-280, Math.min(280, p.z + Math.sin(angle) * 70));
  const car = spawnCar(G, 'police', x, z, Math.atan2(p.x - x, p.z - z), { driver: 'police' });
  car.siren = 0;
  G.police.cars.push(car);
  G.audio.siren(G);
  return car;
}

export function stepPolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  const wanted = G.wanted;

  // Decay: hide out of sight for WANTED.decaySeconds to drop a star.
  const anyNear = pol.cars.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 45);
  G.policeNear = anyNear;
  if (wanted > 0) {
    if (!anyNear && pol.heat <= 0) {
      pol.hiddenTimer += dt;
      if (pol.hiddenTimer > WANTED.decaySeconds) {
        G.wanted -= 1;
        pol.hiddenTimer = 0;
        G.hud.flash(G, 'Heat dropping\u2026 stay out of sight.');
      }
    } else {
      pol.hiddenTimer = 0;
    }
  }
  pol.heat = Math.max(0, pol.heat - dt);

  // Keep the right number of pursuit cars on the road.
  const want = WANTED.policePerStar[wanted] ?? 0;
  pol.spawnTimer -= dt;
  if (pol.cars.length < want && pol.spawnTimer <= 0) {
    spawnPoliceCar(G);
    pol.spawnTimer = 2.5;
  }
  // Wanted cleared: the pursuit gives up and the cars drive off.
  if (wanted === 0) {
    for (const car of pol.cars) {
      car.driver = 'traffic';
      car.route = null;
    }
    pol.cars.length = 0;
  }

  // Pursuit: steer toward the player's predicted position, ram when close.
  for (const car of pol.cars) {
    const dx = p.x - car.x;
    const dz = p.z - car.z;
    const dist = Math.hypot(dx, dz);
    const px = p.car ? p.x + Math.sin(p.car.heading) * p.car.speed * 0.4 : p.x;
    const pz = p.car ? p.z + Math.cos(p.car.heading) * p.car.speed * 0.4 : p.z;
    const wantHeading = Math.atan2(px - car.x, pz - car.z);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
    const targetSpeed = dist > 60 ? car.def.topSpeed : dist > 12 ? car.def.topSpeed * 0.85 : 18;
    const throttle = car.speed < targetSpeed ? 1 : 0;
    stepCar(G, car, dt, throttle, 0, false);
    car.mesh.rotation.y = car.heading;
    // Ram: bump the player's car and shake the camera.
    if (p.car && dist < 4.5 && Math.abs(car.speed) > 8) {
      p.car.hp -= 4 * dt * 10;
      p.car.speed *= 0.92;
      G.shake = Math.min(0.6, G.shake + 0.2);
      G.effects.spark(G, car.x, car.z);
      G.audio.thud(G);
    }
    // Busted: on foot, slow, and a cop car is right on top of you.
    if (!p.car && p.health > 0 && dist < WANTED.bustedRadius && Math.abs(car.speed) < 6) {
      pol.bustedTimer += dt;
      if (pol.bustedTimer > 1.2) busted(G);
    } else {
      pol.bustedTimer = Math.max(0, pol.bustedTimer - dt * 2);
    }
  }

  // Helicopter spotlight at 3+ stars: a circling searchlight cone.
  if (wanted >= 3) {
    if (!pol.heli) {
      const THREE = G.THREE;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(9, 40, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
      );
      cone.position.set(p.x, 42, p.z);
      G.scene.add(cone);
      pol.heli = cone;
    }
    pol.heliAngle += dt * 0.7;
    const hx = p.x + Math.cos(pol.heliAngle) * 26;
    const hz = p.z + Math.sin(pol.heliAngle) * 26;
    pol.heli.position.set(hx, 42, hz);
    pol.heli.lookAt(p.x, 0, p.z);
    pol.heli.rotateX(Math.PI);
  } else if (pol.heli) {
    G.scene.remove(pol.heli);
    pol.heli = null;
  }

  // Tune-Up Garage: drive in, pay $150, wanted clears and the car is repaired.
  const gd = Math.hypot(p.x - GARAGE_POS[0], p.z - GARAGE_POS[1]);
  if (p.car && gd < 10 && wanted > 0 && G.cash >= WANTED.garageFee) {
    G.cash -= WANTED.garageFee;
    G.wanted = 0;
    p.car.hp = p.car.def.hp;
    G.hud.flash(G, 'Tune-Up Garage: heat cleared, car repaired. -$150');
    G.audio.chime(G);
  }
}

export function busted(G) {
  const p = G.player;
  G.wanted = 0;
  G.police.cars.forEach((c) => { G.scene.remove(c.mesh); });
  G.police.cars.length = 0;
  G.cash = Math.max(0, G.cash - 200);
  respawnAtHospital(G);
  G.hud.flash(G, 'BUSTED \u2014 the police took $200. You wake up at the hospital.');
  G.audio.sting(G, false);
}

export function wasted(G) {
  const p = G.player;
  G.wanted = 0;
  G.police.cars.forEach((c) => { G.scene.remove(c.mesh); });
  G.police.cars.length = 0;
  G.cash = Math.floor(G.cash * 0.9);
  respawnAtHospital(G);
  G.hud.flash(G, 'WASTED \u2014 you lost 10% of your cash. You wake up at the hospital.');
  G.audio.sting(G, false);
}

function respawnAtHospital(G) {
  const p = G.player;
  if (p.car) {
    G.scene.remove(p.car.mesh);
    G.cars.splice(G.cars.indexOf(p.car), 1);
    p.car = null;
  }
  p.x = HOSPITAL_POS[0];
  p.z = HOSPITAL_POS[1];
  p.y = 0;
  p.vy = 0;
  p.health = 100;
  p.armour = 0;
  G.missions.failStep(G, 'You were taken out \u2014 the mission step restarts.');
}
