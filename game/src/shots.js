// Staged screenshot scenes behind ?shot=start|chase|drive|mission. Each one plays
// the real rules forward from a fresh world with a fixed seed, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame.
import { STEP, POIS } from './config.js';
import { driveVehicle } from './vehicles.js';
import { updateTraffic } from './traffic.js';
import { updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { updateCombat, fireWeapon } from './combat.js';
import { enterCar } from './player.js';

function simulate(G, seconds, driveInput) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    G.time += STEP;
    const p = G.player;
    if (p.car && driveInput) {
      const others = [...G.cars, ...G.traffic, ...G.police.cars];
      driveVehicle(p.car, driveInput, STEP, G.city.colliders, others, null);
      p.x = p.car.x;
      p.z = p.car.z;
      p.heading = p.car.heading;
    }
    updateTraffic(G, STEP);
    updatePeds(G, STEP);
    updatePolice(G, STEP);
    updateCombat(G, STEP);
    G.missions.update(STEP);
    G.effects.update(STEP);
  }
  // The on-foot mesh only follows the player in the live loop; staging moves
  // the player by hand, so put the mesh where the player stands — otherwise
  // the mission shot shows an empty street where Juno should be.
  G.player.mesh.position.set(G.player.x, G.player.y, G.player.z);
  G.player.mesh.rotation.y = G.player.heading;
  G.cam.snap(G);
  G.hud.update(0);
}

function findParked(G, model) {
  return G.cars.find((c) => c.model === model);
}

/** Set `G` to the named scene and leave it frozen for the screenshot. */
export function stageShot(name, G) {
  const p = G.player;
  if (name === 'chase') {
    // Police chase: Vela GT, 3 wanted stars, interceptors + helicopter behind.
    const vela = findParked(G, 'vela');
    p.x = vela.x;
    p.z = vela.z;
    enterCar(G, vela);
    vela.x = 0;
    vela.z = 150;
    vela.heading = Math.PI; // North, up the Marina avenue.
    vela.speed = 24;
    G.police.heat = 3;
    G.police.wanted = 3;
    G.missions.objective = 'Escape the police — lose the 3-star chase';
    // Straight up the avenue, no steering: any steady steer curves the car
    // off the road into a building within a few seconds.
    simulate(G, 3, { throttle: 1, steer: 0, brake: false, boost: true });
    // The cops ram the Vela to a standstill during the simulation, so freeze
    // the chase mid-avenue instead: the Vela at speed, interceptors flanking
    // it, helicopter overhead. The cars, the stars and the helicopter are the
    // real chase state; only their places are staged, as the Vela's was.
    vela.x = 0;
    vela.z = 60;
    vela.heading = Math.PI;
    vela.speed = 26;
    vela.mesh.position.set(vela.x, 0, vela.z);
    vela.mesh.rotation.y = vela.heading;
    p.x = vela.x;
    p.z = vela.z;
    p.heading = vela.heading;
    const flanks = [[-7, -14], [8, 1], [9, -24]];
    G.police.cars.forEach((cop, i) => {
      const [dx, dz] = flanks[i % flanks.length];
      cop.x = vela.x + dx;
      cop.z = vela.z + dz;
      cop.heading = Math.PI;
      cop.speed = 26;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
    });
    G.police.heli.position.set(vela.x + 8, 48, vela.z - 6);
    return;
  }
  if (name === 'drive') {
    // Driving through Downtown in traffic.
    const mer = findParked(G, 'meridian');
    p.x = mer.x;
    p.z = mer.z;
    enterCar(G, mer);
    mer.x = -120;
    mer.z = 200;
    mer.heading = Math.PI; // North on the Old Town avenue.
    mer.speed = 18;
    G.missions.objective = 'Free roam — explore Solmar';
    // Straight up the avenue, no steering: any steady steer curves the car
    // off the road into a building within a few seconds. Two seconds keeps
    // the car mid-block — three puts it nose-first at the next buildings.
    simulate(G, 2, { throttle: 1, steer: 0, brake: false, boost: false });
    return;
  }
  if (name === 'mission') {
    // Mission 6 shootout at Pier 9, on foot, pistol out, muzzle flash live.
    p.x = POIS.pier9.x + 14;
    p.z = POIS.pier9.z - 18;
    p.heading = Math.PI * 0.85;
    p.camYaw = Math.PI * 0.85;
    p.weapon = 'pistol';
    p.owned.pistol = true;
    G.missions.start(6);
    simulate(G, 1.2, null);
    // Face the nearest gunman, then fire one shot so the tracer + flash are live.
    const g = G.combat.gunmen[0];
    if (g) {
      p.camYaw = Math.atan2(g.x - p.x, g.z - p.z);
      p.heading = p.camYaw;
      G.cam.snap(G);
      fireWeapon(G);
      // The muzzle flash is a quad 1.2 m in front of the camera that lives
      // 0.05 s; the shot loop never ticks effects, so let it expire here or
      // it fills the whole frame. The tracer line stays for the screenshot.
      for (let i = 0; i < 4; i += 1) G.effects.update(STEP);
    }
    G.hud.update(0);
    return;
  }
  // Default: start — title screen over a golden-hour Downtown vista.
  p.x = 60;
  p.z = -60;
  p.camYaw = Math.PI * 0.78;
  p.camPitch = 0.95;
  simulate(G, 5, null);
}
