// Solmar — the city itself: districts, roads, buildings, props, landmarks, colliders
// and the road graph traffic drives on. Everything is procedural; no external art.
// x runs east, z runs south; the city is 600 x 600 m, roads on a 120 m grid.
import * as THREE from 'three';
import { PALETTE, ROAD_AXES, ROAD_HALF, WORLD, DISTRICTS, POIS, PACKAGE_SPOTS } from './config.js';
import { createRandom } from './random.js';
import { sunDirection, skyColors } from './palette.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
const SPH = new THREE.SphereGeometry(0.5, 10, 8);
const CONE = new THREE.ConeGeometry(0.5, 1, 10);

const materials = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${opts.rough ?? 0.9}|${opts.metal ?? 0}|${opts.emissive ?? ''}`;
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.9, metalness: opts.metal ?? 0, emissive: opts.emissive ?? 0x000000 }));
  }
  return materials.get(key);
}

/** Canvas window texture: building colour with a lit-window grid. */
function buildingTexture(base, lit, floors, cols) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, 128, 8);
  for (let f = 0; f < floors; f += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = 10 + i * ((128 - 20) / cols);
      const y = 18 + f * ((256 - 30) / floors);
      g.fillStyle = lit && ((f * 7 + i * 3) % 5 !== 0) ? '#ffd98a' : '#2a3542';
      g.fillRect(x, y, (128 - 20) / cols - 6, (256 - 30) / floors - 8);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  const sky = skyColors();
  grad.addColorStop(0, sky.top);
  grad.addColorStop(0.55, sky.horizon);
  grad.addColorStop(1, '#f2b880');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[3];
}

export function isOnRoad(x, z) {
  if (Math.abs(x) >= WORLD.ring - ROAD_HALF && Math.abs(x) <= WORLD.ring + ROAD_HALF) return true;
  if (Math.abs(z) >= WORLD.ring - ROAD_HALF && Math.abs(z) <= WORLD.ring + ROAD_HALF) return true;
  for (const a of ROAD_AXES) {
    if (Math.abs(x - a) <= ROAD_HALF || Math.abs(z - a) <= ROAD_HALF) return true;
  }
  return false;
}

/** Push a circle (x, z, r) out of every building collider; returns corrected {x, z}. */
export function collideCircle(colliders, x, z, r) {
  for (let pass = 0; pass < 2; pass += 1) {
    for (const c of colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // Centre inside the box: push out along the smallest penetration axis.
        const pl = x - c.x0 + r;
        const pr = c.x1 - x + r;
        const pt = z - c.z0 + r;
        const pb = c.z1 - z + r;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = c.x0 - r;
        else if (m === pr) x = c.x1 + r;
        else if (m === pt) z = c.z0 - r;
        else z = c.z1 + r;
      }
    }
  }
  return { x, z };
}

export function buildCity(scene, seed) {
  const rng = createRandom(seed);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // --- sky, fog, lights ------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1100, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 260, 900);
  const sunDir = sunDirection();
  const sun = new THREE.DirectionalLight(new THREE.Color(PALETTE.sun), 2.6);
  sun.position.set(sunDir.x * 420, sunDir.y * 420, sunDir.z * 420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -340;
  sun.shadow.camera.right = 340;
  sun.shadow.camera.top = 340;
  sun.shadow.camera.bottom = -340;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ee, 0x8a7a5a, 1.1));

  // --- ground, beach, sea ----------------------------------------------------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(620, 620), mat(0x8aa864, { rough: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(620, 34), mat(0xe8c890, { rough: 1 }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0, WORLD.beachZ + 14);
  beach.receiveShadow = true;
  group.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 500), new THREE.MeshStandardMaterial({ color: 0x2e86ab, roughness: 0.35, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.6, WORLD.seaZ + 250);
  group.add(sea);

  // --- roads + sidewalks ------------------------------------------------------
  const roadMat = mat(0x3a3f47, { rough: 0.95 });
  const walkMat = mat(0x9a938a, { rough: 1 });
  function roadStrip(x, z, w, l, horizontal) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? l : w + 5, horizontal ? w + 5 : l), walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.01, z);
    walk.receiveShadow = true;
    group.add(walk);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(horizontal ? l : w, horizontal ? w : l), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.03, z);
    road.receiveShadow = true;
    group.add(road);
  }
  for (const a of ROAD_AXES) {
    roadStrip(a, 0, ROAD_HALF * 2, 600, false);
    roadStrip(0, a, ROAD_HALF * 2, 600, true);
  }
  // Ring road.
  for (const s of [-WORLD.ring, WORLD.ring]) {
    roadStrip(s, 0, ROAD_HALF * 2, 600, false);
    roadStrip(0, s, ROAD_HALF * 2, 600, true);
  }
  // Crosswalk stripes at the central intersections.
  const stripeMat = mat(0xe8e4d8, { rough: 0.8 });
  for (const ax of [-120, 0, 120]) {
    for (const az of [-120, 0, 120]) {
      for (let i = -2; i <= 2; i += 1) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.4), stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(ax + i * 1.6, 0.05, az + 8);
        group.add(stripe);
      }
    }
  }

  // --- buildings --------------------------------------------------------------
  const glassTex = buildingTexture('#5a98b8', true, 14, 6);
  const pastelTex = PALETTE.building.map((c) => buildingTexture(c, true, 5, 4));
  const warehouseTex = buildingTexture('#9a8a74', false, 2, 8);
  const glassMat = new THREE.MeshStandardMaterial({ map: glassTex, roughness: 0.35, metalness: 0.35 });
  const pastelMats = pastelTex.map((t) => new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
  const warehouseMat = new THREE.MeshStandardMaterial({ map: warehouseTex, roughness: 0.95 });

  // Roads run on the ROAD_AXES grid (11 m wide, plus sidewalks), with a ring
  // road at the world edge. A building whose footprint overlaps a road band
  // blocks the avenue itself: the player's car stops against a wall in the
  // middle of the road (with seed 1 the x=0 avenue was walled off at
  // z=142). Nudge the footprint to the nearer clear side of every road band
  // it touches; the gap between two roads is far wider than any building,
  // so the nudge never pushes a building onto the next road.
  function clearOfRoads(x, z, w, d) {
    const m = ROAD_HALF + 2;
    const axes = [...ROAD_AXES, -WORLD.ring, WORLD.ring];
    let nx = x;
    let nz = z;
    for (const a of axes) {
      if (nx - w / 2 < a + m && nx + w / 2 > a - m) {
        const left = a - m - w / 2;
        const right = a + m + w / 2;
        nx = Math.abs(nx - left) <= Math.abs(nx - right) ? left : right;
      }
      if (nz - d / 2 < a + m && nz + d / 2 > a - m) {
        const near = a - m - d / 2;
        const far = a + m + d / 2;
        nz = Math.abs(nz - near) <= Math.abs(nz - far) ? near : far;
      }
    }
    return [nx, nz];
  }

  function addBuilding(x, z, w, h, d, material, collider = true) {
    [x, z] = clearOfRoads(x, z, w, d);
    const b = new THREE.Mesh(BOX, material);
    b.scale.set(w, h, d);
    b.position.set(x, h / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    group.add(b);
    if (collider) colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
    return b;
  }

  // One building per block cell, style by district; the centre cell is the plaza.
  const cells = [];
  for (let ix = 0; ix < 5; ix += 1) {
    for (let iz = 0; iz < 5; iz += 1) {
      const cx = -240 + ix * 120;
      const cz = -240 + iz * 120;
      cells.push([cx, cz]);
    }
  }
  for (const [cx, cz] of cells) {
    if (cx === 0 && cz === 0) continue; // Plaza del Sol — open, fountain only.
    const d = districtAt(cx, cz);
    if (d.name === 'Downtown') {
      const h = 28 + rng() * 42;
      addBuilding(cx + (rng() - 0.5) * 20, cz + (rng() - 0.5) * 20, 26 + rng() * 14, h, 26 + rng() * 14, glassMat);
      if (rng() < 0.5) addBuilding(cx + (rng() - 0.5) * 50, cz + (rng() - 0.5) * 50, 18, 12 + rng() * 10, 18, glassMat);
    } else if (d.name === 'Harbor Docks') {
      addBuilding(cx, cz, 52, 10 + rng() * 4, 30, warehouseMat);
      addBuilding(cx + (rng() - 0.5) * 40, cz + (rng() - 0.5) * 40, 20, 7, 16, warehouseMat);
    } else if (d.name === 'North Hills') {
      addBuilding(cx, cz, 22, 8 + rng() * 4, 18, pastelMats[Math.floor(rng() * pastelMats.length)]);
    } else {
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i += 1) {
        const bx = cx + (rng() - 0.5) * 62;
        const bz = cz + (rng() - 0.5) * 62;
        addBuilding(bx, bz, 20 + rng() * 10, 9 + rng() * 9, 18 + rng() * 8, pastelMats[Math.floor(rng() * pastelMats.length)]);
      }
    }
  }

  // --- landmarks ----------------------------------------------------------------
  // Solmar Tower — the tall glass landmark in Downtown.
  addBuilding(POIS.tower.x, POIS.tower.z, 24, 96, 24, glassMat);
  const towerTop = new THREE.Mesh(BOX, mat(0xff6b4a, { rough: 0.6, emissive: 0x662211 }));
  towerTop.scale.set(26, 3, 26);
  towerTop.position.set(POIS.tower.x, 97.5, POIS.tower.z);
  group.add(towerTop);

  // Plaza del Sol fountain.
  const basin = new THREE.Mesh(CYL, mat(0xb8c8d0, { rough: 0.4 }));
  basin.scale.set(16, 1.2, 16);
  basin.position.set(0, 0.6, 0);
  group.add(basin);
  const water = new THREE.Mesh(CYL, new THREE.MeshStandardMaterial({ color: 0x2e86ab, roughness: 0.2 }));
  water.scale.set(14, 0.4, 14);
  water.position.set(0, 1.1, 0);
  group.add(water);
  colliders.push({ x0: -8, z0: -8, x1: 8, z1: 8 });

  // Estadio del Sol — big bowl in the south-east.
  const stadium = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 16, 24), mat(0xd8d0c0, { rough: 0.9 }));
  stadium.position.set(POIS.stadium.x, 8, POIS.stadium.z);
  stadium.castShadow = true;
  group.add(stadium);
  const pitch = new THREE.Mesh(new THREE.CircleGeometry(26, 24), mat(0x5a9a4a, { rough: 1 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.position.set(POIS.stadium.x, 0.06, POIS.stadium.z);
  group.add(pitch);
  colliders.push({ x0: POIS.stadium.x - 36, z0: POIS.stadium.z - 36, x1: POIS.stadium.x + 36, z1: POIS.stadium.z + 36 });

  // Old Lighthouse on the beach.
  const lightBase = new THREE.Mesh(CYL, mat(0xe8e4d8, { rough: 0.8 }));
  lightBase.scale.set(7, 26, 7);
  lightBase.position.set(POIS.lighthouse.x, 13, POIS.lighthouse.z);
  lightBase.castShadow = true;
  group.add(lightBase);
  const lightTop = new THREE.Mesh(CONE, mat(0x8c2f2f, { rough: 0.7 }));
  lightTop.scale.set(8, 6, 8);
  lightTop.position.set(POIS.lighthouse.x, 29, POIS.lighthouse.z);
  group.add(lightTop);
  const lamp = new THREE.Mesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }));
  lamp.scale.set(3, 3, 3);
  lamp.position.set(POIS.lighthouse.x, 25.5, POIS.lighthouse.z);
  group.add(lamp);
  colliders.push({ x0: POIS.lighthouse.x - 4, z0: POIS.lighthouse.z - 4, x1: POIS.lighthouse.x + 4, z1: POIS.lighthouse.z + 4 });

  // Pier 9 — wooden pier out into the sea.
  const pierMat = mat(0x8a6a4a, { rough: 1 });
  for (let z = WORLD.beachZ; z <= 320; z += 6) {
    const plank = new THREE.Mesh(BOX, pierMat);
    plank.scale.set(12, 0.5, 5);
    plank.position.set(POIS.pier9.x, 0.8, z);
    group.add(plank);
  }
  for (const px of [POIS.pier9.x - 5, POIS.pier9.x + 5]) {
    for (let z = WORLD.beachZ; z <= 318; z += 24) {
      const post = new THREE.Mesh(CYL, pierMat);
      post.scale.set(0.9, 3, 0.9);
      post.position.set(px, 0.5, z);
      group.add(post);
    }
  }

  // Harbor cranes + containers.
  const craneMat = mat(0xd8a83a, { rough: 0.7, metal: 0.3 });
  for (const [cx, cz] of [[170, -230], [240, -170]]) {
    const mast = new THREE.Mesh(BOX, craneMat);
    mast.scale.set(4, 34, 4);
    mast.position.set(cx, 17, cz);
    mast.castShadow = true;
    group.add(mast);
    const arm = new THREE.Mesh(BOX, craneMat);
    arm.scale.set(40, 2.5, 2.5);
    arm.position.set(cx + 12, 32, cz);
    group.add(arm);
    colliders.push({ x0: cx - 3, z0: cz - 3, x1: cx + 3, z1: cz + 3 });
  }
  const containerGeo = new THREE.BoxGeometry(12, 3, 3);
  const containerCols = [0xd86a5a, 0x5a98b8, 0x7fae62, 0xd8a83a, 0x8a6a9a];
  const containers = new THREE.InstancedMesh(containerGeo, mat(0xffffff, { rough: 0.85 }), 26);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < 26; i += 1) {
    const bx = 150 + (i % 6) * 16;
    const bz = -250 + Math.floor(i / 6) * 10;
    const stack = i % 3 === 0 ? 2 : 1;
    e.set(0, (i % 2) * 0.02, 0);
    q.setFromEuler(e);
    m4.compose(v.set(bx, 1.5 + (stack - 1) * 3, bz), q, s);
    containers.setMatrixAt(i, m4);
    containers.setColorAt(i, new THREE.Color(containerCols[i % containerCols.length]));
  }
  containers.castShadow = true;
  group.add(containers);

  // Marina yachts on the sea.
  const hullMat = mat(0xf2f2ee, { rough: 0.4 });
  for (let i = 0; i < 5; i += 1) {
    const yx = -260 + i * 22;
    const yz = 315 + (i % 2) * 14;
    const hull = new THREE.Mesh(BOX, hullMat);
    hull.scale.set(5, 2, 14);
    hull.position.set(yx, 0.4, yz);
    group.add(hull);
    const cabin = new THREE.Mesh(BOX, mat(0x6fa8c8, { rough: 0.5 }));
    cabin.scale.set(3.5, 2, 6);
    cabin.position.set(yx, 2.2, yz);
    group.add(cabin);
    const mast = new THREE.Mesh(CYL, mat(0x888888, { metal: 0.6, rough: 0.4 }));
    mast.scale.set(0.3, 12, 0.3);
    mast.position.set(yx, 8, yz);
    group.add(mast);
  }

  // --- palms, lamps, benches, hydrants, billboards -------------------------------
  const palmTrunk = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
  const palmTop = new THREE.ConeGeometry(2.2, 3.4, 8);
  const palms = new THREE.InstancedMesh(palmTrunk, mat(0x7a5a3a, { rough: 1 }), 60);
  const palmCrowns = new THREE.InstancedMesh(palmTop, mat(0x4a8a3a, { rough: 1 }), 60);
  for (let i = 0; i < 60; i += 1) {
    // Palms line the beach and the Marina boardwalk.
    const alongBeach = i < 30;
    const px = alongBeach ? -290 + i * 20 : -280 + (i - 30) * 19;
    const pz = alongBeach ? 266 + (rng() - 0.5) * 4 : 120 + (i % 3) * 40;
    m4.compose(v.set(px, 3, pz), q.identity(), s.set(1, 1, 1));
    palms.setMatrixAt(i, m4);
    m4.compose(v.set(px, 7.2, pz), q, s);
    palmCrowns.setMatrixAt(i, m4);
  }
  palms.castShadow = true;
  group.add(palms);
  group.add(palmCrowns);

  const lampPole = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
  const lamps = new THREE.InstancedMesh(lampPole, mat(0x2a2e36, { metal: 0.5, rough: 0.5 }), 48);
  const lampBulbs = new THREE.InstancedMesh(SPH, new THREE.MeshBasicMaterial({ color: 0xffe9a0 }), 48);
  let li = 0;
  for (const a of [-240, -120, 0, 120, 240]) {
    for (const t of [-200, -80, 40, 160]) {
      if (li >= 48) break;
      m4.compose(v.set(a + 7, 3.5, t), q.identity(), s.set(1, 1, 1));
      lamps.setMatrixAt(li, m4);
      m4.compose(v.set(a + 7, 7.1, t), q, s.set(1.4, 1.4, 1.4));
      lampBulbs.setMatrixAt(li, m4);
      li += 1;
    }
  }
  lamps.count = li;
  lampBulbs.count = li;
  group.add(lamps);
  group.add(lampBulbs);

  // Billboards with invented ads.
  function billboard(x, z, ry, text, bg) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#ffffff';
    g.font = 'bold 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 128, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: t }));
    board.position.set(x, 12, z);
    board.rotation.y = ry;
    group.add(board);
    const post = new THREE.Mesh(BOX, mat(0x3a3f47, { rough: 0.9 }));
    post.scale.set(1, 8, 1);
    post.position.set(x, 4, z);
    group.add(post);
    colliders.push({ x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 });
  }
  billboard(-8, -132, 0, 'SOLA COLA', '#ff6b4a');
  billboard(132, 8, -Math.PI / 2, 'MERIDIAN BANK', '#17a398');
  billboard(8, 132, Math.PI, 'PIER 9 CINEMA', '#2f6fd8');
  billboard(-132, -8, Math.PI / 2, 'SOLMAR SODA', '#d8a83a');

  // --- hidden packages (golden cases) --------------------------------------------
  const packageMeshes = [];
  const pkgGeo = new THREE.BoxGeometry(0.9, 0.6, 0.9);
  const pkgMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, emissive: 0x8a6a10, roughness: 0.4, metalness: 0.4 });
  for (const [px, pz] of PACKAGE_SPOTS) {
    const p = new THREE.Mesh(pkgGeo, pkgMat);
    p.position.set(px, 0.5, pz);
    group.add(p);
    packageMeshes.push(p);
  }

  // --- traffic waypoint loops ------------------------------------------------------
  const loops = [];
  const axes = ROAD_AXES;
  for (let i = 0; i < axes.length - 1; i += 1) {
    for (let j = 0; j < axes.length - 1; j += 1) {
      loops.push([
        [axes[i], axes[j]], [axes[i + 1], axes[j]], [axes[i + 1], axes[j + 1]], [axes[i], axes[j + 1]],
      ]);
    }
  }
  loops.push([[-280, -280], [280, -280], [280, 280], [-280, 280]]);

  return { group, colliders, loops, packageMeshes, pois: POIS };
}
