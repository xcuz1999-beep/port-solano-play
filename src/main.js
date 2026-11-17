// main.js — boots Port Solano and runs it: builds the city, spawns its
// people and cars, steps every system each frame (player, traffic,
// pedestrians, police, combat, missions, effects), follows with the camera,
// and draws the world, the HUD and the screens. Also wires the crimes the
// other modules report into the wanted system, saving, zone interactions
// (Alba's jobs, ammo at the Armería, rest at Casa Reyes) and respawns.

import { WORLD, DAY_LENGTH, ZOOM } from './config.js';
import { G } from './state.js';
import { makeRng } from './random.js';
import { buildCity, drawGround, drawBuildings, collideBuildings } from './city.js';
import { initInput, keys, pressed, mouse, endFrameInput } from './input.js';
import { initAudio, updateAudio, sfx } from './audio.js';
import { makePlayer, updatePlayer, drawPlayer, playerPos, nearestCar } from './player.js';
import { spawnTraffic, spawnParked, updateTraffic } from './traffic.js';
import { spawnPeds, updatePeds, drawPed, scarePeds } from './pedestrians.js';
import { updatePolice, drawCops, reportCrime, anyCopNear } from './police.js';
import { updatePlayerCombat, updateBullets, drawBullets, hurtPed } from './combat.js';
import { updateMissions, startStoryMission, startCourier, failMission, STORY } from './missions.js';
import { updateEffects, drawEffects, burst, floater } from './effects.js';
import { drawCar } from './vehicles.js';
import { drawHUD, drawMarker, drawMarkerArrow, drawTitle, drawHelp, drawPause, drawEndScreen } from './hud.js';
import { saveGame, loadGame, clearSave, applySave } from './save.js';
import { setupShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const menuBoxes = [];
let prevMode = 'title'; // where "back" from help returns to

function resize() {
  canvas.width = Math.min(1600, innerWidth);
  canvas.height = Math.min(1000, innerHeight);
}
addEventListener('resize', resize);
resize();
initInput(canvas);
addEventListener('pointerdown', initAudio, { once: true });
addEventListener('keydown', initAudio, { once: true });

// ---- world setup ---------------------------------------------------------

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
G.seed = seed;
G.rng = makeRng(seed * 7919 + 13);
G.city = buildCity(G.rng);
collideBuildings.city = G.city;
const safe = G.city.zones.safehouse;
G.player = makePlayer(safe.x + 30, safe.y + 46);
spawnParked(G, 30);
spawnTraffic(G, 15);
spawnPeds(G, 26);
G.camera.x = G.player.x - canvas.width / 2;
G.camera.y = G.player.y - canvas.height / 2;

G.onCrime = (level, x, y) => {
  // crimes count when someone is around to report them; deep in an empty
  // street at night, a quiet theft may go unseen
  const witnessed = anyCopNear(G, x, y, 9999) || G.cops.length > 0 || G.peds.some(p => p.state !== 'dead' && Math.hypot(p.x - x, p.y - y) < 190);
  if (witnessed || level >= 3) reportCrime(G, level);
  else G.heat = Math.min(G.heat, 4); // a head start on laying low
};
G.onPlayerCrash = (other, rel) => {
  if (rel > 150) G.onCrime(1, other.x, other.y);
};
G.onBusted = () => {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  G.stats.busted += 1;
  failMission(G, 'You got busted.');
  sfx.fail();
};
G.onSave = () => saveGame(G);

const shotName = params.get('shot');
if (shotName) { G.shot = shotName; setupShot(G, shotName); }
window.__PORT_SOLANO__ = G;

// ---- run control ---------------------------------------------------------

function resetRun() {
  clearSave();
  G.cash = 0; G.missionIndex = 0; G.wanted = 0; G.heat = 0; G.bustedMeter = 0;
  G.mission = null; G.courier = null; G.cops = []; G.bullets = [];
  G.postcards = [];
  G.stats = { stolen: 0, missionsDone: 0, busted: 0, wasted: 0 };
  const p = makePlayer(safe.x + 30, safe.y + 46);
  G.player = p;
  G.mode = 'playing';
  G.message = { text: 'Port Solano', sub: 'Alba Ferrer has work for you — follow the gold marker to her Chop Shop.', t: 5 };
}

function respawn() {
  const h = G.city.zones.hospital;
  const fine = G.mode === 'busted' ? 150 : 120;
  G.cash = Math.max(0, G.cash - fine);
  if (G.player.car) { G.player.car.driver = null; G.player.car = null; }
  G.player.x = h.x + 24; G.player.y = h.y + 40;
  G.player.hp = 100;
  G.wanted = 0; G.heat = 0; G.bustedMeter = 0;
  G.cops = []; G.bullets = [];
  G.mode = 'playing';
}

function menuAction(action) {
  sfx.click();
  if (action === 'new') resetRun();
  else if (action === 'continue') {
    const data = loadGame();
    if (data) applySave(G, data);
    G.mode = 'playing';
  } else if (action === 'help') { prevMode = G.mode; G.mode = 'help'; }
  else if (action === 'back') G.mode = prevMode === 'help' ? 'title' : prevMode;
  else if (action === 'mute') G.muted = !G.muted;
  else if (action === 'resume') G.mode = 'playing';
  else if (action === 'save') { saveGame(G); floater(G, G.player.x, G.player.y - 30, 'Saved', '#9be15d'); G.mode = 'playing'; }
  else if (action === 'title') G.mode = 'title';
  else if (action === 'respawn') respawn();
}

// ---- per-frame update ----------------------------------------------------

function update(dt) {
  G.time += dt;
  if (G.message) { G.message.t -= dt; if (G.message.t <= 0) G.message = null; }
  if (G.mode === 'title' || G.mode === 'help') {
    // the city lives behind the menus: slow pan, ambient traffic and people
    G.camera.x += dt * 14;
    if (G.camera.x > WORLD - canvas.width / ZOOM) G.camera.x = 0;
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updateEffects(G, dt);
    return;
  }
  if (G.mode !== 'playing') return;
  G.dayT = (G.dayT + dt / DAY_LENGTH) % 1;
  updatePlayer(G, dt);
  updatePlayerCombat(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateBullets(G, dt);
  updateMissions(G, dt);
  updateEffects(G, dt);
  runOverCheck(G, dt);
  zoneInteractions(G);
  postcardCheck(G);
  // camera: smooth follow with a velocity lookahead while driving
  const pp = playerPos(G);
  const vw = canvas.width / ZOOM, vh = canvas.height / ZOOM;
  let tx = pp.x - vw / 2, ty = pp.y - vh / 2;
  if (G.player.car) { tx += G.player.car.vx * 0.34; ty += G.player.car.vy * 0.34; }
  if (G.camBias) { tx += G.camBias.x; ty += G.camBias.y; }
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 5);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 5);
  G.camera.x = Math.max(0, Math.min(WORLD - vw, G.camera.x));
  G.camera.y = Math.max(0, Math.min(WORLD - vh, G.camera.y));
  G.camera.shake = Math.max(0, G.camera.shake - dt * 26);
  // audio beds
  const spd = G.player.car ? Math.abs(G.player.car.speed) / G.player.car.top : 0;
  updateAudio(dt, spd, anyCopNear(G, pp.x, pp.y, 540));
  // death
  if (G.player.hp <= 0) {
    G.mode = 'wasted';
    G.stats.wasted += 1;
    failMission(G, 'You got wasted.');
    burst(G, pp.x, pp.y, 30, '#c0392b', 200, 0.9, 3.5);
    sfx.fail();
  }
  statusEl.textContent = G.objective || 'Exploring Port Solano';
}

// Cars (the player's above all) knock pedestrians down.
function runOverCheck(G, dt) {
  for (const car of G.cars) {
    const sp = Math.hypot(car.vx, car.vy);
    if (sp < 60) continue;
    for (const ped of G.peds) {
      if (ped.state === 'dead' || ped.state === 'down') continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 21) {
        hurtPed(G, ped, sp * 0.22, Math.atan2(car.vy, car.vx));
        burst(G, ped.x, ped.y, 7, '#c0392b', 120, 0.5, 3);
        sfx.hit();
        if (car.driver === 'player') scarePeds(G, ped.x, ped.y, 200);
      }
    }
  }
}

// E at a zone: jobs at Alba's, ammo at the Armería, rest + save at home.
function zoneInteractions(G) {
  if (!pressed.KeyE || G.player.car || G.player.breakIn > 0) return;
  if (nearestCar(G, G.player.x, G.player.y, 52)) return; // the car wins the key
  const p = G.player;
  const z = G.city.zones;
  const near = (zone, d) => Math.hypot(p.x - zone.x, p.y - zone.y) < d;
  if (!G.mission && near(z.garage, 84)) {
    if (G.missionIndex < STORY.length) startStoryMission(G, G.missionIndex);
    else startCourier(G);
  } else if (near(z.gunshop, 74)) {
    const cost = 60;
    const need = G.player.weapons.pistol.ammo < 120 || (!G.player.weapons.smg.locked && G.player.weapons.smg.ammo < 240);
    if (need && G.cash >= cost) {
      G.cash -= cost;
      G.player.weapons.pistol.ammo = 120;
      if (!G.player.weapons.smg.locked) G.player.weapons.smg.ammo = 240;
      floater(G, p.x, p.y - 26, 'Ammo restocked -$60', '#9be15d');
      sfx.cash();
    } else if (need) floater(G, p.x, p.y - 26, 'Ammo costs $60', '#ff6b6b');
    else floater(G, p.x, p.y - 26, 'Ammo full', '#ffffff');
  } else if (near(z.safehouse, 74)) {
    G.player.hp = 100;
    saveGame(G);
    floater(G, p.x, p.y - 26, 'Rested & saved', '#9be15d');
    sfx.pickup();
  }
}

function postcardCheck(G) {
  const pp = playerPos(G);
  G.city.postcards.forEach((spot, i) => {
    if (G.postcards.includes(i)) return;
    if (Math.hypot(pp.x - spot.x, pp.y - spot.y) < 38) {
      G.postcards.push(i);
      G.cash += 25;
      floater(G, pp.x, pp.y - 30, `Postcard: ${spot.name} +$25`, '#4dd0e1');
      sfx.pickup();
      saveGame(G);
    }
  });
}

// ---- drawing -------------------------------------------------------------

function sunTint() {
  const t = G.dayT;
  // t: 0 midnight, 0.25 dawn, 0.5 midday, 0.75 dusk
  if (t < 0.2 || t > 0.82) return { color: 'rgba(12,18,52,0.36)', shadow: 14 };
  if (t < 0.3) return { color: 'rgba(255,130,50,0.13)', shadow: 20 };
  if (t > 0.7) return { color: 'rgba(255,110,45,0.16)', shadow: 22 };
  return { color: 'rgba(255,240,200,0.05)', shadow: 10 };
}

function draw() {
  const w = canvas.width, h = canvas.height;
  const vw = w / ZOOM, vh = h / ZOOM;
  const camX = Math.round(G.camera.x + (G.camera.shake ? (Math.random() - 0.5) * G.camera.shake : 0));
  const camY = Math.round(G.camera.y + (G.camera.shake ? (Math.random() - 0.5) * G.camera.shake : 0));
  const tint = sunTint();
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  drawGround(ctx, G.city, camX, camY, vw, vh);
  drawBuildings(ctx, G.city, camX, camY, vw, vh, tint.shadow * 0.7, tint.shadow);
  // zone signs
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const z of Object.values(G.city.zones)) {
    const sx = z.x - camX, sy = z.y - camY;
    if (sx < -80 || sx > vw + 80 || sy < -40 || sy > vh + 40) continue;
    ctx.fillStyle = z.color;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 4;
    ctx.fillText(z.label, sx, sy - 14);
    ctx.shadowBlur = 0;
  }
  // postcard sparkles
  G.city.postcards.forEach((spot, i) => {
    if (G.postcards.includes(i)) return;
    const sx = spot.x - camX, sy = spot.y - camY;
    if (sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) return;
    ctx.fillStyle = '#4dd0e1';
    ctx.save();
    ctx.translate(sx, sy - 6 + Math.sin(G.time * 3 + i) * 3);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.restore();
  });
  drawEffects(ctx, G, camX, camY);
  for (const car of G.cars) {
    if (car.x < camX - 70 || car.x > camX + vw + 70 || car.y < camY - 70 || car.y > camY + vh + 70) continue;
    drawCar(ctx, car, camX, camY, G.time);
  }
  for (const ped of G.peds) {
    if (ped.x < camX - 40 || ped.x > camX + vw + 40 || ped.y < camY - 40 || ped.y > camY + vh + 40) continue;
    drawPed(ctx, ped, camX, camY);
  }
  drawCops(ctx, G, camX, camY);
  drawPlayer(ctx, G, camX, camY);
  drawBullets(ctx, G, camX, camY);
  drawMarker(ctx, G, camX, camY);
  ctx.restore();
  // day/night tint over the world, under the HUD
  ctx.fillStyle = tint.color;
  ctx.fillRect(0, 0, w, h);
  if (G.mode === 'playing' || G.mode === 'paused') {
    drawHUD(ctx, G, w, h);
    drawMarkerArrow(ctx, G, w, h);
  }
  if (G.mode === 'title') drawTitle(ctx, G, w, h, !!loadGame(), menuBoxes);
  else if (G.mode === 'help') drawHelp(ctx, G, w, h, menuBoxes);
  else if (G.mode === 'paused') drawPause(ctx, G, w, h, menuBoxes);
  else if (G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'complete') drawEndScreen(ctx, G, w, h, menuBoxes);
}

// ---- input for menus -----------------------------------------------------

canvas.addEventListener('mousedown', () => {
  if (G.mode === 'playing') return;
  for (const box of menuBoxes) {
    if (mouse.x >= box.x && mouse.x <= box.x + box.w && mouse.y >= box.y && mouse.y <= box.y + box.h) {
      menuAction(box.action);
      return;
    }
  }
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') G.muted = !G.muted;
  if (G.mode === 'title' && e.code === 'Enter') menuAction(loadGame() ? 'continue' : 'new');
  else if ((G.mode === 'busted' || G.mode === 'wasted' || G.mode === 'complete') && e.code === 'Enter') menuAction('respawn');
  else if (G.mode === 'playing' && (e.code === 'KeyP' || e.code === 'Escape')) G.mode = 'paused';
  else if (G.mode === 'paused' && (e.code === 'KeyP' || e.code === 'Escape')) G.mode = 'playing';
  else if (G.mode === 'help' && e.code === 'Escape') G.mode = prevMode;
});

// ---- the loop --------------------------------------------------------------

let testTick = null;
if (params.get('test')) testTick = runSelfTest(G, { newGame: resetRun });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  endFrameInput();
  requestAnimationFrame(frame);
}
if (testTick) {
  // self-test mode: drive the game on a fixed-step timer (headless browsers
  // fast-forward timers reliably, animation frames less so)
  const iv = setInterval(() => {
    const dt = 1 / 30;
    if (testTick(dt) === false) { testTick = null; clearInterval(iv); }
    update(dt);
    draw();
    endFrameInput();
  }, 1000 / 30);
} else {
  requestAnimationFrame(frame);
}
