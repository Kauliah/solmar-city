// Wanted stars + police. Heat rises with crime; police Interceptors chase, ram and
// box the player in; hiding out of sight clears a star. Busted / wasted respawn
// the player at the hospital and cost cash.
import * as THREE from 'three';
import { WANTED } from './config.js';
import { clamp } from './random.js';
import { spawnCar, removeCar } from './vehicles.js';
import { angleLerp } from './random.js';

export function createPolice(G) {
  return {
    stars: 0,
    heat: 0,
    hideTimer: 0,
    cars: [],
    heli: null,
    bustedTimer: 0,
    addHeat(amount) {
      this.heat = Math.min(5, this.heat + amount);
      const next = Math.min(5, Math.floor(this.heat) + (this.heat % 1 > 0.6 ? 0 : 0));
      this.stars = Math.max(this.stars, Math.min(5, Math.ceil(this.heat)));
      if (this.stars > 0) this.hideTimer = 0;
      G.hud.setStars(this.stars);
      if (this.stars > G.save.bestWanted) {
        G.save.bestWanted = this.stars;
      }
    },
    clearStars() {
      this.stars = 0;
      this.heat = 0;
      this.hideTimer = 0;
      for (const c of [...this.cars]) this.despawn(c);
      G.hud.setStars(0);
      G.hud.banner('You lost the cops.', '#17a398');
    },
    spawn(count) {
      const p = G.player;
      const base = p.inCar ? p.inCar.mesh.position : p.mesh.position;
      for (let i = 0; i < count; i += 1) {
        const a = (i / Math.max(1, count)) * Math.PI * 2 + Math.random();
        const x = clamp(base.x + Math.sin(a) * 70, -280, 280);
        const z = clamp(base.z + Math.cos(a) * 70, -280, 280);
        const car = spawnCar(G, 'interceptor', x, z, 0, { driver: 'police' });
        this.cars.push(car);
      }
    },
    despawn(car) {
      this.cars = this.cars.filter((c) => c !== car);
      removeCar(G, car);
    },
    wasted(G2) {
      const p = G2.player;
      const lost = Math.floor(p.cash * 0.1);
      p.cash -= lost;
      G2.save.cash = p.cash;
      G2.hud.showEnd('WASTED', `You lost $${lost}. The crew picked you up at the hospital.`);
      G2.audio.fail();
      G2.screen = 'over';
    },
    busted(G2) {
      const p = G2.player;
      const lost = Math.floor(p.cash * 0.15);
      p.cash -= lost;
      G2.save.cash = p.cash;
      G2.hud.showEnd('BUSTED', `The cops took $${lost}. Iris bailed you out.`);
      G2.audio.fail();
      G2.screen = 'over';
    },
  };
}

export function stepPolice(G, dt) {
  const pol = G.police;
  const p = G.player;
  if (pol.stars === 0) return;
  const playerPos = p.inCar ? p.inCar.mesh.position : p.mesh.position;
  const playerSpeed = p.inCar ? Math.abs(p.inCar.speed) : 0;
  // Keep the right number of pursuit cars on the road.
  const want = WANTED.maxPolice[pol.stars];
  if (pol.cars.length < want) pol.spawn(want - pol.cars.length);
  // Hide timer: wanted decays when the player is slow and far from every cop.
  let nearest = Infinity;
  for (const c of pol.cars) {
    nearest = Math.min(nearest, Math.hypot(c.mesh.position.x - playerPos.x, c.mesh.position.z - playerPos.z));
  }
  const hidden = nearest > 60 && playerSpeed < 4;
  if (hidden) {
    pol.hideTimer += dt;
    if (pol.hideTimer > WANTED.decaySeconds) {
      pol.stars -= 1;
      pol.heat = Math.max(0, pol.heat - 1);
      pol.hideTimer = 0;
      G.hud.setStars(pol.stars);
      if (pol.stars === 0) pol.clearStars();
      else G.hud.banner(`Wanted level down — ${pol.stars} star${pol.stars === 1 ? '' : 's'} left.`, '#17a398');
    }
  } else {
    pol.hideTimer = 0;
  }
  // Helicopter spotlight at 3+ stars: a circling light, visual only.
  if (pol.stars >= 3 && !pol.heli) {
    const heli = new THREE.Mesh(
      new THREE.ConeGeometry(6, 2, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    heli.rotation.x = Math.PI;
    G.scene.add(heli);
    pol.heli = heli;
  } else if (pol.stars < 3 && pol.heli) {
    G.scene.remove(pol.heli);
    pol.heli = null;
  }
  if (pol.heli) {
    const t = G.time * 0.5;
    pol.heli.position.set(playerPos.x + Math.sin(t) * 18, 42, playerPos.z + Math.cos(t) * 18);
  }
  // Pursuit: steer at the player's predicted position, ram when close.
  for (const car of [...pol.cars]) {
    const dx = playerPos.x - car.mesh.position.x;
    const dz = playerPos.z - car.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    const px = playerPos.x + (p.inCar ? Math.sin(p.inCar.heading) * p.inCar.speed * 0.5 : 0);
    const pz = playerPos.z + (p.inCar ? Math.cos(p.inCar.heading) * p.inCar.speed * 0.5 : 0);
    const wantHeading = Math.atan2(px - car.mesh.position.x, pz - car.mesh.position.z);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
    const targetSpeed = dist < 6 ? car.def.topSpeed * 1.05 : car.def.topSpeed * (0.85 + pol.stars * 0.03);
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    car.mesh.position.x += Math.sin(car.heading) * car.speed * dt;
    car.mesh.position.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * dt * 2.4;
    for (const w of car.wheels) w.rotation.x += spin;
    // Flashing light bar.
    const flash = Math.floor(G.time * 6) % 2 === 0;
    if (!car.lightBar) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2e2e }));
      bar.position.set(0, car.def.height * 1.25, 0);
      car.mesh.add(bar);
      car.lightBar = bar;
    }
    car.lightBar.material.color.setHex(flash ? 0xff2e2e : 0x2e6bff);
    if (Math.random() < dt * 0.5) G.audio.siren(dt);
    // Ram the player's car.
    if (p.inCar && dist < 4.5) {
      p.inCar.health -= 8 * dt;
      G.camera.shake = Math.min(1, G.camera.shake + 0.2);
      if (Math.random() < dt * 2) G.audio.impact();
    }
    // Busted: on foot, slow, cop right on top of you.
    if (!p.inCar && dist < 2.2 && playerSpeed < 1) {
      pol.busted(G);
      return;
    }
    // Despawn far pursuit cars so the chase stays close.
    if (dist > 240) pol.despawn(car);
  }
}
