// Save / load through localStorage: cash, owned cars, weapons, missions, packages,
// race times, best wanted survived. One key, one JSON blob, guarded against failure.
import { SAVE_KEY } from './config.js';

export function defaultSave() {
  return {
    cash: 500, ownedCars: ['meridian'], weapons: ['fists', 'pistol'],
    missionsDone: [], packages: [], bestRace: {}, bestWanted: 0,
    totalEarned: 0, playSeconds: 0,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
