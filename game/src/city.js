// Solmar itself: ground, sea, beach, road grid, district buildings with painted window
// textures, landmarks, palms, lamps and props. Also owns the collision boxes and the
// road list the traffic, minimap and missions all read from.
import * as THREE from 'three';
import { AVENUES, CITY, DISTRICTS, PALETTE, STREETS } from './config.js';
import { pick, range } from './random.js';
import { LOOK } from './palette.js';

function windowTexture(rng, base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cols = 4 + Math.floor(rng() * 3);
  const rows = 6 + Math.floor(rng() * 4);
  for (let x = 0; x < cols; x += 1) {
    for (let y = 0; y < rows; y += 1) {
      const on = rng() < 0.35;
      g.fillStyle = on ? (lit ? '#ffe9a8' : '#ffd9a0') : '#2e3a4a';
      g.fillRect(8 + x * (112 / cols), 10 + y * (236 / rows), 112 / cols - 6, 236 / rows - 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#8aa86b';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i += 1) {
    g.fillStyle = rng() < 0.5 ? '#7fa060' : '#93b578';
    g.fillRect(Math.floor(rng() * 512), Math.floor(rng() * 512), 3, 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(G) {
  const { scene, rng } = G;
  const colliders = [];
  const roads = [];
  const landmarks = {};
  G.colliders = colliders;
  G.roads = roads;
  G.landmarks = landmarks;

  scene.background = new THREE.Color(LOOK.sky.horizon);
  scene.fog = new THREE.Fog(new THREE.Color(LOOK.sky.fog), LOOK.sky.fogNear, LOOK.sky.fogFar);

  // Sky dome: gradient sphere, back side.
  const skyGeo = new THREE.SphereGeometry(850, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(LOOK.sky.top) },
      bottom: { value: new THREE.Color(LOOK.sky.horizon) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bottom; void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(h, 0.8)), 1.0); }',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Sun + sky light.
  const sun = new THREE.DirectionalLight(new THREE.Color(LOOK.sun.color), LOOK.sun.intensity);
  const az = LOOK.sun.azimuth; const el = LOOK.sun.elevation;
  sun.position.set(Math.cos(el) * Math.sin(az) * 400, Math.sin(el) * 400, Math.cos(el) * Math.cos(az) * 400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6b4a, 0.9));

  // Ground, beach, sea.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 620),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 56),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY.beachZ + 26);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 500),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY.seaZ + 250);
  scene.add(sea);

  // Roads: asphalt strips + pale sidewalks + centre dashes.
  const asphaltMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2e8c8 });
  function roadStrip(x0, z0, x1, z1) {
    const w = Math.abs(x1 - x0); const d = Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, 2 * CITY.roadHalf), Math.max(d, 2 * CITY.roadHalf)), asphaltMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(cx, 0.08, cz);
    road.receiveShadow = true;
    scene.add(road);
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, 2 * CITY.roadHalf) + 6, Math.max(d, 2 * CITY.roadHalf) + 6), walkMat);
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(cx, 0.06, cz);
    walk.receiveShadow = true;
    scene.add(walk);
    roads.push({ x0, z0, x1, z1 });
    // Centre dashes along the long axis.
    const along = w > d ? 'x' : 'z';
    const len = along === 'x' ? w : d;
    const dashGeo = new THREE.PlaneGeometry(3, 0.5);
    for (let s = -len / 2 + 8; s < len / 2 - 4; s += 12) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      if (along === 'x') { dash.position.set(cx + s, 0.1, cz); dash.rotation.z = 0; }
      else { dash.position.set(cx, 0.1, cz + s); dash.rotation.z = Math.PI / 2; }
      scene.add(dash);
    }
  }
  for (const a of AVENUES) roadStrip(a - CITY.roadHalf, -300, a + CITY.roadHalf, 300);
  for (const s of STREETS) roadStrip(-300, s - CITY.roadHalf, 300, s + CITY.roadHalf);
  // Ring road.
  roadStrip(-276, -276, 276, -264);
  roadStrip(-276, 264, 276, 276);
  roadStrip(-276, -276, -264, 276);
  roadStrip(264, -276, 276, 276);

  // Buildings, one per block quadrant, heights by district.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  const texVariants = [];
  for (let i = 0; i < 4; i += 1) texVariants.push(windowTexture(rng, pick(rng, PALETTE.building), i % 2 === 0));
  const blockCentres = [];
  for (const bx of [-180, -60, 60, 180]) {
    for (const bz of [-180, -60, 60, 180]) blockCentres.push([bx, bz]);
  }
  for (const [bx, bz] of blockCentres) {
    if (bx === 60 && bz === -60) continue; // the Solmar Tower block — tower goes here instead
    const district = DISTRICTS.find((d) => bx >= d.x0 && bx < d.x1 && bz >= d.z0 && bz < d.z1) || DISTRICTS[3];
    const tall = district.style === 'downtown';
    const count = tall ? 1 : 2 + Math.floor(rng() * 2);
    for (let i = 0; i < count; i += 1) {
      const ox = count === 1 ? 0 : (i % 2 === 0 ? -14 : 14);
      const oz = count === 1 ? 0 : (i < 2 ? -14 : 14);
      const w = tall ? range(rng, 30, 44) : range(rng, 16, 26);
      const d = tall ? range(rng, 30, 44) : range(rng, 16, 26);
      const h = tall ? range(rng, 55, 110) : district.style === 'hills' ? range(rng, 8, 16) : range(rng, 12, 34);
      const mat = new THREE.MeshLambertMaterial({ map: pick(rng, texVariants) });
      const b = new THREE.Mesh(boxGeo, mat);
      b.scale.set(w, h, d);
      b.position.set(bx + ox, h / 2, bz + oz);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      const roofMat = new THREE.MeshLambertMaterial({ color: LOOK.districts[district.style].roof });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.scale.set(w + 1, 1.2, d + 1);
      roof.position.set(bx + ox, h + 0.6, bz + oz);
      scene.add(roof);
      colliders.push({ x0: bx + ox - w / 2, z0: bz + oz - d / 2, x1: bx + ox + w / 2, z1: bz + oz + d / 2 });
    }
  }

  // Landmarks: Solmar Tower, Pier 9, Old Lighthouse, Estadio del Sol.
  const towerMat = new THREE.MeshLambertMaterial({ map: texVariants[0] });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(36, 150, 36);
  tower.position.set(60, 75, -60);
  tower.castShadow = true;
  scene.add(tower);
  const towerRoof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: LOOK.districts.downtown.roof }));
  towerRoof.scale.set(38, 3, 38);
  towerRoof.position.set(60, 151, -60);
  scene.add(towerRoof);
  colliders.push({ x0: 42, z0: -78, x1: 78, z1: -42 });
  landmarks.tower = new THREE.Vector3(60, 0, -60);
  landmarks.towerGarage = new THREE.Vector3(60, 0, -20);

  // Pier 9: planks out into the sea with lamps.
  const pierMat = new THREE.MeshLambertMaterial({ color: '#8a6b4a' });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 90), pierMat);
  pier.position.set(-180, 0.6, 300);
  pier.castShadow = true;
  scene.add(pier);
  colliders.push({ x0: -187, z0: 255, x1: -173, z1: 344 });
  landmarks.pier = new THREE.Vector3(-180, 0, 330);
  landmarks.pierEnd = new THREE.Vector3(-180, 0, 338);

  // Old Lighthouse at the east beach.
  const lightMat = new THREE.MeshLambertMaterial({ color: '#f2e8d8' });
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 42, 12), lightMat);
  lighthouse.position.set(272, 21, 180);
  lighthouse.castShadow = true;
  scene.add(lighthouse);
  const lightTop = new THREE.Mesh(new THREE.SphereGeometry(4.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
  lightTop.position.set(272, 44, 180);
  scene.add(lightTop);
  colliders.push({ x0: 266, z0: 174, x1: 278, z1: 186 });
  landmarks.lighthouse = new THREE.Vector3(272, 0, 180);

  // Estadio del Sol: low bowl west.
  const estadio = new THREE.Mesh(new THREE.CylinderGeometry(42, 46, 14, 20), new THREE.MeshLambertMaterial({ color: '#e8e8e8' }));
  estadio.position.set(-252, 7, -30);
  estadio.castShadow = true;
  scene.add(estadio);
  colliders.push({ x0: -298, z0: -76, x1: -206, z1: 16 });
  landmarks.estadio = new THREE.Vector3(-252, 0, -30);

  // Palms along the beach and avenues.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: '#8a6b4a' });
  const leafGeo = new THREE.ConeGeometry(3.2, 3.4, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: '#4a8a3a' });
  function palm(x, z) {
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 3.5, z);
    t.castShadow = true;
    scene.add(t);
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.position.set(x, 8.2, z);
    l.castShadow = true;
    scene.add(l);
  }
  for (let x = -280; x <= 280; x += 28) palm(x, 246);
  for (let x = -280; x <= 280; x += 56) palm(x + 10, -282);
  for (const a of AVENUES) {
    for (let z = -260; z <= 260; z += 80) palm(a + 9, z);
  }

  // Street lamps along avenues + billboards with invented ads.
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: '#3a3f47' });
  const bulbGeo = new THREE.SphereGeometry(0.7, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const a of AVENUES) {
    for (let z = -240; z <= 240; z += 60) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(a - 8, 3.5, z);
      scene.add(p);
      const b = new THREE.Mesh(bulbGeo, bulbMat);
      b.position.set(a - 8, 7.2, z);
      scene.add(b);
    }
  }
  const ads = ['SOLA COLA', 'MERIDIAN BANK', 'PIER 9 CINEMA', 'SOLMAR SODA', 'DELTA RENTALS'];
  const billGeo = new THREE.PlaneGeometry(16, 8);
  ads.forEach((text, i) => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = ['#ff6b4a', '#17a398', '#f2c94c', '#3a5a7c', '#e8a87c'][i];
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#ffffff';
    g.font = 'bold 26px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(text, 128, 70);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const bill = new THREE.Mesh(billGeo, new THREE.MeshBasicMaterial({ map: tex }));
    const x = -240 + i * 120;
    bill.position.set(x, 16, -252);
    scene.add(bill);
    const post = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), poleMat);
    post.position.set(x, 6, -252);
    scene.add(post);
    colliders.push({ x0: x - 0.6, z0: -252.6, x1: x + 0.6, z1: -251.4 });
  });

  // Key named spots missions and screenshots use.
  landmarks.cafe = new THREE.Vector3(-90, 0, 0); // Iris's cafe, Old Town
  landmarks.marina = new THREE.Vector3(-180, 0, 120); // Vela GT spot
  landmarks.docks = new THREE.Vector3(180, 0, 120); // cargo drop
  landmarks.hillsLookout = new THREE.Vector3(120, 0, -240);
  landmarks.garage = new THREE.Vector3(60, 0, 180); // Tune-Up Garage
  landmarks.hardware = new THREE.Vector3(180, 0, -60); // Harbor Hardware
  landmarks.dealership = new THREE.Vector3(-180, 0, -180); // Marina Motors
  landmarks.hospital = new THREE.Vector3(0, 0, -180);
  landmarks.ringStart = new THREE.Vector3(0, 0, -270);
  landmarks.spawn = new THREE.Vector3(0, 0, 60);
  landmarks.packageSpots = [
    new THREE.Vector3(-240, 0, 240), new THREE.Vector3(-120, 0, -240), new THREE.Vector3(120, 0, 240),
    new THREE.Vector3(240, 0, -120), new THREE.Vector3(-60, 0, 120), new THREE.Vector3(60, 0, -120),
    new THREE.Vector3(-180, 0, -60), new THREE.Vector3(180, 0, 60), new THREE.Vector3(0, 0, 240),
    new THREE.Vector3(-240, 0, -180), new THREE.Vector3(240, 0, 180), new THREE.Vector3(120, 0, -240),
    new THREE.Vector3(-120, 0, 60), new THREE.Vector3(60, 0, 180), new THREE.Vector3(-60, 0, -180),
    new THREE.Vector3(180, 0, -180), new THREE.Vector3(-180, 0, 180), new THREE.Vector3(0, 0, -60),
    new THREE.Vector3(240, 0, 0), new THREE.Vector3(-240, 0, 60),
  ];
}

// Circle vs building AABBs: push the circle out, return true when a hit happened.
export function collideCircle(G, pos, radius) {
  let hit = false;
  for (const c of G.colliders) {
    const cx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const cz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        pos.x = c.x1 + radius;
      }
    }
  }
  return hit;
}

export function inCityBounds(x, z) {
  return x > -298 && x < 298 && z > -298 && z < 296;
}
