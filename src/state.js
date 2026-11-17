// state.js — the one mutable game-state object every module reads and writes.
// main.js creates the contents at boot; keeping it in one place means every
// system (traffic, police, missions, HUD) sees the same world.

export const G = {
  mode: 'title',          // title | playing | paused | busted | wasted | complete
  time: 0,                // seconds since boot
  dayT: 0.34,             // time of day 0..1 (0.34 = golden morning)
  seed: 1,
  rng: null,
  city: null,             // built by city.js: roads, buildings, props, zones
  player: null,           // built by player.js
  cars: [],               // every vehicle in the world (traffic, parked, police, player's)
  peds: [],
  cops: [],               // police units (foot officers linked to police cars)
  bullets: [],
  particles: [],
  skids: [],
  floaters: [],           // floating text popups (+$250, BUSTED risk, ...)
  camera: { x: 0, y: 0, shake: 0 },
  wanted: 0,              // 0..5 stars
  heat: 0,                // unseen timer that decays the wanted level
  seenByPolice: false,
  bustedMeter: 0,
  cash: 0,
  missionIndex: 0,        // next story mission
  mission: null,          // active mission runtime object
  courier: null,          // active repeatable courier job
  postcards: [],          // collected postcard flags
  stats: { stolen: 0, missionsDone: 0, busted: 0, wasted: 0 },
  message: null,          // centre-screen banner {text, sub, t}
  objective: null,        // current objective line for the HUD
  marker: null,           // world marker {x, y, color, label}
  muted: false,
  shot: null,             // screenshot scene name when ?shot= is present
};
