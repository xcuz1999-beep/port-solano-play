// save.js — persistence in localStorage: cash, story progress, the SMG
// unlock, postcards found and lifetime stats survive a closed tab.

import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash,
      missionIndex: G.missionIndex,
      smg: !G.player.weapons.smg.locked,
      smgAmmo: G.player.weapons.smg.ammo,
      pistolAmmo: G.player.weapons.pistol.ammo,
      postcards: G.postcards,
      stats: G.stats,
      x: G.player.car ? G.player.car.x : G.player.x,
      y: G.player.car ? G.player.car.y : G.player.y,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode */ }
}

export function applySave(G, data) {
  G.cash = data.cash || 0;
  G.missionIndex = data.missionIndex || 0;
  if (data.smg) {
    G.player.weapons.smg.locked = false;
    G.player.weapons.smg.ammo = data.smgAmmo ?? 160;
  }
  if (typeof data.pistolAmmo === 'number') G.player.weapons.pistol.ammo = data.pistolAmmo;
  G.postcards = Array.isArray(data.postcards) ? data.postcards : [];
  if (data.stats) G.stats = data.stats;
  if (typeof data.x === 'number') { G.player.x = data.x; G.player.y = data.y; }
}
