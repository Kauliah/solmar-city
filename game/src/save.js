// Save/load: one localStorage key holds cash, owned cars, weapons, missions,
// packages, race bests and the best wanted level survived.
import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 150,
    ownedCars: ['meridian'],
    weapons: { pistol: false, smg: false, shotgun: false },
    ammo: { pistol: { mag: 12, reserve: 96 }, smg: { mag: 28, reserve: 112 }, shotgun: { mag: 6, reserve: 24 } },
    missionsDone: [],
    packages: [],
    bestRaces: {},
    bestWanted: 0,
    gamesPlayed: 0,
  };
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    const base = defaultSave();
    return { ...base, ...parsed, weapons: { ...base.weapons, ...(parsed.weapons ?? {}) }, ammo: { ...base.ammo, ...(parsed.ammo ?? {}) }, bestRaces: { ...(parsed.bestRaces ?? {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(G) {
  const p = G.player;
  const data = {
    cash: Math.floor(p.cash),
    ownedCars: p.ownedCars ?? ['meridian'],
    weapons: p.owned,
    ammo: p.ammo,
    missionsDone: G.missions.done,
    packages: [...G.missions.packagesFound],
    bestRaces: G.saveData.bestRaces,
    bestWanted: Math.max(G.saveData.bestWanted, G.police.wanted),
    gamesPlayed: (G.saveData.gamesPlayed ?? 0) + 1,
  };
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
  G.saveData = { ...G.saveData, ...data };
}
