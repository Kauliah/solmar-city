// Story missions (8, sequential) + repeatable side jobs: taxi fares, 20 hidden
// packages, 3 checkpoint races. Each mission step is data in config.js; this
// module interprets the steps, spawns markers and NPCs, and pays the rewards.
import * as THREE from 'three';
import { MISSIONS, PACKAGE_SPOTS, RACES, POIS } from './config.js';
import { spawnGunmen } from './combat.js';
import { addHeat } from './police.js';
import { createRandom } from './random.js';

function makeBeacon(scene, color = 0xffd23f) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  g.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 6;
  g.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(3.4, 4.4, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  g.add(ring);
  g.visible = false;
  scene.add(g);
  return { group: g, diamond, ring };
}

export function createMissions(G) {
  const beacon = makeBeacon(G.scene);
  const state = {
    active: null, // { def, stepIdx, runtime }
    done: [],
    packagesFound: new Set(),
    packagesBonusPaid: false,
    taxiFare: null,
    raceRun: null,
    beacon,
    objective: 'Free roam — Solmar is yours.',
    objectiveDist: null,
    marker: null,
    completeBanner: null,
  };
  // The object the game holds onto must stay live. The mission state is
  // reassigned as missions start and finish (active, objective, marker, the
  // done list), so a plain copy of it goes stale: the HUD, the save and the
  // restart button would all read yesterday's mission — a finished mission
  // would never show in `done`, and a save would forget it. Every field
  // below is an accessor that forwards reads and writes to the one true
  // state object, so the outside world always sees the current mission.
  return {
    get active() { return state.active; },
    set active(v) { state.active = v; },
    get done() { return state.done; },
    set done(v) { state.done = v; },
    get packagesFound() { return state.packagesFound; },
    set packagesFound(v) { state.packagesFound = v; },
    get packagesBonusPaid() { return state.packagesBonusPaid; },
    set packagesBonusPaid(v) { state.packagesBonusPaid = v; },
    get taxiFare() { return state.taxiFare; },
    set taxiFare(v) { state.taxiFare = v; },
    get raceRun() { return state.raceRun; },
    set raceRun(v) { state.raceRun = v; },
    get beacon() { return state.beacon; },
    get objective() { return state.objective; },
    set objective(v) { state.objective = v; },
    get objectiveDist() { return state.objectiveDist; },
    set objectiveDist(v) { state.objectiveDist = v; },
    get marker() { return state.marker; },
    set marker(v) { state.marker = v; },
    get completeBanner() { return state.completeBanner; },
    set completeBanner(v) { state.completeBanner = v; },
    start(id) { startMission(G, state, id); },
    update(dt) { updateMissions(G, state, dt); },
    onEnterCar(car) { onEnterCar(G, state, car); },
    onGunmanDown(g) { onGunmanDown(G, state, g); },
    startTaxiFare() { startTaxiFare(G, state); },
    collectPackage(i) { collectPackage(G, state, i); },
  };
}

function startMission(G, state, id) {
  const def = MISSIONS.find((m) => m.id === id);
  if (!def) return;
  state.active = { def, stepIdx: 0, runtime: {} };
  state.objective = `${def.title} — ${def.steps[0].label}`;
  if (G.hud) {
    G.hud.banner(def.title, def.intro);
    G.hud.toast(`Mission started: ${def.title}`);
  }
  if (G.audio) G.audio.sting('start');
  enterStep(G, state);
}

function enterStep(G, state) {
  const step = state.active.def.steps[state.active.stepIdx];
  const rt = state.active.runtime;
  state.marker = null;
  if (step.type === 'driveTo' || step.type === 'deliver') {
    state.marker = { x: step.x, z: step.z };
  } else if (step.type === 'steal') {
    // Point at the nearest car of that model.
    const car = [...G.cars, ...G.traffic].find((c) => c.model === step.model);
    state.marker = car ? { x: car.x, z: car.z, car } : null;
  } else if (step.type === 'taxi') {
    rt.faresLeft = step.count;
    rt.phase = 'pickup';
    rt.pickup = randomRoadPoint(G);
    rt.drop = randomRoadPoint(G);
    state.marker = { x: rt.pickup[0], z: rt.pickup[1] };
  } else if (step.type === 'carry') {
    state.marker = { x: step.x, z: step.z };
    spawnGunmen(G, G.player.x, G.player.z, 3, 12);
    addHeat(G, 1);
  } else if (step.type === 'shootout') {
    state.marker = { x: step.x, z: step.z };
    rt.toKill = step.count;
    rt.killed = 0;
    spawnGunmen(G, step.x, step.z, step.count, step.radius ?? 18);
  } else if (step.type === 'race') {
    rt.cpIdx = 0;
    rt.timeLeft = step.timeLimit;
    rt.checkpoints = step.checkpoints;
    state.marker = { x: step.checkpoints[0][0], z: step.checkpoints[0][1] };
  }
  state.objective = `${state.active.def.title} — ${step.label}`;
  updateBeacon(G, state);
}

function randomRoadPoint(G) {
  const rng = createRandom((Math.random() * 1e9) | 0);
  const axes = [-240, -120, 0, 120, 240];
  const a = axes[Math.floor(rng() * axes.length)];
  const b = -240 + rng() * 480;
  return rng() < 0.5 ? [a, b] : [b, a];
}

function updateBeacon(G, state) {
  const b = state.beacon;
  if (state.marker) {
    b.group.visible = true;
    b.group.position.set(state.marker.x, 0, state.marker.z);
  } else {
    b.group.visible = false;
  }
}

function completeStep(G, state) {
  const m = state.active;
  m.stepIdx += 1;
  if (m.stepIdx >= m.def.steps.length) {
    completeMission(G, state);
  } else {
    enterStep(G, state);
    if (G.hud) G.hud.toast('Objective complete.');
    if (G.audio) G.audio.chime();
  }
}

function completeMission(G, state) {
  const m = state.active;
  G.player.cash += m.def.reward;
  state.done.push(m.def.id);
  if (G.hud) {
    G.hud.banner('MISSION COMPLETE', `${m.def.title} — +$${m.def.reward}`);
    G.hud.feed(`Mission complete: ${m.def.title} (+$${m.def.reward})`);
  }
  if (G.audio) G.audio.sting('complete');
  state.active = null;
  state.marker = null;
  state.objective = 'Free roam — Solmar is yours.';
  updateBeacon(G, state);
  const next = MISSIONS.find((x) => x.id === m.def.id + 1);
  if (next) {
    setTimeout(() => {
      if (G.screen === 'play' && !state.active) startMission(G, state, next.id);
    }, 4000);
  } else {
    // Finale done — the city is yours.
    if (G.hud) G.hud.banner('SOLMAR IS YOURS', 'You finished every story mission. Free roam, collect packages, race, and rule the city.');
    G.gameComplete = true;
  }
}

function onEnterCar(G, state, car) {
  const m = state.active;
  if (!m) return;
  const step = m.def.steps[m.stepIdx];
  if (step.type === 'steal' && car.model === step.model) {
    if (G.hud) G.hud.toast(`Got the ${car.def.name}. Now deliver it.`);
    completeStep(G, state);
  }
}

function onGunmanDown(G, state) {
  const m = state.active;
  if (!m) return;
  const step = m.def.steps[m.stepIdx];
  if (step.type === 'shootout') {
    m.runtime.killed += 1;
    state.objective = `${m.def.title} — ${step.label} (${m.runtime.killed}/${step.count})`;
    if (m.runtime.killed >= step.count) completeStep(G, state);
  }
}

function startTaxiFare(G, state) {
  if (state.taxiFare || state.active) return;
  const pickup = randomRoadPoint(G);
  const drop = randomRoadPoint(G);
  state.taxiFare = { phase: 'pickup', pickup, drop, tip: 0, startedAt: G.time };
  state.marker = { x: pickup[0], z: pickup[1] };
  state.objective = 'Taxi fare — pick up the passenger';
  updateBeacon(G, state);
  if (G.hud) G.hud.toast('Taxi fare — pick up the passenger (yellow marker).');
}

function collectPackage(G, state, i) {
  if (state.packagesFound.has(i)) return;
  state.packagesFound.add(i);
  G.player.cash += 50;
  G.city.packageMeshes[i].visible = false;
  if (G.hud) G.hud.toast(`Package found! +$50 (${state.packagesFound.size}/20)`);
  if (G.audio) G.audio.chime();
  if (state.packagesFound.size === 20 && !state.packagesBonusPaid) {
    state.packagesBonusPaid = true;
    G.player.cash += 500;
    if (G.hud) G.hud.banner('ALL PACKAGES FOUND', 'Every hidden package in Solmar — +$500 bonus.');
  }
}

function updateMissions(G, state, dt) {
  // Beacon animation.
  if (state.beacon.group.visible) {
    state.beacon.diamond.rotation.y += dt * 2;
    state.beacon.diamond.position.y = 6 + Math.sin(G.time * 2.4) * 0.5;
  }
  // Packages: proximity collect.
  const p = G.player;
  for (let i = 0; i < PACKAGE_SPOTS.length; i += 1) {
    if (state.packagesFound.has(i)) continue;
    const [px, pz] = PACKAGE_SPOTS[i];
    if (Math.hypot(px - p.x, pz - p.z) < 2.2) collectPackage(G, state, i);
  }
  // Taxi side job: entering a taxi with no active mission starts a fare.
  if (!state.active && !state.taxiFare && p.car && p.car.model === 'taxi') {
    startTaxiFare(G, state);
  }
  // Taxi fare progress.
  if (state.taxiFare) {
    const fare = state.taxiFare;
    const target = fare.phase === 'pickup' ? fare.pickup : fare.drop;
    const d = Math.hypot(target[0] - p.x, target[1] - p.z);
    state.objectiveDist = d;
    state.marker = { x: target[0], z: target[1] };
    updateBeacon(G, state);
    if (d < 8) {
      if (fare.phase === 'pickup') {
        fare.phase = 'drop';
        state.objective = 'Taxi fare — drop the passenger off';
        if (G.hud) G.hud.toast('Passenger aboard — drive to the drop-off.');
      } else {
        const time = G.time - fare.startedAt;
        const tip = time < 90 ? 40 : time < 150 ? 20 : 0;
        const pay = 80 + tip;
        p.cash += pay;
        if (G.hud) G.hud.toast(`Fare complete — +$${pay}${tip ? ` (incl. $${tip} tip)` : ''}`);
        if (G.audio) G.audio.chime();
        state.taxiFare = null;
        state.marker = null;
        state.objective = state.active ? state.objective : 'Free roam — Solmar is yours.';
        updateBeacon(G, state);
      }
    }
    return;
  }
  // Race runs (side-job checkpoint races, started by driving into the start ring).
  if (!state.active && !state.raceRun && p.car) {
    for (const race of RACES) {
      const [sx, sz] = race.checkpoints[0];
      if (Math.hypot(sx - p.x, sz - p.z) < 10) {
        state.raceRun = { race, cpIdx: 1, time: 0 };
        state.marker = { x: race.checkpoints[1][0], z: race.checkpoints[1][1] };
        state.objective = `${race.name} — checkpoint 2/${race.checkpoints.length}`;
        updateBeacon(G, state);
        if (G.hud) G.hud.toast(`${race.name} started! Hit every checkpoint.`);
        break;
      }
    }
  }
  if (state.raceRun) {
    const run = state.raceRun;
    run.time += dt;
    const cp = run.race.checkpoints[run.cpIdx];
    const d = Math.hypot(cp[0] - p.x, cp[1] - p.z);
    state.objectiveDist = d;
    if (d < 10) {
      run.cpIdx += 1;
      if (run.cpIdx >= run.race.checkpoints.length) {
        const best = G.saveData?.bestRaces?.[run.race.id];
        const isBest = !best || run.time < best;
        if (isBest) {
          G.saveData.bestRaces[run.race.id] = Math.round(run.time * 10) / 10;
        }
        p.cash += run.race.reward;
        if (G.hud) G.hud.banner('RACE WON', `${run.race.name} — ${run.time.toFixed(1)}s${isBest ? ' (new best!)' : ''} — +$${run.race.reward}`);
        if (G.audio) G.audio.sting('complete');
        state.raceRun = null;
        state.marker = null;
        state.objective = 'Free roam — Solmar is yours.';
        updateBeacon(G, state);
      } else {
        state.marker = { x: run.race.checkpoints[run.cpIdx][0], z: run.race.checkpoints[run.cpIdx][1] };
        state.objective = `${run.race.name} — checkpoint ${run.cpIdx + 1}/${run.race.checkpoints.length}`;
        updateBeacon(G, state);
      }
    }
    return;
  }
  // Active story mission progress.
  const m = state.active;
  if (!m) return;
  const step = m.def.steps[m.stepIdx];
  const rt = m.runtime;
  if (step.type === 'driveTo' || step.type === 'deliver') {
    const d = Math.hypot(step.x - p.x, step.z - p.z);
    state.objectiveDist = d;
    if (step.type === 'deliver' && !p.car) return; // Must arrive in the car.
    if (d < step.radius) completeStep(G, state);
  } else if (step.type === 'steal') {
    // Marker follows the nearest car of that model.
    const car = [...G.cars, ...G.traffic].find((c) => c.model === step.model);
    if (car) {
      state.marker = { x: car.x, z: car.z };
      updateBeacon(G, state);
      state.objectiveDist = Math.hypot(car.x - p.x, car.z - p.z);
    }
  } else if (step.type === 'taxi') {
    const target = rt.phase === 'pickup' ? rt.pickup : rt.drop;
    const d = Math.hypot(target[0] - p.x, target[1] - p.z);
    state.objectiveDist = d;
    if (d < 8 && p.car) {
      if (rt.phase === 'pickup') {
        rt.phase = 'drop';
        state.marker = { x: rt.drop[0], z: rt.drop[1] };
        state.objective = `${m.def.title} — Drop the fare off`;
        updateBeacon(G, state);
        if (G.hud) G.hud.toast('Fare aboard — drive to the drop-off.');
      } else {
        rt.faresLeft -= 1;
        if (rt.faresLeft <= 0) {
          completeStep(G, state);
        } else {
          rt.phase = 'pickup';
          rt.pickup = randomRoadPoint(G);
          rt.drop = randomRoadPoint(G);
          state.marker = { x: rt.pickup[0], z: rt.pickup[1] };
          state.objective = `${m.def.title} — Pick up fare ${step.count - rt.faresLeft + 1} of ${step.count}`;
          updateBeacon(G, state);
        }
      }
    }
  } else if (step.type === 'carry') {
    const d = Math.hypot(step.x - p.x, step.z - p.z);
    state.objectiveDist = d;
    if (p.car) {
      if (G.hud) G.hud.toastOnce('carry-on-foot', 'The Drop is on foot — get out of the car.');
      return;
    }
    if (d < step.radius) completeStep(G, state);
  } else if (step.type === 'race') {
    rt.timeLeft -= dt;
    const cp = rt.checkpoints[rt.cpIdx];
    const d = Math.hypot(cp[0] - p.x, cp[1] - p.z);
    state.objectiveDist = d;
    if (d < 12 && p.car) {
      rt.cpIdx += 1;
      if (rt.cpIdx >= rt.checkpoints.length) {
        completeStep(G, state);
      } else {
        state.marker = { x: rt.checkpoints[rt.cpIdx][0], z: rt.checkpoints[rt.cpIdx][1] };
        state.objective = `${m.def.title} — checkpoint ${rt.cpIdx + 1}/${rt.checkpoints.length} (${Math.ceil(rt.timeLeft)}s left)`;
        updateBeacon(G, state);
      }
    }
    if (rt.timeLeft <= 0) {
      if (G.hud) G.hud.banner('MISSION FAILED', 'Out of time on The Long Way Home. Try again from the pause menu.');
      state.active = null;
      state.marker = null;
      state.objective = 'Free roam — Solmar is yours.';
      updateBeacon(G, state);
    }
  }
}
