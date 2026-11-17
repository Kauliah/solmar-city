// Solmar City — builds the whole city into a three.js scene: ground, sea and
// beach, the road grid, five districts of procedural buildings, landmarks,
// street props, and the collider list the cars and the player push against.
import * as THREE from 'three';
import { CITY_HALF, DISTRICTS, ROADS, ROAD_HALF } from './config.js';
import { FACADE, DISTRICT_COLORS } from './palette.js';
import { pick, range, rangeInt } from './random.js';

const BLOCK = 120; // distance between road centre lines

function windowTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 4;
  const rows = 8;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const on = rng() < 0.45;
      g.fillStyle = on ? lit : '#2a3442';
      g.fillRect(10 + x * 30, 12 + y * 30, 18, 20);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function billboardTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = fg;
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const words = text.split(' ');
  if (words.length > 1) {
    g.fillText(words.slice(0, -1).join(' '), 128, 46);
    g.fillText(words[words.length - 1], 128, 88);
  } else {
    g.fillText(text, 128, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function districtAt(x, z) {
  let best = DISTRICTS[0];
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    const dd = (x - d.cx) ** 2 + (z - d.cz) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

function addCollider(G, x, z, hx, hz) {
  G.colliders.push({ minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz });
}

/** Push a circle (x, z, r) out of every building collider; returns corrected [x, z]. */
export function collideCircle(G, x, z, r) {
  for (const c of G.colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    } else if (d2 <= 0.0001) {
      // Centre inside the box: push out along the smallest penetration axis.
      const pl = x - c.minX + r;
      const pr = c.maxX - x + r;
      const pt = z - c.minZ + r;
      const pb = c.maxZ - z + r;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) x = c.minX - r;
      else if (m === pr) x = c.maxX + r;
      else if (m === pt) z = c.minZ - r;
      else z = c.maxZ + r;
    }
  }
  const lim = CITY_HALF - 4;
  x = Math.max(-lim, Math.min(lim, x));
  z = Math.max(-lim, Math.min(lim, z));
  return [x, z];
}

export function buildCity(G) {
  const rng = G.rng;
  const scene = G.scene;
  G.colliders = [];
  G.roadLines = [];
  G.intersections = [];
  for (const a of ROADS) {
    for (const b of ROADS) G.intersections.push([a, b]);
    G.roadLines.push({ axis: 'x', at: a });
    G.roadLines.push({ axis: 'z', at: a });
  }

  // Sky: warm gradient dome + fog + late-afternoon sun.
  scene.background = new THREE.Color(0x8fc3e0);
  scene.fog = new THREE.Fog(0xf2c98f, 220, 900);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.4);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -320;
  sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320;
  sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5a, 1.1));

  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  const geoCyl = new THREE.CylinderGeometry(1, 1, 1, 10);
  const matGround = new THREE.MeshLambertMaterial({ color: 0x8fae7a });
  const matSand = new THREE.MeshLambertMaterial({ color: 0xe8c890 });
  const matSea = new THREE.MeshLambertMaterial({ color: 0x2e86ab });
  const matRoad = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const matWalk = new THREE.MeshLambertMaterial({ color: 0x9a938a });

  function box(w, h, d, mat, x, y, z, shadow = true) {
    const m = new THREE.Mesh(geoBox, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  // Ground, beach strip (south edge) and sea beyond it.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(760, 760), matGround);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, -20);
  ground.receiveShadow = true;
  scene.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(760, 34), matSand);
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0, 297);
  beach.receiveShadow = true;
  scene.add(beach);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 160), matSea);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, 390);
  scene.add(sea);

  // Roads: asphalt strips + pale sidewalks on both sides, centre dashes.
  // East-west roads run along X at z=c; north-south roads run along Z at x=c.
  // Dashes are one InstancedMesh (380 instances) instead of 380 meshes.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2e8c8 });
  const dashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), dashMat, 380);
  const dashMatrix = new THREE.Matrix4();
  let dashIndex = 0;
  for (const c of ROADS) {
    box(620, 0.1, 14, matRoad, 0, 0.02, c, false);
    box(620, 0.08, 20, matWalk, 0, 0.005, c, false);
    box(14, 0.1, 620, matRoad, c, 0.02, 0, false);
    box(20, 0.08, 620, matWalk, c, 0.005, 0, false);
    // Centre dashes along both directions.
    for (let t = -300; t < 300; t += 16) {
      dashMatrix.makeScale(4, 0.06, 0.6);
      dashMatrix.setPosition(t, 0.08, c);
      dashMesh.setMatrixAt(dashIndex++, dashMatrix);
      dashMatrix.makeScale(0.6, 0.06, 4);
      dashMatrix.setPosition(c, 0.08, t);
      dashMesh.setMatrixAt(dashIndex++, dashMatrix);
    }
  }
  dashMesh.instanceMatrix.needsUpdate = true;
  scene.add(dashMesh);

  // Buildings: one or two per block. Blocks sit BETWEEN the roads (centres at
  // -180/-60/60/180), so the roads themselves stay clear for driving.
  const facadeMats = {};
  for (const style of Object.keys(FACADE)) {
    facadeMats[style] = FACADE[style].map((base) => new THREE.MeshLambertMaterial({
      map: windowTexture(rng, base, '#ffd98a'),
    }));
  }
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5348 });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc8dd });

  for (let bx = -2; bx <= 1; bx += 1) {
    for (let bz = -2; bz <= 1; bz += 1) {
      const blockX = bx * BLOCK + 60;
      const blockZ = bz * BLOCK + 60;
      const d = districtAt(blockX, blockZ);
      const lots = d.style === 'downtown' ? 2 : rangeInt(rng, 1, 3);
      for (let i = 0; i < lots; i += 1) {
        const ox = blockX + (i === 0 ? -22 : i === 1 ? 22 : 0) + range(rng, -6, 6);
        const oz = blockZ + (i === 2 ? -22 : i === 1 ? 22 : 0) + range(rng, -6, 6);
        const tall = d.style === 'downtown';
        const h = tall ? range(rng, 45, 95) : d.style === 'docks' ? range(rng, 8, 16) : range(rng, 10, 30);
        const w = range(rng, 22, 34);
        const dep = range(rng, 22, 34);
        const mat = tall && rng() < 0.4 ? glassMat : pick(rng, facadeMats[d.style]);
        const b = box(w, h, dep, mat, ox, h / 2, oz);
        b.userData.district = d.name;
        box(w + 1, 1.2, dep + 1, roofMat, ox, h + 0.6, oz);
        // Rooftop detail: a small box or antenna on taller buildings.
        if (h > 30) box(2, range(rng, 4, 10), 2, roofMat, ox + w / 4, h + 4, oz);
        addCollider(G, ox, oz, w / 2 + 0.5, dep / 2 + 0.5);
      }
    }
  }

  // Landmarks: Solmar Tower (Downtown), Pier 9 (south), Old Lighthouse (sea),
  // Estadio del Sol (east edge), Marina yachts.
  const tower = box(34, 130, 34, glassMat, 180, 65, -180);
  tower.userData.landmark = 'Solmar Tower';
  box(38, 3, 38, roofMat, 180, 131, -180);
  box(3, 18, 3, new THREE.MeshLambertMaterial({ color: 0xff6b4a }), 180, 140, -180);
  addCollider(G, 180, -180, 18, 18);

  // Pier 9: wooden deck out into the sea, south edge.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  box(16, 1.5, 70, pierMat, -240, 0.4, 330);
  for (let t = 0; t < 5; t += 1) {
    const post = new THREE.Mesh(geoCyl, pierMat);
    post.scale.set(0.5, 3, 0.5);
    post.position.set(-240 + (t % 2 ? 7 : -7), 0, 305 + t * 12);
    scene.add(post);
  }
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0xff6b4a });
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(7, 1.2, 8, 24), wheelMat);
  wheel.position.set(-222, 12, 348);
  wheel.rotation.y = Math.PI / 2;
  scene.add(wheel);

  // Old Lighthouse on a rock at the south-west sea edge.
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const lh = new THREE.Mesh(geoCyl, lightMat);
  lh.scale.set(4, 26, 4);
  lh.position.set(-280, 12, 360);
  lh.castShadow = true;
  scene.add(lh);
  const lhTop = new THREE.Mesh(geoCyl, new THREE.MeshLambertMaterial({ color: 0x2a3442 }));
  lhTop.scale.set(5, 4, 5);
  lhTop.position.set(-280, 26, 360);
  scene.add(lhTop);

  // Estadio del Sol: low ring stadium, east edge.
  const stadMat = new THREE.MeshLambertMaterial({ color: 0xd8e8c8 });
  const stad = new THREE.Mesh(new THREE.CylinderGeometry(34, 38, 12, 20), stadMat);
  stad.position.set(280, 6, 0);
  stad.castShadow = true;
  stad.receiveShadow = true;
  scene.add(stad);
  const pitch = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 1, 20), new THREE.MeshLambertMaterial({ color: 0x5a9a4a }));
  pitch.position.set(280, 12.4, 0);
  scene.add(pitch);
  addCollider(G, 280, 0, 36, 36);

  // Marina yachts bobbing in the water south-west.
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  for (let i = 0; i < 5; i += 1) {
    const x = -220 + i * 34;
    const hull = box(6, 2.5, 16, hullMat, x, 0.6, 330 + (i % 2) * 14);
    hull.rotation.y = range(rng, -0.15, 0.15);
    box(1, 10, 1, new THREE.MeshLambertMaterial({ color: 0x8a6a4a }), x, 6, 330 + (i % 2) * 14);
  }

  // Docks: containers + cranes on the south strip, clear of the road grid.
  const contColors = [0xd94f3d, 0x3d7fd9, 0xf2c94c, 0x3dd9a0, 0x8a5ac8];
  for (let i = 0; i < 14; i += 1) {
    const x = 150 + (i % 5) * 26 + range(rng, -4, 4);
    const z = 252 + Math.floor(i / 5) * 10 + range(rng, -2, 2);
    const c = box(12, 5, 5, new THREE.MeshLambertMaterial({ color: pick(rng, contColors) }), x, 2.5, z);
    c.rotation.y = (i % 2) * 0.1;
    addCollider(G, x, z, 6.5, 3);
  }
  for (const cx of [150, 230]) {
    box(4, 34, 4, new THREE.MeshLambertMaterial({ color: 0xf2c94c }), cx, 17, 272);
    box(26, 3, 4, new THREE.MeshLambertMaterial({ color: 0xf2c94c }), cx + 8, 32, 272);
  }

  // Street props: palms along the beach + Marina, lamps on roads, benches,
  // hydrants, billboards with invented ads.
  const palmTrunk = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const palmLeaf = new THREE.MeshLambertMaterial({ color: 0x3d8a4a });
  function palm(x, z) {
    const t = new THREE.Mesh(geoCyl, palmTrunk);
    t.scale.set(0.35, 7, 0.35);
    t.position.set(x, 3.5, z);
    t.castShadow = true;
    scene.add(t);
    for (let i = 0; i < 5; i += 1) {
      const leaf = box(4.5, 0.3, 1.1, palmLeaf, x, 7, z);
      leaf.rotation.y = (i / 5) * Math.PI * 2;
      leaf.position.x = x + Math.cos((i / 5) * Math.PI * 2) * 1.8;
      leaf.position.z = z + Math.sin((i / 5) * Math.PI * 2) * 1.8;
      leaf.rotation.z = 0.35;
    }
    addCollider(G, x, z, 0.5, 0.5);
  }
  for (let x = -280; x <= 280; x += 28) palm(x, 288);
  for (let x = -240; x <= -120; x += 30) palm(x, 150 + range(rng, -4, 4));
  for (let z = -240; z <= 240; z += 48) palm(-288, z);

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a3442 });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffe8a0 });
  for (const c of ROADS) {
    for (let t = -260; t <= 260; t += 80) {
      box(0.5, 7, 0.5, lampMat, t, 3.5, c + 9);
      box(1.6, 0.5, 1.6, lampGlow, t, 7.2, c + 9);
      box(0.5, 7, 0.5, lampMat, c + 9, 3.5, t);
      box(1.6, 0.5, 1.6, lampGlow, c + 9, 7.2, t);
    }
  }

  const benchMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  for (let i = 0; i < 10; i += 1) {
    const x = range(rng, -260, 260);
    const z = pick(rng, ROADS) + 10;
    box(3, 0.4, 1, benchMat, x, 0.8, z);
    box(3, 1, 0.3, benchMat, x, 1.2, z - 0.4);
  }

  const ads = [
    ['SOLA COLA', '#ff6b4a', '#ffffff'],
    ['MERIDIAN BANK', '#17a398', '#ffffff'],
    ['PIER 9 CINEMA', '#2e86ab', '#ffd9a0'],
    ['SOLMAR SODA', '#f2c94c', '#2a3442'],
  ];
  ads.forEach(([text, bg, fg], i) => {
    const tex = billboardTexture(text, bg, fg);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 9),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    // Block corners, clear of buildings and roads.
    const bx = [-20, 20, -200, 220][i];
    const bz = [100, -100, -200, 220][i];
    board.position.set(bx, 12, bz);
    board.rotation.y = (i % 2) * Math.PI;
    scene.add(board);
    box(1, 12, 1, lampMat, bx, 6, bz + (i % 2 ? 0.6 : -0.6));
    addCollider(G, bx, bz, 1, 1);
  });

  // Traffic lights at the main intersections (visual only).
  const lightPole = new THREE.MeshLambertMaterial({ color: 0x2a3442 });
  for (const [ix, iz] of G.intersections) {
    box(0.5, 6, 0.5, lightPole, ix + 9, 3, iz + 9);
    box(1.2, 2.4, 1.2, new THREE.MeshLambertMaterial({ color: 0x1b2a4a }), ix + 9, 6.5, iz + 9);
  }

  // District name markers for the minimap (positions only, drawn in 2D).
  G.districtLabels = DISTRICTS.map((d) => ({ name: d.name, x: d.cx, z: d.cz, color: DISTRICT_COLORS[d.style] }));
}
