// config.js — every constant that shapes Port Solano: world size, road grid,
// physics, wanted tuning and the colour palette of the city.

export const WORLD = 3480;            // the city is a WORLD x WORLD square
export const ROAD_W = 112;             // road width in world units
export const PITCH = 580;              // distance between road centrelines
export const ROAD_OFF = 290;           // first road centreline offset
export const WATER_Y = 3220;           // the sea starts here (south edge)
export const BEACH_Y = 3060;           // sand between the last street and the sea

export const VIEW_W = 1280;            // reference viewport the HUD is laid out for
export const VIEW_H = 800;
export const ZOOM = 1.3;               // world render scale: bigger, more readable sprites

export const PLAYER = {
  walkSpeed: 168,
  runSpeed: 268,
  radius: 11,
  maxHealth: 100,
};

export const CAR = {
  accel: 340,
  brake: 520,
  reverseMax: 120,
  drag: 0.62,
  grip: 7.5,
  turnRate: 2.35,
  radius: 17,
  length: 44,
  width: 21,
};

export const WANTED = {
  // seconds of staying unseen (or in a fresh car) per star before heat decays
  decayPerStar: 14,
  bustedFillTime: 2.4,     // seconds a cop must stay close on foot to bust you
  sightRange: 460,         // how far police see the player
  loseRange: 620,          // beyond this, unseen timers run
};

export const DAY_LENGTH = 300;         // seconds for a full day/night cycle

export const COLORS = {
  water: '#1d6f8e',
  waterDeep: '#155e7a',
  sand: '#ecd29a',
  grass: '#79b657',
  sidewalk: '#c9c2b4',
  curb: '#a49d8c',
  road: '#3c4148',
  roadLine: '#e8e3c8',
  crosswalk: '#d8d8d8',
  plaza: '#d9c9a3',
  roofA: ['#e2725b', '#d95f43', '#c94f38'],
  roofB: ['#f2e3c6', '#e8d5ae', '#dfc491'],
  roofC: ['#7fb3c8', '#639bb5', '#4f86a3'],
  roofD: ['#e8e8e8', '#d4d4d4', '#bfbfbf'],
  palm: '#3e8e4f',
  palmTrunk: '#8a6b45',
};

export const SAVE_KEY = 'port-solano-save-v1';
