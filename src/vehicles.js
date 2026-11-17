// vehicles.js — the car itself: arcade driving physics (accelerate, brake,
// drift with the handbrake, collisions that cost health and paint), damage,
// and how every car is drawn, from hatchbacks to the black-and-white patrols.

import { CAR } from './config.js';
import { collideBuildings } from './city.js';
import { sfx } from './audio.js';
import { burst } from './effects.js';

export const CAR_MODELS = [
  { name: 'Solano Compact', colors: ['#d94f30', '#e8b13c', '#7fb069', '#5b8e7d'], top: 265, hp: 60 },
  { name: 'Costa Sedan', colors: ['#4a6fa5', '#c0c5ce', '#2e4057', '#8d6e63'], top: 300, hp: 80 },
  { name: 'Vega Pickup', colors: ['#6d597a', '#355070', '#b56576', '#606c38'], top: 285, hp: 110 },
  { name: 'Marina Coupe', colors: ['#ef476f', '#ffd166', '#06d6a0', '#118ab2'], top: 360, hp: 70 },
  { name: 'Palma Van', colors: ['#f4f1de', '#e07a5f', '#81b29a', '#3d405b'], top: 250, hp: 120 },
];

export function makeCar(modelIdx, color, x, y, angle) {
  const m = CAR_MODELS[modelIdx];
  return {
    kind: 'car', model: modelIdx, modelName: m.name, color,
    x, y, angle, vx: 0, vy: 0, speed: 0,
    hp: m.hp, maxHp: m.hp, top: m.top,
    driver: null,        // 'player' | 'traffic' | 'police' | null (parked)
    ai: null,            // traffic/police brain state
    sirenPhase: Math.random() * 6,
    wrecked: false,
  };
}

export function carSpeed(car) { return Math.hypot(car.vx, car.vy); }

// One physics step for a car someone is driving (player or police).
// input: {throttle -1..1, steer -1..1, handbrake bool}
export function driveCar(car, input, dt, G) {
  const fwdX = Math.cos(car.angle), fwdY = Math.sin(car.angle);
  const spd = car.vx * fwdX + car.vy * fwdY; // signed forward speed
  let s = spd;
  if (input.throttle > 0) s += CAR.accel * input.throttle * dt * (1 - Math.max(0, s) / (car.top * 1.25));
  else if (input.throttle < 0) s += (s > 4 ? -CAR.brake : CAR.accel * 0.55 * input.throttle) * dt;
  s -= s * CAR.drag * dt * (input.handbrake ? 2.6 : 1);
  if (!input.throttle) s -= s * 0.55 * dt;
  s = Math.max(-CAR.reverseMax, Math.min(car.top, s));
  // steering bites with speed; drifting loosens the rear
  const steerAuthority = Math.max(-1, Math.min(1, s / 90));
  car.angle += input.steer * CAR.turnRate * steerAuthority * dt * (input.handbrake ? 1.35 : 1);
  const nfx = Math.cos(car.angle), nfy = Math.sin(car.angle);
  const latX = -nfy, latY = nfx;
  const latSpeed = car.vx * latX + car.vy * latY;
  const grip = input.handbrake ? 2.1 : CAR.grip;
  const keptLat = latSpeed * Math.max(0, 1 - grip * dt);
  car.vx = nfx * s + latX * keptLat;
  car.vy = nfy * s + latY * keptLat;
  car.speed = s;
  // skid marks while drifting or braking hard
  if ((input.handbrake && Math.abs(s) > 70) || (input.throttle < 0 && s > 190)) {
    if (Math.random() < 0.8) G.skids.push({ x: car.x - nfx * 12 + latX * 7, y: car.y - nfy * 12 + latY * 7, a: 0.5 });
    if (Math.random() < 0.8) G.skids.push({ x: car.x - nfx * 12 - latX * 7, y: car.y - nfy * 12 - latY * 7, a: 0.5 });
    if (G.skids.length > 500) G.skids.splice(0, G.skids.length - 500);
  }
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // building collision: stop dead, take damage, spark
  const before = Math.abs(s);
  if (collideBuildings(car, CAR.radius)) {
    if (before > 120) {
      damageCar(car, (before - 110) * 0.16, G);
      sfx.crash(before / 300);
      burst(G, car.x, car.y, 8, '#ffd166', 130);
      G.camera.shake = Math.min(10, before / 34);
    }
    car.vx *= 0.25; car.vy *= 0.25; car.speed *= 0.25;
  }
  // car-to-car bumps
  for (const other of G.cars) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.01 && d < 34) {
      const push = (34 - d) / 2;
      const nx = dx / d, ny = dy / d;
      car.x -= nx * push; car.y -= ny * push;
      other.x += nx * push; other.y += ny * push;
      const rel = Math.abs((car.vx - other.vx) * nx + (car.vy - other.vy) * ny);
      if (rel > 90) {
        damageCar(car, rel * 0.05, G); damageCar(other, rel * 0.06, G);
        sfx.crash(rel / 260);
        burst(G, (car.x + other.x) / 2, (car.y + other.y) / 2, 6, '#ffd166', 110);
        if (other.driver === 'traffic') other.ai.panic = 2.5;
        if (car.driver === 'player' && G.onPlayerCrash) G.onPlayerCrash(other, rel);
      }
      other.vx += car.vx * 0.25; other.vy += car.vy * 0.25;
    }
  }
}

export function damageCar(car, amount, G) {
  if (car.wrecked) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0; car.wrecked = true;
    burst(G, car.x, car.y, 22, '#ff7b3c', 190);
    burst(G, car.x, car.y, 14, '#555', 90);
    if (car.driver === 'traffic') { car.driver = null; }
  }
}

// Free-rolling step for unattended cars (parked, or coasting after a bump).
export function coastCar(car, dt) {
  car.x += car.vx * dt; car.y += car.vy * dt;
  car.vx *= Math.max(0, 1 - 2.4 * dt); car.vy *= Math.max(0, 1 - 2.4 * dt);
  if (Math.abs(car.vx) + Math.abs(car.vy) > 4) collideBuildings(car, CAR.radius);
}

export function drawCar(ctx, car, camX, camY, time) {
  const sx = car.x - camX, sy = car.y - camY;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = 'rgba(25,25,35,0.35)';
  ctx.beginPath(); ctx.ellipse(3, 5, 24, 13, car.angle, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  const L = CAR.length, W = CAR.width;
  // body
  ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 6); ctx.fill();
  // cabin + windows
  ctx.fillStyle = car.wrecked ? '#222' : 'rgba(18,28,40,0.88)';
  roundRect(ctx, -L * 0.16, -W / 2 + 3, L * 0.36, W - 6, 4); ctx.fill();
  ctx.fillStyle = 'rgba(140,200,235,0.5)';
  roundRect(ctx, L * 0.13, -W / 2 + 4, 4, W - 8, 2); ctx.fill();
  // hood highlight and headlights
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, L * 0.24, -W / 2 + 2, L * 0.22, W - 4, 4); ctx.fill();
  ctx.fillStyle = '#ffe9a3';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5); ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff5a4c';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 2, 3, 5); ctx.fillRect(-L / 2 - 1, W / 2 - 7, 3, 5);
  // wheels
  ctx.fillStyle = '#151515';
  for (const [wx, wy] of [[-L / 2 + 8, -W / 2 - 1], [L / 2 - 8, -W / 2 - 1], [-L / 2 + 8, W / 2 - 3], [L / 2 - 8, W / 2 - 3]]) {
    ctx.fillRect(wx - 4, wy, 8, 4);
  }
  if (car.police) {
    // black-and-white patrol livery + light bar
    ctx.fillStyle = '#f2f2f2';
    roundRect(ctx, -L * 0.05, -W / 2 + 1, L * 0.3, W - 2, 4); ctx.fill();
    const phase = Math.floor(time * 6 + car.sirenPhase) % 2;
    ctx.fillStyle = phase ? '#ff3b30' : '#3a7bff';
    ctx.fillRect(-4, -6, 8, 5);
    ctx.fillStyle = phase ? '#3a7bff' : '#ff3b30';
    ctx.fillRect(-4, 1, 8, 5);
  }
  if (car.missionCar) {
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  }
  // damage smoke
  if (car.hp < car.maxHp * 0.35 && !car.wrecked) {
    ctx.fillStyle = 'rgba(70,70,70,0.5)';
    ctx.beginPath(); ctx.arc(L * 0.3, 0, 5 + Math.sin(time * 9 + car.x) * 1.6, 0, Math.PI * 2); ctx.fill();
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(255,110,40,0.75)';
    ctx.beginPath(); ctx.arc(0, 0, 6 + Math.sin(time * 13 + car.y) * 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
