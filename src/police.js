// police.js — the Port Solano PD: the wanted-star system, patrol cars that
// hunt you down and ram you, officers who get out and shoot, the busted
// meter when they corner you, and laying low until the heat decays.

import { WANTED } from './config.js';
import { makeCar, driveCar, carSpeed } from './vehicles.js';
import { randomRoadPoint, collideBuildings } from './city.js';
import { drawFigure } from './pedestrians.js';
import { fireBullet } from './combat.js';
import { sfx } from './audio.js';
import { floater } from './effects.js';
import { playerPos } from './player.js';

let spawnCd = 0;

// A crime is reported: the wanted level rises to at least `level` stars.
export function reportCrime(G, level) {
  const before = G.wanted;
  G.wanted = Math.max(G.wanted, Math.min(5, level));
  G.heat = 0;
  if (G.wanted > before) {
    sfx.wanted();
    floater(G, playerPos(G).x, playerPos(G).y - 44, '★'.repeat(G.wanted), '#ff5a4c');
  }
}

function spawnCopCar(G) {
  const pp = playerPos(G);
  const p = randomRoadPoint(G.rng, pp, 9999); // far anchor, then place by hand
  // place on a road 720-920 units from the player
  for (let tries = 0; tries < 14; tries++) {
    const q = randomRoadPoint(G.rng);
    const d = Math.hypot(q.x - pp.x, q.y - pp.y);
    if (d > 700 && d < 980) { p.x = q.x; p.y = q.y; break; }
  }
  const car = makeCar(1, '#23272e', p.x, p.y, 0);
  car.police = true;
  car.driver = 'police';
  car.top = 305 + G.wanted * 16;
  car.hp = 120; car.maxHp = 120;
  G.cars.push(car);
  G.cops.push({ state: 'car', car, x: p.x, y: p.y, angle: 0, hp: 46, shootCd: 1 + Math.random(), burst: 0, phase: Math.random() * 6 });
}

export function updatePolice(G, dt) {
  const pp = playerPos(G);
  spawnCd -= dt;
  // --- who can see the player? ---
  let seen = false;
  for (const cop of G.cops) {
    if (cop.state === 'dead' || cop.thug) continue;
    const cx = cop.state === 'car' ? cop.car.x : cop.x;
    const cy = cop.state === 'car' ? cop.car.y : cop.y;
    if (Math.hypot(cx - pp.x, cy - pp.y) < WANTED.sightRange) seen = true;
  }
  G.seenByPolice = seen;
  if (seen) G.heat = 0;
  else if (G.wanted > 0) {
    G.heat += dt;
    if (G.heat >= WANTED.decayPerStar) {
      G.wanted -= 1;
      G.heat = 0;
      floater(G, pp.x, pp.y - 40, G.wanted === 0 ? 'You lost the heat' : 'Heat fading…', '#9be15d');
    }
  }
  // --- reinforcements ---
  const activeCars = G.cops.filter(c => c.state === 'car').length;
  const desired = G.wanted === 0 ? 0 : Math.min(5, G.wanted + (G.wanted >= 3 ? 1 : 0));
  if (activeCars < desired && spawnCd <= 0) { spawnCopCar(G); spawnCd = 1.4; }
  // --- units ---
  let bustedPressure = false;
  for (const cop of G.cops) {
    if (cop.state === 'dead' || cop.thug) continue; // thugs think in missions.js
    if (cop.state === 'car') updateCopCar(G, cop, dt, pp);
    else updateCopFoot(G, cop, dt, pp);
    // busted pressure: a foot officer close to a slow, on-foot player
    if (cop.state === 'foot' && !cop.thug && !G.player.car) {
      const d = Math.hypot(cop.x - G.player.x, cop.y - G.player.y);
      if (d < 36) bustedPressure = true;
    }
  }
  // boxed-in pressure: police cars pinning a stopped player car
  if (G.player.car && carSpeed(G.player.car) < 14) {
    const near = G.cops.filter(c => c.state === 'car' && Math.hypot(c.car.x - pp.x, c.car.y - pp.y) < 78).length;
    if (near >= 2) bustedPressure = true;
  }
  if (bustedPressure && G.wanted > 0) {
    G.bustedMeter += dt / WANTED.bustedFillTime;
    if (G.bustedMeter >= 1 && G.onBusted) G.onBusted();
  } else {
    G.bustedMeter = Math.max(0, G.bustedMeter - dt * 0.55);
  }
  // far-away units give up and despawn when there is no heat
  G.cops = G.cops.filter(cop => {
    if (cop.state === 'dead' || cop.thug) return true;
    const cx = cop.state === 'car' ? cop.car.x : cop.x;
    const cy = cop.state === 'car' ? cop.car.y : cop.y;
    const far = Math.hypot(cx - pp.x, cy - pp.y) > 1500;
    if (far && G.wanted === 0) {
      if (cop.state === 'car') { cop.car.driver = null; G.cars = G.cars.filter(c => c !== cop.car); }
      return false;
    }
    return true;
  });
}

function updateCopCar(G, cop, dt, pp) {
  const car = cop.car;
  cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
  if (car.wrecked) { exitToFoot(G, cop); return; }
  const dx = pp.x - car.x, dy = pp.y - car.y;
  const dist = Math.hypot(dx, dy);
  const toTarget = Math.atan2(dy, dx);
  let da = toTarget - car.angle;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const input = { throttle: 0, steer: Math.max(-1, Math.min(1, da * 1.7)), handbrake: false };
  if (Math.cos(da) < -0.35 && dist > 60) input.throttle = -1; // target behind: reverse out
  else input.throttle = dist > 46 ? 1 : 0.25;
  // closing on an on-foot player: stop and get out
  if (!G.player.car && dist < 58 && carSpeed(car) < 60) { exitToFoot(G, cop); return; }
  driveCar(car, input, dt, G);
  cop.x = car.x; cop.y = car.y;
}

function exitToFoot(G, cop) {
  const car = cop.car;
  car.driver = null;
  cop.state = 'foot';
  cop.x = car.x + 24; cop.y = car.y + 8;
  cop.shootCd = 0.7;
}

function updateCopFoot(G, cop, dt, pp) {
  const p = G.player;
  const dx = pp.x - cop.x, dy = pp.y - cop.y;
  const dist = Math.hypot(dx, dy);
  cop.angle = Math.atan2(dy, dx);
  // keep a firing distance; close in if the player runs
  const wantRange = p.car ? 170 : 128;
  if (dist > wantRange + 26) {
    const sp = 196;
    cop.x += (dx / dist) * sp * dt;
    cop.y += (dy / dist) * sp * dt;
    cop.phase += dt * 11;
    collideBuildings(cop, 10);
  } else if (dist < wantRange - 44) {
    cop.x -= (dx / dist) * 110 * dt;
    cop.y -= (dy / dist) * 110 * dt;
    cop.phase += dt * 7;
    collideBuildings(cop, 10);
  }
  // shooting: bursts with a pause, worse aim against a fast car
  cop.shootCd -= dt;
  if (G.wanted > 0 && dist < 300 && cop.shootCd <= 0) {
    const targetSpeed = p.car ? carSpeed(p.car) : 0;
    const spread = 0.05 + targetSpeed * 0.0006;
    fireBullet(G, cop.x, cop.y, cop.angle, 'cop', 6.5, spread);
    sfx.shot();
    cop.burst += 1;
    cop.shootCd = cop.burst >= 3 ? 0.85 + Math.random() * 0.4 : 0.17;
    if (cop.burst >= 3) cop.burst = 0;
  }
}

export function drawCops(ctx, G, camX, camY) {
  for (const cop of G.cops) {
    if (cop.state !== 'foot' && cop.state !== 'dead') continue;
    const sx = cop.x - camX, sy = cop.y - camY;
    if (cop.state === 'dead') {
      ctx.save();
      ctx.translate(sx, sy); ctx.rotate(cop.angle);
      ctx.fillStyle = 'rgba(120,20,20,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#22335c';
      ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (cop.thug) {
      drawFigure(ctx, sx, sy, cop.angle, '#b3232a', '#8d5a3b', cop.phase, {
        pants: '#2b2b30', gun: true,
      });
      continue;
    }
    drawFigure(ctx, sx, sy, cop.angle, '#22335c', '#e8b98d', cop.phase, {
      pants: '#182238', badge: true, hat: '#22335c', gun: true,
    });
  }
}

export function anyCopNear(G, x, y, dist) {
  return G.cops.some(c => c.state !== 'dead' && Math.hypot((c.state === 'car' ? c.car.x : c.x) - x, (c.state === 'car' ? c.car.y : c.y) - y) < dist);
}
