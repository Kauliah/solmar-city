// HUD: DOM panels + a live minimap canvas. This module never touches the simulation —
// it only reads G and writes the DOM.
import { PALETTE } from './config.js';

function el(id) { return document.getElementById(id); }

export function createHud(G) {
  const minimap = el('minimap');
  const mctx = minimap.getContext('2d');
  let bannerTimer = null;
  let hitTimer = null;

  function drawMinimap() {
    const S = 168;
    const scale = S / 620;
    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(20, 28, 38, 0.85)';
    mctx.fillRect(0, 0, S, S);
    // Sea + beach along the south edge.
    mctx.fillStyle = '#2e86ab';
    mctx.fillRect(0, S - 16, S, 16);
    mctx.fillStyle = '#e8c890';
    mctx.fillRect(0, S - 24, S, 8);
    // Roads.
    mctx.strokeStyle = '#8b93a3';
    mctx.lineWidth = 3;
    for (const r of G.roads) {
      const [x0, y0] = toMap(r.x0, r.z0);
      const [x1, y1] = toMap(r.x1, r.z1);
      mctx.beginPath(); mctx.moveTo(x0, y0); mctx.lineTo(x1, y1); mctx.stroke();
    }
    // Shops / garage markers.
    const dot = (pos, color, size) => {
      const [x, y] = toMap(pos.x, pos.z);
      mctx.fillStyle = color;
      mctx.fillRect(x - size / 2, y - size / 2, size, size);
    };
    dot(G.landmarks.garage, '#3ad86b', 7);
    dot(G.landmarks.hardware, '#f2c94c', 7);
    dot(G.landmarks.dealership, '#f2c94c', 7);
    // Mission marker (pulsing yellow).
    if (G.missions.targetPos) {
      const pulse = 6 + Math.sin(G.time * 5) * 2;
      const [x, y] = toMap(G.missions.targetPos.x, G.missions.targetPos.z);
      mctx.fillStyle = '#f2c94c';
      mctx.beginPath(); mctx.arc(x, y, pulse, 0, Math.PI * 2); mctx.fill();
      mctx.fillStyle = '#1a1a1a';
      mctx.font = 'bold 10px system-ui';
      mctx.textAlign = 'center';
      mctx.fillText('!', x, y + 3.5);
    }
    // Police (flashing blue/red).
    const flash = Math.floor(G.time * 4) % 2 === 0;
    for (const c of G.police.cars) {
      const [x, y] = toMap(c.mesh.position.x, c.mesh.position.z);
      mctx.fillStyle = flash ? '#ff2e2e' : '#2e6bff';
      mctx.beginPath(); mctx.arc(x, y, 4, 0, Math.PI * 2); mctx.fill();
    }
    // Player arrow.
    const p = G.player;
    const pos = p.inCar ? p.inCar.mesh.position : p.mesh.position;
    const heading = p.inCar ? p.inCar.heading : p.heading;
    const [px, py] = toMap(pos.x, pos.z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.PI - heading);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath(); mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill();
    mctx.restore();
    // North indicator.
    mctx.fillStyle = '#ffffff';
    mctx.font = 'bold 11px system-ui';
    mctx.textAlign = 'left';
    mctx.fillText('N', 6, 14);
  }

  const hud = {
    setStars(n) {
      const s = el('stars');
      s.innerHTML = '';
      for (let i = 0; i < 5; i += 1) {
        const star = document.createElement('span');
        star.textContent = '★';
        star.style.color = i < n ? PALETTE.accentCoral === undefined ? '#ffd94c' : '#ffd94c' : 'rgba(255,255,255,0.35)';
        s.appendChild(star);
      }
    },
    setCash(cash) { el('cash').textContent = `$${Math.floor(cash).toLocaleString('en-US')}`; },
    setClock() {
      const total = 17 * 60 + 20 + Math.floor(G.time / 2);
      const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
      const mm = String(total % 60).padStart(2, '0');
      el('clock').textContent = `${hh}:${mm}`;
    },
    setHealth(h, armor) {
      el('health-fill').style.width = `${Math.max(0, h)}%`;
      el('armor-fill').style.width = `${Math.max(0, armor)}%`;
      el('health-num').textContent = `${Math.ceil(h)}`;
    },
    setSpeed(kmh, carName) {
      el('speed').textContent = `${Math.round(kmh)}`;
      el('carname').textContent = carName || '';
    },
    setCar(name) {
      el('carname').textContent = name || '';
      el('speed-box').style.display = name ? 'block' : 'none';
    },
    setAmmo(mag, reserve, name) {
      el('ammo').textContent = name === 'Fists' ? 'FISTS' : `${mag} / ${reserve}`;
      el('weapon').textContent = name;
    },
    setObjective(text) { el('objective').textContent = text; },
    setTimer(seconds) {
      const t = el('timer');
      if (seconds > 0) { t.style.display = 'block'; t.textContent = `⏱ ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
      else t.style.display = 'none';
    },
    setHotwire(frac) {
      const h = el('hotwire');
      if (frac > 0) {
        h.style.display = 'block';
        h.textContent = `Hotwiring… ${Math.round(frac * 100)}%`;
      } else h.style.display = 'none';
    },
    banner(text, color) {
      const b = el('banner');
      b.textContent = text;
      b.style.color = color || '#f4f0e6';
      b.style.opacity = '1';
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { b.style.opacity = '0'; }, 3200);
    },
    feed(text) {
      const f = el('feed');
      const line = document.createElement('div');
      line.textContent = text;
      f.prepend(line);
      while (f.children.length > 4) f.removeChild(f.lastChild);
      setTimeout(() => { if (line.parentNode) line.remove(); }, 9000);
    },
    hitmarker() {
      const h = el('hitmarker');
      h.style.opacity = '1';
      if (hitTimer) clearTimeout(hitTimer);
      hitTimer = setTimeout(() => { h.style.opacity = '0'; }, 180);
    },
    flashDamage() {
      const v = el('vignette');
      v.style.opacity = '0.75';
      setTimeout(() => { v.style.opacity = '0'; }, 220);
    },
    showTitle(canContinue, stats) {
      el('title-screen').style.display = 'flex';
      el('pause-screen').style.display = 'none';
      el('end-screen').style.display = 'none';
      el('continue-btn').style.display = canContinue ? 'block' : 'none';
      el('title-stats').textContent = stats || '';
    },
    showPause() {
      el('title-screen').style.display = 'none';
      el('pause-screen').style.display = 'flex';
      el('end-screen').style.display = 'none';
    },
    showEnd(title, text) {
      el('end-title').textContent = title;
      el('end-text').textContent = text;
      el('title-screen').style.display = 'none';
      el('pause-screen').style.display = 'none';
      el('end-screen').style.display = 'flex';
    },
    hideOverlays() {
      el('title-screen').style.display = 'none';
      el('pause-screen').style.display = 'none';
      el('end-screen').style.display = 'none';
    },
    update() {
      const p = G.player;
      this.setHealth(p.health, p.armor);
      this.setCash(p.cash);
      this.setClock();
      if (p.inCar) this.setSpeed(Math.abs(p.inCar.speed) * 3.6, p.inCar.def.name);
      else this.setSpeed(0, null);
      const w = p.weapon === 'fists' ? { name: 'Fists' } : null;
      const weaponName = { fists: 'Fists', pistol: 'P-9 Sparrow', smg: 'Hornet-9', shotgun: 'Boomstick' }[p.weapon];
      this.setAmmo(p.ammo.mag, p.ammo.reserve, weaponName);
      drawMinimap();
      // Low health pulse.
      el('vignette').style.opacity = p.health < 30 ? String(0.25 + Math.sin(G.time * 6) * 0.1) : '';
    },
  };
  return hud;
}
