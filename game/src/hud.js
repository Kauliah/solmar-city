// HUD: DOM readouts (wanted stars, cash, clock, health/armour, speed, objective,
// ammo, feed ticker, banners) plus a live top-down minimap canvas. This module
// never touches the simulation — it only reads G and writes the DOM.
import { ROAD_AXES, POIS, WEAPONS } from './config.js';

const STAR_ON = '★';
const STAR_OFF = '☆';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'), wanted: $('wanted'), cash: $('cash'), clock: $('clock'),
    healthFill: $('health-fill'), armourFill: $('armour-fill'),
    healthText: $('health-text'), speed: $('speed'), carName: $('car-name'),
    objective: $('objective'), objectiveDist: $('objective-dist'),
    ammo: $('ammo'), feed: $('feed'), banner: $('banner'), bannerTitle: $('banner-title'),
    bannerText: $('banner-text'), toast: $('toast'), vignette: $('vignette'),
    hitmarker: $('hitmarker'), minimap: $('minimap'), crosshair: $('crosshair'),
    speedWrap: $('speed-wrap'),
  };
  const ctx = el.minimap.getContext('2d');
  let bannerTimer = 0;
  let toastTimer = 0;
  let hitTimer = 0;
  let vignetteTimer = 0;
  const onceSeen = new Set();
  const feedLines = [];

  function drawMinimap() {
    const w = el.minimap.width;
    const h = el.minimap.height;
    const scale = w / 620;
    const px = (x) => (x + 310) * scale;
    const pz = (z) => (z + 310) * scale;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1d2a33';
    ctx.fillRect(0, 0, w, h);
    // Land.
    ctx.fillStyle = '#3d5a3a';
    ctx.fillRect(0, 0, w, pz(268));
    // Beach + sea.
    ctx.fillStyle = '#e8c890';
    ctx.fillRect(0, pz(268), w, pz(296) - pz(268));
    ctx.fillStyle = '#2e86ab';
    ctx.fillRect(0, pz(296), w, h - pz(296));
    // Roads.
    ctx.strokeStyle = '#3a3f47';
    ctx.lineWidth = 11 * scale;
    for (const a of ROAD_AXES) {
      ctx.beginPath(); ctx.moveTo(px(a), 0); ctx.lineTo(px(a), h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, pz(a)); ctx.lineTo(w, pz(a)); ctx.stroke();
    }
    ctx.strokeStyle = '#3a3f47';
    ctx.strokeRect(px(-280), pz(-280), 560 * scale, 560 * scale);
    // Plaza.
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(px(-12), pz(-12), 24 * scale, 24 * scale);
    // POIs: garage (green), hospital (white), shops (gold).
    function dot(x, z, color, size = 4) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(x), pz(z), size, 0, Math.PI * 2);
      ctx.fill();
    }
    dot(POIS.garage.x, POIS.garage.z, '#4ade80');
    dot(POIS.hospital.x, POIS.hospital.z, '#ffffff');
    dot(POIS.motors.x, POIS.motors.z, '#f2c94c');
    dot(POIS.hardware.x, POIS.hardware.z, '#f2c94c');
    // Mission marker (yellow diamond, pulsing).
    const m = G.missions?.marker;
    if (m) {
      const pulse = 5 + Math.sin(G.time * 5) * 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(px(m.x), pz(m.z) - pulse);
      ctx.lineTo(px(m.x) + pulse, pz(m.z));
      ctx.lineTo(px(m.x), pz(m.z) + pulse);
      ctx.lineTo(px(m.x) - pulse, pz(m.z));
      ctx.closePath();
      ctx.fill();
    }
    // Police (flashing blue/red).
    const flash = Math.sin(G.time * 8) > 0;
    for (const cop of G.police.cars) {
      dot(cop.x, cop.z, flash ? '#2f6fd8' : '#e5534b', 3.5);
    }
    // Player arrow.
    const p = G.player;
    ctx.save();
    ctx.translate(px(p.x), pz(p.z));
    ctx.rotate(Math.atan2(Math.sin(p.heading), -Math.cos(p.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // North indicator.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('N', w - 12, 14);
  }

  return {
    el,
    update(dt) {
      const p = G.player;
      const wanted = G.police.wanted;
      el.wanted.textContent = STAR_ON.repeat(wanted) + STAR_OFF.repeat(5 - wanted);
      el.wanted.classList.toggle('hot', wanted >= 3);
      el.cash.textContent = `$${Math.floor(p.cash)}`;
      const mins = Math.floor(G.clockMinutes) % 1440;
      const hh = String(Math.floor(mins / 60)).padStart(2, '0');
      const mm = String(mins % 60).padStart(2, '0');
      el.clock.textContent = `${hh}:${mm}`;
      el.healthFill.style.width = `${Math.max(0, p.health)}%`;
      el.healthFill.classList.toggle('low', p.health < 30);
      el.armourFill.style.width = `${Math.max(0, p.armour)}%`;
      el.healthText.textContent = `${Math.ceil(p.health)} HP${p.armour > 0 ? ` + ${Math.ceil(p.armour)} armour` : ''}`;
      if (p.car) {
        el.speedWrap.style.display = 'block';
        el.speed.textContent = `${Math.round(Math.abs(p.car.speed) * 3.6)}`;
        el.carName.textContent = p.car.def.name;
      } else {
        el.speedWrap.style.display = 'none';
      }
      const ms = G.missions;
      el.objective.textContent = ms?.objective ?? '';
      el.objectiveDist.textContent = ms?.objectiveDist != null ? `${Math.round(ms.objectiveDist)} m` : '';
      const def = WEAPONS[p.weapon];
      if (p.weapon === 'fist') {
        el.ammo.textContent = 'FISTS';
      } else {
        const a = p.ammo[p.weapon];
        el.ammo.textContent = `${def.name.toUpperCase()}  ${a.mag} / ${a.reserve}`;
      }
      el.crosshair.style.display = p.car ? 'none' : 'block';
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) el.banner.classList.remove('on');
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) el.toast.classList.remove('on');
      }
      if (hitTimer > 0) {
        hitTimer -= dt;
        if (hitTimer <= 0) el.hitmarker.classList.remove('on');
      }
      if (vignetteTimer > 0) {
        vignetteTimer -= dt;
        el.vignette.style.opacity = String(Math.max(0, vignetteTimer / 0.5) * 0.55);
        if (vignetteTimer <= 0) el.vignette.style.opacity = '0';
      }
      drawMinimap();
    },
    banner(title, text) {
      el.bannerTitle.textContent = title;
      el.bannerText.textContent = text ?? '';
      el.banner.classList.add('on');
      bannerTimer = 4;
    },
    toast(text) {
      el.toast.textContent = text;
      el.toast.classList.add('on');
      toastTimer = 3.5;
    },
    toastOnce(key, text) {
      if (onceSeen.has(key)) return;
      onceSeen.add(key);
      this.toast(text);
    },
    feed(text) {
      feedLines.unshift(text);
      if (feedLines.length > 4) feedLines.pop();
      el.feed.innerHTML = feedLines.map((l) => `<div>${l}</div>`).join('');
    },
    hitmarker() {
      el.hitmarker.classList.add('on');
      hitTimer = 0.25;
    },
    damageFlash() {
      vignetteTimer = 0.5;
    },
    flashWanted() {
      el.wanted.classList.add('flash');
      setTimeout(() => el.wanted.classList.remove('flash'), 400);
    },
  };
}
