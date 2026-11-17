// player.js — Reyes, the driver you play: walking and running on foot, aiming
// with the mouse, stealing and driving cars (locked ones take a noisy
// moment to break into), health, weapons and cash.

import { PLAYER, CAR, ZOOM } from './config.js';
import { keys, pressed, moveAxis, mouse } from './input.js';
import { collideBuildings } from './city.js';
import { driveCar, carSpeed } from './vehicles.js';
import { drawFigure } from './pedestrians.js';
import { makePed, scarePeds } from './pedestrians.js';
import { sfx } from './audio.js';
import { floater } from './effects.js';

export function makePlayer(x, y) {
  return {
    kind: 'player', x, y, angle: -Math.PI / 2, hp: PLAYER.maxHealth,
    car: null, phase: 0, lastHurt: -99, breakIn: 0, breakCar: null,
    weapons: {
      fist: { name: 'Fists', damage: 12, rate: 0.34, range: 30, auto: false },
      pistol: { name: 'Pistola 9mm', damage: 16, rate: 0.24, range: 560, auto: false, ammo: 120, spread: 0.03 },
      smg: { name: 'Micro SMG', damage: 11, rate: 0.085, range: 520, auto: true, ammo: 0, spread: 0.075, locked: true },
    },
    weapon: 'pistol',
    fireCd: 0, reloadCd: 0,
  };
}

export function playerPos(G) {
  const p = G.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  p.fireCd -= dt; p.reloadCd -= dt;
  if (p.car) updateDriving(G, dt);
  else updateOnFoot(G, dt);
  // slow health regen once out of danger
  if (G.time - p.lastHurt > 6 && p.hp > 0 && p.hp < PLAYER.maxHealth) {
    p.hp = Math.min(PLAYER.maxHealth, p.hp + 3.2 * dt);
  }
}

function updateOnFoot(G, dt) {
  const p = G.player;
  // breaking into a locked car: hold position and keep E held
  if (p.breakIn > 0) {
    if (!keys.KeyE || !p.breakCar || Math.hypot(p.breakCar.x - p.x, p.breakCar.y - p.y) > 52) {
      p.breakIn = 0; p.breakCar = null;
    } else {
      p.breakIn -= dt;
      if (Math.random() < dt * 6) scarePeds(G, p.x, p.y, 90);
      if (p.breakIn <= 0) { const car = p.breakCar; p.breakCar = null; enterCar(G, car); }
      return;
    }
  }
  const ax = moveAxis();
  const run = keys.ShiftLeft || keys.ShiftRight;
  const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (ax.x || ax.y) {
    const d = Math.hypot(ax.x, ax.y);
    p.x += (ax.x / d) * speed * dt;
    p.y += (ax.y / d) * speed * dt;
    p.phase += dt * (run ? 12 : 8.5);
    if (!mouse.down) p.angle = Math.atan2(ax.y, ax.x);
  }
  // aim with the mouse while the button is held
  if (mouse.down || p.fireCd > -0.4) {
    const cam = G.camera;
    const wx = cam.x + mouse.x / ZOOM, wy = cam.y + mouse.y / ZOOM;
    if (Math.hypot(wx - p.x, wy - p.y) > 14) p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  collideBuildings(p, PLAYER.radius);
  // enter a car
  if (pressed.KeyE) {
    const car = nearestCar(G, p.x, p.y, 52);
    if (car && !car.wrecked) tryEnterCar(G, car);
  }
  // weapon switching
  if (pressed.Digit1) p.weapon = 'fist';
  if (pressed.Digit2) p.weapon = 'pistol';
  if (pressed.Digit3 && !p.weapons.smg.locked) p.weapon = 'smg';
  if (pressed.KeyR) startReload(G);
}

function startReload(G) {
  const p = G.player;
  const w = p.weapons[p.weapon];
  if (w.ammo === undefined || p.reloadCd > 0) return;
  p.reloadCd = 0.9;
  sfx.dryFire();
}

export function nearestCar(G, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}

function tryEnterCar(G, car) {
  const p = G.player;
  if (car.locked && car.driver !== 'traffic') {
    p.breakIn = 1.15; p.breakCar = car;
    floater(G, p.x, p.y - 22, 'Breaking in…', '#ffd60a');
    return;
  }
  enterCar(G, car);
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic') {
    // yank the driver out: they run off screaming, and it is a crime
    const ped = makePed(G.rng, car.x + 20, car.y + 10);
    ped.state = 'flee'; ped.fleeT = 3; ped.threat = { x: p.x, y: p.y };
    G.peds.push(ped);
    car.driver = null;
    if (G.onCrime) G.onCrime(1, car.x, car.y);
    floater(G, p.x, p.y - 24, 'Stolen!', '#ff9f43');
  } else if (car.locked) {
    car.locked = false;
    if (G.onCrime) G.onCrime(1, car.x, car.y);
  }
  if (car.police && G.onCrime) G.onCrime(3, car.x, car.y);
  car.driver = 'player';
  p.car = car;
  G.stats.stolen += car.wasPlayerCar ? 0 : 1;
  car.wasPlayerCar = true;
  sfx.door();
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  const input = {
    throttle: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
    steer: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
    handbrake: !!keys.Space,
  };
  driveCar(car, input, dt, G);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (pressed.KeyE && Math.abs(carSpeed(car)) < 26) {
    car.driver = null;
    p.car = null;
    // step out beside the car
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    collideBuildings(p, PLAYER.radius);
    sfx.door();
  }
  if (car.wrecked) {
    p.car = null; car.driver = null;
    p.hp -= 8; p.lastHurt = G.time;
    floater(G, p.x, p.y - 26, 'Wrecked!', '#ff6b6b');
  }
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.car) amount *= 0.45; // the car soaks most of it
  p.hp -= amount;
  p.lastHurt = G.time;
  G.camera.shake = Math.min(8, G.camera.shake + amount * 0.22);
}

export function drawPlayer(ctx, G, camX, camY) {
  const p = G.player;
  if (p.car) return; // hidden inside the car; the car is drawn by vehicles.js
  const sx = p.x - camX, sy = p.y - camY;
  const aiming = mouse.down || p.fireCd > -0.3;
  drawFigure(ctx, sx, sy, p.angle, '#0e9594', '#c68863', p.phase, {
    pants: '#26324a', gun: aiming && p.weapon !== 'fist', hat: '#f4a259',
  });
  // break-in progress ring
  if (p.breakIn > 0) {
    ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, sy - 20, 8, -Math.PI / 2, -Math.PI / 2 + (1 - p.breakIn / 1.15) * Math.PI * 2);
    ctx.stroke();
  }
}
