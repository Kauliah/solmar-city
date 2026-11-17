// Solmar City — effects: particles (sparks, smoke, muzzle flash, explosion
// bursts), hitscan tracers, hitmarker pop, damage vignette flash, skid marks.

export function createEffects(G) {
  return {
    particles: [],
    tracers: [],
    hitTimer: 0,
    pool: [],
  };
}

function spawnParticle(G, x, y, z, vx, vy, vz, life, size, color) {
  const fx = G.effects;
  let mesh = fx.pool.pop();
  if (!mesh) {
    mesh = new G.THREE.Mesh(
      new G.THREE.BoxGeometry(1, 1, 1),
      new G.THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
  }
  mesh.material.color.setHex(color);
  mesh.position.set(x, y, z);
  mesh.scale.setScalar(size);
  mesh.visible = true;
  G.scene.add(mesh);
  fx.particles.push({ mesh, vx, vy, vz, life, maxLife: life });
}

export function spark(G, x, z) {
  for (let i = 0; i < 10; i += 1) {
    spawnParticle(G, x, 0.8, z, (G.rng() - 0.5) * 10, G.rng() * 6, (G.rng() - 0.5) * 10, 0.4, 0.12, 0xffc94c);
  }
}

export function smoke(G, x, z) {
  spawnParticle(G, x, 1.2, z, (G.rng() - 0.5) * 2, 2.5, (G.rng() - 0.5) * 2, 1.1, 0.5, 0x666666);
}

export function burst(G, x, z) {
  for (let i = 0; i < 16; i += 1) {
    spawnParticle(G, x, 1.2, z, (G.rng() - 0.5) * 8, G.rng() * 5, (G.rng() - 0.5) * 8, 0.7, 0.18, i % 2 ? 0xff6b4a : 0xf2c94c);
  }
}

export function muzzle(G, pos) {
  for (let i = 0; i < 4; i += 1) {
    spawnParticle(G, pos.x, pos.y, pos.z, (G.rng() - 0.5) * 4, (G.rng() - 0.5) * 4, (G.rng() - 0.5) * 4, 0.12, 0.25, 0xffe8a0);
  }
}

export function tracer(G, from, to) {
  const geo = new G.THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new G.THREE.Line(geo, new G.THREE.LineBasicMaterial({ color: 0xffe8a0, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.effects.tracers.push({ line, life: 0.09 });
}

export function hitmarker(G) {
  G.effects.hitTimer = 0.25;
  const el = document.getElementById('hitmarker');
  if (el) {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 200);
  }
}

export function damageFlash(G) {
  const el = document.getElementById('vignette');
  if (el) {
    el.classList.add('hurt');
    setTimeout(() => el.classList.remove('hurt'), 300);
  }
}

export function stepEffects(G, dt) {
  const fx = G.effects;
  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const pt = fx.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      G.scene.remove(pt.mesh);
      pt.mesh.visible = false;
      fx.pool.push(pt.mesh);
      fx.particles.splice(i, 1);
      continue;
    }
    pt.mesh.position.x += pt.vx * dt;
    pt.mesh.position.y += pt.vy * dt;
    pt.mesh.position.z += pt.vz * dt;
    pt.vy -= 6 * dt;
    pt.mesh.scale.setScalar(Math.max(0.01, pt.life / pt.maxLife) * 0.5);
  }
  for (let i = fx.tracers.length - 1; i >= 0; i -= 1) {
    const t = fx.tracers[i];
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose();
      fx.tracers.splice(i, 1);
    }
  }
  if (fx.hitTimer > 0) fx.hitTimer -= dt;
}
