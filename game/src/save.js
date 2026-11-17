// Solmar City — save: cash, owned cars, weapons, missions completed,
// packages found and best race times in localStorage (solmar.save.v1).

import { SAVE_KEY } from './config.js';

export function createSave(G) {
  return {
    read(G2) {
      try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    write(G2) {
      try {
        const data = {
          cash: G2.cash,
          ownedCars: G2.ownedCars ?? ['alba'],
          weapons: Object.keys(G2.player.ammo ?? {}),
          missionsDone: G2.missions.done,
          missionIndex: G2.missions.index,
          packages: G2.missions.packages,
          bestTimes: G2.bestTimes ?? {},
        };
        window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      } catch {
        // Storage can be off: the session still plays, it just does not persist.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(SAVE_KEY);
      } catch {
        // Ignore.
      }
    },
  };
}
