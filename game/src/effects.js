// Effects: pooled spark/smoke particles, tracers, muzzle flash, skid marks and
// camera shake. One small pool, no per-frame allocations in the hot loop.
import * as THREE from 'three';

const PARTICLE_COUNT = 90;
const SKID_COUNT = 60;

export function createEffects(G) {
  // Particles: one Points cloud, each particle a vertex with a life.
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
  points.frustumCulled = false;
  G.scene.add(points);
  const parts = [];
  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    parts.push({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 0.8, b: 0.3 });
    positions[i * 3 + 1] = -99;
  }
  // Skid marks: dark quads laid on the road, reused in a ring.
  const skidGeo = new THREE.PlaneGeometry(0.5, 2.4);
  const skidMat = new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.55, depthWrite: false });
  const skids = [];
  for (let i = 0; i < SKID_COUNT; i += 1) {
    const m = new THREE.Mesh(skidGeo, skidMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -1;
    m.visible = false;
    G.scene.add(m);
    skids.push(m);
  }
  let skidIdx = 0;
  let skidTimer = 0;
  // Muzzle flash: a bright sprite that lives one frame.
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.6),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
  );
  flash.visible = false;
  G.scene.add(flash);
  let flashT = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    for (const p of parts) {
      if (p.life > 0) continue;
      p.life = life;
      p.x = x; p.y = y; p.z = z;
      p.vx = vx; p.vy = vy; p.vz = vz;
      p.r = r; p.g = g; p.b = b;
      return;
    }
  }

  return {
    spark(x, y, z) {
      for (let i = 0; i < 8; i += 1) {
        spawn(x, y, z, (Math.random() - 0.5) * 9, Math.random() * 6 + 1, (Math.random() - 0.5) * 9, 0.35 + Math.random() * 0.3, 1, 0.8, 0.3);
      }
    },
    hitSpark(x, y, z) { this.spark(x, y, z); },
    smoke(x, y, z) {
      for (let i = 0; i < 2; i += 1) {
        spawn(x + (Math.random() - 0.5), y + 0.6, z + (Math.random() - 0.5), (Math.random() - 0.5) * 1.2, 1.6, (Math.random() - 0.5) * 1.2, 1.4, 0.32, 0.32, 0.34);
      }
    },
    crash(x, y, z) {
      for (let i = 0; i < 14; i += 1) {
        spawn(x, y + 0.5, z, (Math.random() - 0.5) * 12, Math.random() * 7, (Math.random() - 0.5) * 12, 0.5 + Math.random() * 0.4, 1, 0.65, 0.2);
      }
    },
    tracer(from, to, color = 0xfff2c0) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
      G.scene.add(line);
      G.combat.tracers.push({ line, life: 0.12 });
    },
    muzzle(pos) {
      flash.position.copy(pos);
      flash.lookAt(G.camera.position);
      flash.visible = true;
      flash.material.opacity = 1;
      flashT = 0.05;
    },
    skid(x, z, heading) {
      skidTimer -= 1;
      const m = skids[skidIdx];
      skidIdx = (skidIdx + 1) % SKID_COUNT;
      m.position.set(x, 0.06, z);
      m.rotation.z = -heading;
      m.visible = true;
    },
    shake(amount) {
      G.cameraShake = Math.min(0.6, (G.cameraShake ?? 0) + amount);
    },
    damageFlash() {
      if (G.hud) G.hud.damageFlash();
    },
    update(dt) {
      for (let i = 0; i < PARTICLE_COUNT; i += 1) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 4 * dt;
          if (p.y < 0.05) { p.y = 0.05; p.vy = 0; }
        }
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.life > 0 ? p.y : -99;
        positions[i * 3 + 2] = p.z;
        colors[i * 3] = p.r;
        colors[i * 3 + 1] = p.g;
        colors[i * 3 + 2] = p.b;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      if (flashT > 0) {
        flashT -= dt;
        if (flashT <= 0) flash.visible = false;
      }
      // Skid marks while the player car handbrakes or drifts.
      const car = G.player.car;
      if (car && Math.abs(car.speed) > 12) {
        const d = G.input.drive();
        if (d.brake || Math.abs(car.steer) > 0.4) {
          skidTimer += dt * 60;
          if (skidTimer >= 1) {
            skidTimer = 0;
            this.skid(car.x - Math.sin(car.heading) * 1.6, car.z - Math.cos(car.heading) * 1.6, car.heading);
          }
          if (Math.random() < 0.3) this.smoke(car.x, 0.2, car.z);
        }
      }
      // Smoke from a damaged player car.
      if (car && car.smoke > 0 && Math.random() < 0.4) {
        this.smoke(car.x, 0.8, car.z);
      }
    },
  };
}
