// combat.js — gunfire and fists: the player shoots toward the mouse, police
// shoot back, bullets fly, spark off buildings, drop pedestrians and
// officers, and every public crime feeds the wanted system.

import { mouse } from './input.js';
import { sfx } from './audio.js';
import { burst, floater } from './effects.js';
import { scarePeds } from './pedestrians.js';
import { hurtPlayer } from './player.js';
import { damageCar } from './vehicles.js';

const BULLET_SPEED = 640;

export function fireBullet(G, x, y, angle, from, damage, spread = 0) {
  const a = angle + (Math.random() - 0.5) * 2 * spread;
  G.bullets.push({
    x, y, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
    from, damage, t: 0, life: 0.95,
  });
  burst(G, x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, 2, '#ffcf5c', 60, 0.12, 2.5);
}

// Player attack input, called each frame while playing on foot.
export function updatePlayerCombat(G, dt) {
  const p = G.player;
  if (p.car || p.breakIn > 0) return;
  const w = p.weapons[p.weapon];
  const wantFire = w.auto ? mouse.down : mouse.clicked;
  if (!wantFire || p.fireCd > 0 || p.reloadCd > 0) return;
  if (p.weapon === 'fist') {
    p.fireCd = w.rate;
    sfx.punch();
    // hit whoever stands in front, close
    const hx = p.x + Math.cos(p.angle) * 22, hy = p.y + Math.sin(p.angle) * 22;
    let hitSomething = false;
    for (const ped of G.peds) {
      if (ped.state !== 'dead' && Math.hypot(ped.x - hx, ped.y - hy) < 20) {
        hurtPed(G, ped, w.damage, p.angle); hitSomething = true;
      }
    }
    for (const cop of G.cops) {
      if (cop.state === 'foot' && Math.hypot(cop.x - hx, cop.y - hy) < 20) {
        hurtCop(G, cop, w.damage, p.angle); hitSomething = true;
      }
    }
    if (hitSomething) { sfx.hit(); if (G.onCrime) G.onCrime(1, p.x, p.y); }
    return;
  }
  if (w.ammo <= 0) { p.fireCd = 0.3; sfx.dryFire(); floater(G, p.x, p.y - 24, 'No ammo — visit Armería Solano', '#ff6b6b'); return; }
  w.ammo -= 1;
  p.fireCd = w.rate;
  fireBullet(G, p.x, p.y, p.angle, 'player', w.damage, w.spread);
  sfx.shot();
  scarePeds(G, p.x, p.y, 300);
  if (G.onCrime) G.onCrime(1, p.x, p.y);
  G.camera.shake = Math.min(4, G.camera.shake + 0.7);
}

export function hurtPed(G, ped, damage, angle) {
  ped.hp -= damage;
  burst(G, ped.x, ped.y, 5, '#c0392b', 90, 0.4, 2.5);
  if (ped.hp <= 0) {
    ped.state = 'dead';
    if (G.onCrime) G.onCrime(3, ped.x, ped.y);
  } else {
    ped.state = 'down'; ped.downT = 2.2;
    ped.angle = angle;
    if (G.onCrime) G.onCrime(2, ped.x, ped.y);
  }
}

export function hurtCop(G, cop, damage, angle) {
  cop.hp -= damage;
  burst(G, cop.x, cop.y, 5, '#c0392b', 90, 0.4, 2.5);
  if (cop.hp <= 0) {
    cop.state = 'dead';
    burst(G, cop.x, cop.y, 10, '#c0392b', 120, 0.5, 3);
    if (G.onCrime) G.onCrime(cop.thug ? 2 : 4, cop.x, cop.y);
  } else if (G.onCrime) {
    G.onCrime(cop.thug ? 2 : 3, cop.x, cop.y);
  }
}

export function updateBullets(G, dt) {
  const city = G.city;
  for (const b of G.bullets) {
    b.t += dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    // buildings stop bullets
    for (const bd of city.buildings) {
      if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h) {
        b.t = b.life;
        burst(G, b.x, b.y, 3, '#ffe9a3', 80, 0.2, 2);
        break;
      }
    }
    if (b.t >= b.life) continue;
    if (b.from === 'player') {
      let consumed = false;
      for (const ped of G.peds) {
        if (ped.state !== 'dead' && Math.hypot(ped.x - b.x, ped.y - b.y) < 10) {
          hurtPed(G, ped, b.damage, Math.atan2(b.vy, b.vx)); consumed = true; break;
        }
      }
      if (!consumed) for (const cop of G.cops) {
        if (cop.state === 'foot' && Math.hypot(cop.x - b.x, cop.y - b.y) < 10) {
          hurtCop(G, cop, b.damage, Math.atan2(b.vy, b.vx)); consumed = true; break;
        }
      }
      if (!consumed) for (const car of G.cars) {
        if (Math.hypot(car.x - b.x, car.y - b.y) < 22) {
          damageCar(car, b.damage * 0.7, G);
          burst(G, b.x, b.y, 3, '#ffd166', 90, 0.25, 2);
          if (car.police && G.onCrime) G.onCrime(3, b.x, b.y);
          consumed = true; break;
        }
      }
      if (consumed) b.t = b.life;
    } else {
      // police bullets: hit the player or the player's car
      const p = G.player;
      if (p.car) {
        if (Math.hypot(p.car.x - b.x, p.car.y - b.y) < 23) {
          damageCar(p.car, b.damage * 0.5, G);
          if (Math.random() < 0.4) hurtPlayer(G, b.damage * 0.5);
          b.t = b.life;
        }
      } else if (Math.hypot(p.x - b.x, p.y - b.y) < 10) {
        hurtPlayer(G, b.damage);
        burst(G, p.x, p.y, 5, '#c0392b', 90, 0.4, 2.5);
        b.t = b.life;
      }
    }
  }
  G.bullets = G.bullets.filter(b => b.t < b.life);
}

export function drawBullets(ctx, G, camX, camY) {
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const b of G.bullets) {
    ctx.moveTo(b.x - camX, b.y - camY);
    ctx.lineTo(b.x - camX - b.vx * 0.016, b.y - camY - b.vy * 0.016);
  }
  ctx.stroke();
}
