// Story: 8 missions for fixer Iris Delgado against the Harbor Kings, plus side jobs —
// 20 hidden packages, taxi fares and 3 checkpoint street races. Objectives show in the
// HUD banner and on the minimap; rewards pay cash into the save.
import * as THREE from 'three';
import { MISSION_DEFS } from './config.js';
import { spawnCar } from './vehicles.js';
import { spawnPickup } from './combat.js';

function markerMesh() {
  const geo = new THREE.ConeGeometry(1.1, 2.4, 4);
  const mat = new THREE.MeshBasicMaterial({ color: 0xf2c94c, transparent: true, opacity: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = Math.PI;
  return m;
}

function buildSteps(G, def) {
  const L = G.landmarks;
  switch (def.id) {
    case 1:
      return [{ type: 'goto', pos: L.cafe, radius: 6, text: 'Drive to Iris\'s cafe in Old Town' }];
    case 2:
      return [
        { type: 'steal', model: 'vela', pos: L.marina, radius: 8, text: 'Steal the Vela GT at the Marina' },
        { type: 'deliver', pos: L.docks, radius: 8, text: 'Deliver the Vela GT to the Docks' },
      ];
    case 3:
      return [{ type: 'taxi', timeLimit: 240, text: 'Taxi fares: 3 pickups across the city' }];
    case 4:
      return [
        { type: 'goto', pos: new THREE.Vector3(0, 0, -60), radius: 5, text: 'Pick up the package in Downtown' },
        { type: 'kill', count: 4, pos: new THREE.Vector3(30, 0, -60), text: 'Harbor Kings ambush! Fight them off' },
        { type: 'goto', pos: L.cafe, radius: 6, text: 'Deliver the package to Iris' },
      ];
    case 5:
      return [
        { type: 'steal', model: 'hauler', pos: L.docks, radius: 8, text: 'Steal the Hauler at the Docks' },
        { type: 'escape', pos: L.hillsLookout, radius: 10, wanted: 3, text: 'Lose the 3-star chase at the Hills lookout' },
      ];
    case 6:
      return [
        { type: 'goto', pos: L.pier, radius: 8, text: 'Get to Pier 9' },
        { type: 'kill', count: 8, pos: L.pierEnd, text: 'Defeat 8 Harbor Kings gunmen' },
        { type: 'goto', pos: L.marina, radius: 8, text: 'Escape to the Marina in a car' },
      ];
    case 7:
      return [{ type: 'race', timeLimit: 150, text: 'Race the ring road — beat the clock, dodge the spikes' }];
    case 8:
      return [
        { type: 'goto', pos: L.towerGarage, radius: 8, text: 'Infiltrate the Solmar Tower garage' },
        { type: 'kill', count: 6, pos: L.towerGarage, text: 'Take down Vale\'s crew' },
        { type: 'escape', pos: L.hillsLookout, radius: 10, wanted: 4, text: 'Getaway — reach the Hills lookout' },
      ];
    default:
      return [];
  }
}

export function createMissions(G) {
  const marker = markerMesh();
  marker.visible = false;
  G.scene.add(marker);
  const pkgMeshes = [];
  for (const spot of G.landmarks.packageSpots) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.7, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x17a398, emissive: 0x17a398, emissiveIntensity: 0.5 }),
    );
    m.position.set(spot.x, 0.9, spot.z);
    m.visible = !G.save.packages.includes(pkgMeshes.length);
    G.scene.add(m);
    pkgMeshes.push({ mesh: m, pos: spot, found: G.save.packages.includes(pkgMeshes.length) });
  }
  const M = {
    index: 0, // 0-based; MISSION_DEFS.length means story complete
    steps: [],
    stepIndex: 0,
    timer: 0,
    targetCar: null,
    taxiFares: [],
    taxiStage: 0,
    racePoints: [],
    raceIndex: 0,
    kills: 0,
    killsNeeded: 0,
    marker,
    pkgMeshes,
    active: false,
    race: null,
    objective: 'Free roam — press M1 to start the story',
    targetPos: null,
    start() {
      if (this.index >= MISSION_DEFS.length) return;
      const def = MISSION_DEFS[this.index];
      this.steps = buildSteps(G, def);
      this.stepIndex = 0;
      this.active = true;
      this.kills = 0;
      this.beginStep();
      G.hud.banner(`Mission ${def.id}: ${def.name}`, '#f2c94c');
      G.hud.feed(def.brief);
      G.audio.missionDone();
    },
    beginStep() {
      const s = this.steps[this.stepIndex];
      if (!s) { this.complete(); return; }
      this.objective = s.text;
      this.targetPos = s.pos || null;
      this.timer = s.timeLimit || 0;
      this.marker.visible = !!s.pos;
      if (s.pos) this.marker.position.set(s.pos.x, 6, s.pos.z);
      if (s.type === 'steal') {
        if (this.targetCar) { /* keep the previous one */ }
        const car = spawnCar(G, s.model, s.pos.x, s.pos.z, 0, { mission: 'stolen' });
        this.targetCar = car;
        this.targetPos = s.pos;
      }
      if (s.type === 'kill') {
        this.kills = 0;
        this.killsNeeded = s.count;
        const spots = [];
        for (let i = 0; i < s.count; i += 1) spots.push(new THREE.Vector3(s.pos.x + (i % 4) * 5 - 8, 0, s.pos.z + Math.floor(i / 4) * 6 - 4));
        G.combat.spawnGunmen(spots, s.count);
        this.targetPos = s.pos;
      }
      if (s.type === 'taxi') this.setupTaxi();
      if (s.type === 'race') this.setupRace();
      if (s.type === 'escape') {
        // The job itself draws the heat: the chase is already on when the escape begins.
        G.police.addHeat(Math.max(0, s.wanted - G.police.stars));
      }
      G.hud.setObjective(this.objective);
    },
    setupTaxi() {
      const spots = [
        { pick: new THREE.Vector3(-180, 0, 60), drop: new THREE.Vector3(180, 0, -120) },
        { pick: new THREE.Vector3(120, 0, -180), drop: new THREE.Vector3(-120, 0, 180) },
        { pick: new THREE.Vector3(0, 0, 180), drop: new THREE.Vector3(240, 0, 60) },
      ];
      this.taxiFares = spots;
      this.taxiStage = 0; // 0 = drive to pickup, 1 = drive to drop
      this.targetPos = spots[0].pick;
      this.marker.position.set(spots[0].pick.x, 6, spots[0].pick.z);
      this.marker.visible = true;
      this.objective = 'Taxi: pick up the fare at the marker';
      G.hud.setObjective(this.objective);
    },
    setupRace() {
      const ring = [
        new THREE.Vector3(0, 0, -270), new THREE.Vector3(270, 0, -270),
        new THREE.Vector3(270, 0, 270), new THREE.Vector3(0, 0, 270),
        new THREE.Vector3(-270, 0, 270), new THREE.Vector3(-270, 0, -270),
        new THREE.Vector3(0, 0, -270),
      ];
      this.racePoints = ring;
      this.raceIndex = 0;
      this.targetPos = ring[0];
      this.marker.position.set(ring[0].x, 6, ring[0].z);
      this.marker.visible = true;
      this.objective = 'Race: hit every ring-road checkpoint';
      G.hud.setObjective(this.objective);
    },
    nextStep() {
      this.stepIndex += 1;
      if (this.stepIndex >= this.steps.length) this.complete();
      else this.beginStep();
    },
    complete() {
      const def = MISSION_DEFS[this.index];
      const p = G.player;
      p.cash += def.reward;
      G.save.cash = p.cash;
      G.save.totalEarned += def.reward;
      if (!G.save.missionsDone.includes(def.id)) G.save.missionsDone.push(def.id);
      G.hud.banner(`Mission complete: ${def.name} — $${def.reward}`, '#3ad86b');
      G.hud.feed(`Iris: "Nice work, Juno. $${def.reward} is yours."`);
      G.audio.missionDone();
      G.combat.clearEnemies();
      this.marker.visible = false;
      this.targetPos = null;
      this.active = false;
      this.index += 1;
      if (this.index >= MISSION_DEFS.length) {
        this.objective = 'SOLMAR IS YOURS — story complete. Free roam!';
        G.hud.showEnd('SOLMAR IS YOURS', `All 8 missions done. You earned $${G.save.totalEarned} working for Iris.`);
        G.screen = 'over';
      } else {
        // The next mission starts at once — the story never makes you wait.
        this.start();
      }
      G.hud.setObjective(this.objective);
    },
    fail(reason) {
      G.hud.banner(`Mission failed: ${reason}`, '#ff6b4a');
      G.audio.fail();
      G.combat.clearEnemies();
      this.active = false;
      this.marker.visible = false;
      this.targetPos = null;
      this.objective = 'Mission failed — drive to the cafe to retry';
      this.targetPos = G.landmarks.cafe;
      this.marker.visible = true;
      this.marker.position.set(G.landmarks.cafe.x, 6, G.landmarks.cafe.z);
      G.hud.setObjective(this.objective);
    },
    retry() {
      // Restart the current mission from its first step.
      this.start();
    },
    onKill() {
      if (!this.active) return;
      const s = this.steps[this.stepIndex];
      if (s && s.type === 'kill') {
        this.kills += 1;
        this.objective = `${s.text} (${this.kills}/${this.killsNeeded} down)`;
        G.hud.setObjective(this.objective);
        if (this.kills >= this.killsNeeded) this.nextStep();
      }
    },
    step(dt) {
      // Marker bob + spin.
      if (this.marker.visible) {
        this.marker.rotation.y += dt * 2;
        this.marker.position.y = 6 + Math.sin(G.time * 2.5) * 0.5;
      }
      // Packages: collectible side job, $50 each.
      const p = G.player;
      for (let i = 0; i < this.pkgMeshes.length; i += 1) {
        const pkg = this.pkgMeshes[i];
        if (pkg.found) continue;
        pkg.mesh.rotation.y += dt;
        const d = Math.hypot(pkg.pos.x - p.mesh.position.x, pkg.pos.z - p.mesh.position.z);
        if (d < 2 && !p.inCar) {
          pkg.found = true;
          pkg.mesh.visible = false;
          G.save.packages.push(i);
          p.cash += 50;
          G.save.cash = p.cash;
          G.audio.pickup();
          G.hud.feed(`Package found! $50 (${G.save.packages.length}/20).`);
          if (G.save.packages.length === 20) {
            p.cash += 500;
            G.save.cash = p.cash;
            G.hud.banner('All 20 packages! Bonus $500.', '#3ad86b');
          }
        }
      }
      if (!this.active) return;
      const s = this.steps[this.stepIndex];
      if (!s) return;
      if (s.timeLimit) {
        this.timer -= dt;
        if (this.timer <= 0) { this.fail('Out of time.'); return; }
        G.hud.setTimer(Math.max(0, Math.ceil(this.timer)));
      }
      const pos = p.inCar ? p.inCar.mesh.position : p.mesh.position;
      const distTo = (target) => Math.hypot(target.x - pos.x, target.z - pos.z);
      if (s.type === 'goto' || s.type === 'deliver') {
        if (distTo(s.pos) < s.radius) this.nextStep();
      } else if (s.type === 'steal') {
        if (p.inCar === this.targetCar) {
          G.police.addHeat(1);
          this.nextStep();
        }
      } else if (s.type === 'escape') {
        if (G.police.stars >= s.wanted) {
          // Once the heat is on, reaching the spot clears the chase.
          if (distTo(s.pos) < s.radius) {
            G.police.clearStars();
            this.nextStep();
          }
        } else if (distTo(s.pos) < s.radius) {
          // Arrived before the heat: wait for the cops, or just move on.
          this.objective = `${s.text} — get the cops on you first!`;
          G.hud.setObjective(this.objective);
        }
      } else if (s.type === 'taxi') {
        const fare = this.taxiFares[Math.floor(this.taxiStage / 2)];
        if (!fare) { this.nextStep(); return; }
        if (this.taxiStage % 2 === 0) {
          if (distTo(fare.pick) < 6 && p.inCar) {
            this.taxiStage += 1;
            this.targetPos = fare.drop;
            this.marker.position.set(fare.drop.x, 6, fare.drop.z);
            this.objective = 'Taxi: take the fare to the drop-off';
            G.hud.setObjective(this.objective);
            G.hud.feed('Fare: "Step on it!"');
          }
        } else if (distTo(fare.drop) < 6 && p.inCar) {
          p.cash += 120;
          G.save.cash = p.cash;
          G.audio.pickup();
          G.hud.feed('Fare paid $120.');
          this.taxiStage += 1;
          if (this.taxiStage / 2 >= this.taxiFares.length) this.nextStep();
          else {
            const next = this.taxiFares[this.taxiStage / 2];
            this.targetPos = next.pick;
            this.marker.position.set(next.pick.x, 6, next.pick.z);
            this.objective = 'Taxi: pick up the next fare';
            G.hud.setObjective(this.objective);
          }
        }
      } else if (s.type === 'race') {
        const point = this.racePoints[this.raceIndex];
        if (point && distTo(point) < 10) {
          this.raceIndex += 1;
          if (this.raceIndex >= this.racePoints.length) this.nextStep();
          else {
            const next = this.racePoints[this.raceIndex];
            this.targetPos = next;
            this.marker.position.set(next.x, 6, next.z);
            this.objective = `Race: checkpoint ${this.raceIndex + 1}/${this.racePoints.length}`;
            G.hud.setObjective(this.objective);
          }
        }
      }
      // Kill steps advance through onKill(); the marker stays on the fight.
    },
  };
  return M;
}
