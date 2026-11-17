// Solmar City — HUD: the DOM overlay (wanted stars, cash, clock, health and
// armour bars, speed, car name, ammo, mission banner, ticker) and the live
// minimap canvas (roads, player arrow, mission marker, police, shops).
import { ROADS } from './config.js';

export function createHud(G) {
  const $ = (id) => document.getElementById(id);
  G.hudEls = {
    stars: $('wanted'),
    cash: $('cash'),
    clock: $('clock'),
    health: $('health-fill'),
    healthText: $('health-text'),
    armour: $('armour-fill'),
    speed: $('speed'),
    carName: $('car-name'),
    ammo: $('ammo'),
    objective: $('objective'),
    banner: $('banner'),
    ticker: $('ticker'),
    minimap: $('minimap'),
    crosshair: $('crosshair'),
    vignette: $('vignette'),
    flash: $('flash'),
  };
  G.hudFlashTimer = 0;
}

export function flash(G, text) {
  const el = G.hudEls.banner;
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  G.hudFlashTimer = 3.5;
}

export function setObjective(G, text) {
  const el = G.hudEls.objective;
  if (el) el.textContent = text ?? '';
}

export function tick(G, text) {
  const el = G.hudEls.ticker;
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = text;
  el.prepend(line);
  while (el.children.length > 4) el.removeChild(el.lastChild);
}

export function updateHud(G, dt) {
  const el = G.hudEls;
  const p = G.player;
  // Wanted stars.
  el.stars.textContent = '\u2605'.repeat(G.wanted) + '\u2606'.repeat(5 - G.wanted);
  el.stars.classList.toggle('hot', G.wanted >= 3);
  el.cash.textContent = `$${G.cash.toLocaleString('en-US')}`;
  const mins = Math.floor(G.time / 60) % 60;
  const hrs = (15 + Math.floor(G.time / 3600)) % 24;
  el.clock.textContent = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  el.health.style.width = `${Math.max(0, p.health)}%`;
  el.healthText.textContent = `${Math.ceil(p.health)} HP`;
  el.armour.style.width = `${Math.max(0, p.armour)}%`;
  if (p.car) {
    el.speed.textContent = `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h`;
    el.carName.textContent = p.car.def.name;
  } else {
    el.speed.textContent = p.moving ? `${Math.round(6 * 3.6)} km/h` : '0 km/h';
    el.carName.textContent = 'On foot';
  }
  if (p.weapon === 'fists') el.ammo.textContent = 'Fists';
  else {
    const a = p.ammo[p.weapon];
    el.ammo.textContent = a ? `${p.weapon.toUpperCase()} ${a.mag} / ${a.reserve}` : '';
  }
  el.crosshair.style.display = p.car || p.weapon === 'fists' ? 'none' : 'block';
  if (G.hudFlashTimer > 0) {
    G.hudFlashTimer -= dt;
    if (G.hudFlashTimer <= 0) el.banner.classList.remove('show');
  }
  drawMinimap(G);
}

function drawMinimap(G) {
  const canvas = G.hudEls.minimap;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const scale = S / 640;
  const toX = (x) => S / 2 + x * scale;
  const toY = (z) => S / 2 + z * scale;
  ctx.clearRect(0, 0, S, S);
  // Sea + land.
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#7fae6e';
  ctx.fillRect(0, 0, S, toY(300));
  ctx.fillStyle = '#e8c890';
  ctx.fillRect(0, toY(280), S, toY(300) - toY(280));
  // Roads.
  ctx.strokeStyle = '#3a3f47';
  ctx.lineWidth = 4;
  for (const c of ROADS) {
    ctx.beginPath(); ctx.moveTo(toX(-300), toY(c)); ctx.lineTo(toX(300), toY(c)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(c), toY(-300)); ctx.lineTo(toX(c), toY(300)); ctx.stroke();
  }
  // Ring road.
  ctx.strokeRect(toX(-300), toY(-300), 600 * scale, 600 * scale);
  // Shops.
  for (const mk of G.markers ?? []) {
    ctx.fillStyle = mk.kind === 'garage' ? '#17a398' : '#f2c94c';
    ctx.beginPath();
    ctx.arc(toX(mk.x), toY(mk.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker (yellow diamond) + taxi fare.
  const mission = G.missions.active;
  if (mission) {
    const step = mission.steps[G.missions.step];
    if (step && step.pos) {
      ctx.fillStyle = '#f2c94c';
      ctx.save();
      ctx.translate(toX(step.pos[0]), toY(step.pos[1]));
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.restore();
    }
  }
  if (G.missions.taxi) {
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.arc(toX(G.missions.taxi.dest[0]), toY(G.missions.taxi.dest[1]), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police (flashing blue/red).
  const blink = Math.floor(G.time * 4) % 2 === 0;
  for (const car of G.police.cars) {
    ctx.fillStyle = blink ? '#3d7fd9' : '#ff2a1a';
    ctx.beginPath();
    ctx.arc(toX(car.x), toY(car.z), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wanted pulse.
  if (G.wanted > 0) {
    ctx.strokeStyle = `rgba(255, 42, 26, ${0.5 + 0.3 * Math.sin(G.time * 5)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(G.player.x), toY(G.player.z), 14 + G.wanted * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Player arrow (rotates with heading).
  const p = G.player;
  const heading = p.car ? p.car.heading : p.heading;
  ctx.save();
  ctx.translate(toX(p.x), toY(p.z));
  ctx.rotate(-heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North indicator.
  ctx.fillStyle = '#f4efe6';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('N', S - 14, 14);
}
