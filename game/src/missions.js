// Solmar City — missions and story: 8 sequential story missions with typed
// objectives (drive to, steal, pick up, deliver, defeat), plus side jobs:
// taxi fares, 20 hidden packages, street races. Rewards feed the cash
// economy; progress is saved.
import { MISSIONS, PACKAGES, PACKAGE_BONUS, GARAGE_POS, HARDWARE_POS, MOTORS_POS } from './config.js';
import { spawnCar } from './vehicles.js';
import { spawnEnemy, clearEnemies } from './combat.js';
import { spawnPickup } from './combat.js';

export function createMissions(G) {
  return {
    index: 0,            // next story mission (0-based)
    step: 0,             // step inside the current mission
    active: null,        // { mission, step } while a mission runs
    done: [],            // completed mission ids
    packages: 0,
    packageSpots: [],
    timer: 0,            // countdown for timed steps
    banner: '',
    bannerTimer: 0,
    taxi: null,          // active side fare
    race: null,          // active street race
    targetCar: null,     // car a steal step wants
    kills: 0,
    pendingNext: 0,      // seconds until the next story mission auto-starts
    packagePositions: [],
  };
}

export function initMissionWorld(G) {
  // Scatter the 20 hidden packages along the sidewalks, where a player can
  // actually reach them (never inside a building).
  const spots = [];
  for (let i = 0; i < PACKAGES; i += 1) {
    const road = G.roadLines[Math.floor(G.rng() * G.roadLines.length)];
    const along = Math.round((G.rng() * 2 - 1) * 260 / 10) * 10;
    const side = G.rng() < 0.5 ? 10 : -10;
    const x = road.axis === 'x' ? along : road.at + side;
    const z = road.axis === 'x' ? road.at + side : along;
    spots.push([x, z]);
  }
  G.missions.packagePositions = spots;
  for (const [x, z] of spots) spawnPickup(G, 'package', x, z);
  // Mark the shops on the world: garage, hardware, motors.
  G.markers = [
    { kind: 'garage', x: GARAGE_POS[0], z: GARAGE_POS[1], label: 'Tune-Up Garage ($150)' },
    { kind: 'shop', x: HARDWARE_POS[0], z: HARDWARE_POS[1], label: 'Harbor Hardware' },
    { kind: 'motors', x: MOTORS_POS[0], z: MOTORS_POS[1], label: 'Marina Motors' },
  ];
}

export function currentMission(G) {
  return MISSIONS[G.missions.index] ?? null;
}

export function startMission(G, index) {
  const mission = MISSIONS[index];
  if (!mission) return;
  G.missions.index = index;
  G.missions.step = 0;
  G.missions.active = mission;
  G.missions.kills = 0;
  G.missions.timer = 0;
  showBanner(G, `${mission.title} \u2014 ${mission.intro}`, 6);
  G.audio.sting(G, true);
  enterStep(G);
}

function enterStep(G) {
  const m = G.missions;
  const mission = m.active;
  if (!mission) return;
  const step = mission.steps[m.step];
  if (!step) return;
  if (step.type === 'steal') {
    // The target car waits at the step position (parked, engine off).
    m.targetCar = spawnCar(G, step.model, step.pos[0], step.pos[1], 0, { locked: false });
    G.hud.flash(G, `Steal the ${step.model === 'vela' ? 'Vela GT' : 'Hauler'} \u2014 press E next to it.`);
  }
  if (step.type === 'defeat') {
    clearEnemies(G);
    m.kills = 0;
    for (let i = 0; i < step.count; i += 1) {
      const a = (i / step.count) * Math.PI * 2;
      spawnEnemy(G, step.pos[0] + Math.cos(a) * 12, step.pos[1] + Math.sin(a) * 12, 'king');
    }
    G.hud.flash(G, `Defeat ${step.count} Harbor Kings.`);
  }
  if (step.time) m.timer = step.time;
  showBanner(G, step.label, 4);
}

function showBanner(G, text, seconds) {
  G.missions.banner = text;
  G.missions.bannerTimer = seconds;
  G.hud.setObjective(G, text);
}

function completeStep(G) {
  const m = G.missions;
  const mission = m.active;
  m.step += 1;
  if (m.step >= mission.steps.length) {
    completeMission(G, mission);
  } else {
    enterStep(G);
  }
}

function completeMission(G, mission) {
  const m = G.missions;
  G.cash += mission.reward;
  m.done.push(mission.id);
  m.active = null;
  m.index += 1;
  clearEnemies(G);
  showBanner(G, `Mission complete: ${mission.title} \u2014 +$${mission.reward}`, 5);
  G.audio.sting(G, true);
  G.save.write(G);
  if (!MISSIONS[m.index]) {
    showBanner(G, 'SOLMAR IS YOURS \u2014 all 8 missions done. Free roam unlocked!', 8);
  } else {
    // The next mission starts by itself a few seconds later, so the story
    // keeps flowing without a menu trip.
    m.pendingNext = 4;
  }
}

export function failStep(G, reason) {
  const m = G.missions;
  if (!m.active) return;
  showBanner(G, reason, 4);
  // Restart the current step, not the whole mission.
  clearEnemies(G);
  if (m.targetCar) {
    G.scene.remove(m.targetCar.mesh);
    G.cars.splice(G.cars.indexOf(m.targetCar), 1);
    m.targetCar = null;
  }
  enterStep(G);
}

export function onEnemyKilled(G, enemy) {
  const m = G.missions;
  if (!m.active) return;
  const step = m.active.steps[m.step];
  if (step && step.type === 'defeat') {
    m.kills += 1;
    showBanner(G, `${step.label} \u2014 ${m.kills}/${step.count} down`, 3);
    if (m.kills >= step.count) completeStep(G);
  }
}

export function onShotFired(G) {
  // Mission 4's escort notices gunfire; nothing else needs it yet.
}

export function stepMissions(G, dt) {
  const m = G.missions;
  if (m.bannerTimer > 0) {
    m.bannerTimer -= dt;
    if (m.bannerTimer <= 0) G.hud.setObjective(G, m.active ? m.active.steps[m.step]?.label ?? '' : '');
  }
  // Between story missions: count down, then start the next one.
  if (!m.active && m.pendingNext > 0) {
    m.pendingNext -= dt;
    if (m.pendingNext <= 0) {
      m.pendingNext = 0;
      startMission(G, m.index);
    }
    return;
  }
  const p = G.player;
  // Timed steps count down; running out fails the step.
  if (m.active && m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failStep(G, 'Too slow \u2014 the step restarts.');
      return;
    }
  }
  if (!m.active) return;
  const step = m.active.steps[m.step];
  if (!step) return;
  const dist = Math.hypot(p.x - step.pos[0], p.z - step.pos[1]);
  const inCar = !!p.car;
  switch (step.type) {
    case 'driveTo':
      if (dist < 10) completeStep(G);
      break;
    case 'steal':
      if (m.targetCar && p.car === m.targetCar) completeStep(G);
      break;
    case 'pickup':
      if (dist < 4) completeStep(G);
      break;
    case 'dropoff':
    case 'deliver':
      if (dist < 6 && (step.type === 'deliver' ? !inCar : true)) completeStep(G);
      break;
    default:
      break;
  }
  // Packages: collected by walking over the glowing box.
  for (let i = G.combat.pickups.length - 1; i >= 0; i -= 1) {
    const pk = G.combat.pickups[i];
    if (pk.kind === 'package' && Math.hypot(pk.x - p.x, pk.z - p.z) < 2) {
      G.scene.remove(pk.mesh);
      G.combat.pickups.splice(i, 1);
      m.packages += 1;
      G.cash += 50;
      G.audio.chime(G);
      showBanner(G, `Package found! ${m.packages}/${PACKAGES} \u2014 +$50`, 3);
      if (m.packages >= PACKAGES) {
        G.cash += PACKAGE_BONUS;
        showBanner(G, `All ${PACKAGES} packages! Bonus +$${PACKAGE_BONUS}`, 5);
      }
      G.save.write(G);
    }
  }
}

/** Taxi side job: start a fare from the nearest taxi. */
export function startTaxiFare(G) {
  const m = G.missions;
  if (m.taxi) return;
  const spots = [[120, -120], [-120, 120], [0, 240], [240, -240], [-240, 0], [0, -240]];
  const dest = spots[Math.floor(G.rng() * spots.length)];
  m.taxi = { dest, timer: 90 };
  showBanner(G, `Taxi fare: drop the passenger at the marker. 90 s.`, 4);
}

export function stepTaxi(G, dt) {
  const m = G.missions;
  if (!m.taxi) return;
  m.taxi.timer -= dt;
  const p = G.player;
  if (Math.hypot(p.x - m.taxi.dest[0], p.z - m.taxi.dest[1]) < 8 && p.car) {
    const tip = Math.floor(G.rng() * 40);
    G.cash += 60 + tip;
    showBanner(G, `Fare complete! +$${60 + tip}`, 3);
    G.audio.chime(G);
    m.taxi = null;
    G.save.write(G);
  } else if (m.taxi.timer <= 0) {
    showBanner(G, 'Fare missed \u2014 the passenger walked away.', 3);
    m.taxi = null;
  }
}
