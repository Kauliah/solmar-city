// Particles, muzzle flashes, smoke, skid marks and the damage vignette.
// One pooled THREE.Points cloud plus a few reusable meshes — no per-frame allocations.
import * as THREE from 'three';

const MAX_PARTICLES = 400;

export function createEffects(scene) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;

  // Skid marks: dark quads that fade out.
  const skids = [];
  const skidGeo = new THREE.PlaneGeometry(0.35, 1.4);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.55, depthWrite: false });
  for (let i = 0; i < 120; i += 1) {
    const m = new THREE.Mesh(skidGeo, skidMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    m.visible = false;
    scene.add(m);
    skids.push({ mesh: m, life: 0 });
  }
  let skidCursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.alive = true; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.r = r; p.g = g; p.b = b;
  }

  return {
    burst(pos, color, count, speed, up) {
      const c = new THREE.Color(color);
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.4 + Math.random() * 0.6);
        spawn(pos.x, pos.y, pos.z, Math.cos(a) * s, (up || 2) * Math.random(), Math.sin(a) * s, 0.4 + Math.random() * 0.5, c.r, c.g, c.b);
      }
    },
    smoke(pos, count) {
      for (let i = 0; i < count; i += 1) {
        spawn(pos.x + (Math.random() - 0.5), pos.y + Math.random() * 0.5, pos.z + (Math.random() - 0.5),
          (Math.random() - 0.5) * 0.6, 0.8 + Math.random(), (Math.random() - 0.5) * 0.6,
          0.9 + Math.random() * 0.8, 0.55, 0.55, 0.55);
      }
    },
    muzzle(pos, dir) {
      const c = new THREE.Color(0xffc94c);
      for (let i = 0; i < 6; i += 1) {
        spawn(pos.x, pos.y, pos.z, dir.x * 14 + (Math.random() - 0.5) * 3, dir.y * 14 + 1, dir.z * 14 + (Math.random() - 0.5) * 3, 0.12, c.r, c.g, c.b);
      }
    },
    skid(x, z, heading) {
      const s = skids[skidCursor];
      skidCursor = (skidCursor + 1) % skids.length;
      s.mesh.position.set(x, 0.02, z);
      s.mesh.rotation.z = -heading;
      s.mesh.visible = true;
      s.life = 6;
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        const p = parts[i];
        if (!p.alive) { positions[i * 3 + 1] = -100; continue; }
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; positions[i * 3 + 1] = -100; continue; }
        p.vy -= 6 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
        const fade = p.life / p.max;
        colors[i * 3] = p.r * fade; colors[i * 3 + 1] = p.g * fade; colors[i * 3 + 2] = p.b * fade;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      for (const s of skids) {
        if (!s.mesh.visible) continue;
        s.life -= dt;
        if (s.life <= 0) s.mesh.visible = false;
        else s.mesh.material.opacity = 0.55 * Math.min(1, s.life / 2);
      }
    },
  };
}
