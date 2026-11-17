// pedestrians.js — the people of Port Solano: they stroll the sidewalks and
// the beach, chat in pairs, flee from gunfire and speeding cars, and fall
// when hit. Also draws the little figures the player and police reuse.

import { ROAD_W, BEACH_Y, WORLD } from './config.js';
import { collideBuildings } from './city.js';
import { range, pick } from './random.js';

const SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c8b6ff', '#ffffff', '#2a9d8f'];
const SKINS = ['#f2c09a', '#c68863', '#8d5a3b', '#6f4423', '#ffd9b3'];

export function makePed(rng, x, y) {
  return {
    kind: 'ped', x, y, angle: range(rng, 0, Math.PI * 2),
    tx: x, ty: y, speed: range(rng, 42, 78),
    shirt: pick(rng, SHIRTS), skin: pick(rng, SKINS),
    state: 'walk', hp: 30, downT: 0, fleeT: 0, threat: null,
    chatT: range(rng, 0, 9), phase: range(rng, 0, 6),
  };
}

export function spawnPeds(G, count) {
  const rng = G.rng;
  for (let i = 0; i < count; i++) {
    const onBeach = rng() < 0.18;
    let x, y;
    if (onBeach) { x = range(rng, 80, WORLD - 80); y = range(rng, BEACH_Y + 30, BEACH_Y + 130); }
    else {
      const vertical = rng() < 0.5;
      const c = pick(rng, G.city.centres);
      const side = rng() < 0.5 ? -1 : 1;
      const along = range(rng, 70, BEACH_Y - 60);
      x = vertical ? c + side * (ROAD_W / 2 + 11) : along;
      y = vertical ? along : c + side * (ROAD_W / 2 + 11);
    }
    const ped = makePed(rng, x, y);
    chooseTarget(G, ped);
    G.peds.push(ped);
  }
}

function chooseTarget(G, ped) {
  const rng = G.rng;
  // wander: a new stroll target a few hundred units away, kept on land
  ped.tx = Math.max(30, Math.min(WORLD - 30, ped.x + range(rng, -420, 420)));
  ped.ty = Math.max(30, Math.min(BEACH_Y + 130, ped.y + range(rng, -420, 420)));
}

export function scarePeds(G, x, y, radius) {
  for (const ped of G.peds) {
    if (ped.state === 'down' || ped.state === 'dead') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < radius) {
      ped.state = 'flee'; ped.fleeT = range(G.rng, 1.2, 2.6);
      ped.threat = { x, y };
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    if (ped.state === 'down') {
      ped.downT -= dt;
      if (ped.downT <= 0 && ped.hp > 0) ped.state = 'walk';
      continue;
    }
    let tx = ped.tx, ty = ped.ty, speed = ped.speed;
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) { ped.state = 'walk'; chooseTarget(G, ped); }
      else if (ped.threat) {
        const dx = ped.x - ped.threat.x, dy = ped.y - ped.threat.y;
        const d = Math.hypot(dx, dy) || 1;
        tx = ped.x + (dx / d) * 200; ty = ped.y + (dy / d) * 200;
        speed = 215;
      }
    }
    const dx = tx - ped.x, dy = ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) { if (ped.state === 'walk') chooseTarget(G, ped); continue; }
    const vx = (dx / d) * speed, vy = (dy / d) * speed;
    ped.x += vx * dt; ped.y += vy * dt;
    ped.angle = Math.atan2(vy, vx);
    ped.phase += dt * (speed > 120 ? 13 : 8);
    collideBuildings(ped, 10);
  }
  // keep the sidewalks alive away from the player
  if (G.peds.filter(p => p.state !== 'dead').length < 22 && Math.random() < dt * 0.5) {
    const before = G.peds.length;
    spawnPeds(G, 1);
    const ped = G.peds[G.peds.length - 1];
    if (ped && G.player && Math.hypot(ped.x - G.player.x, ped.y - G.player.y) < 480 && G.peds.length > before) {
      G.peds.pop(); // not right on top of the player
    }
  }
}

export function drawFigure(ctx, x, y, angle, shirt, skin, phase, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(25,25,35,0.30)';
  ctx.beginPath(); ctx.ellipse(1.5, 3.5, 8, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  // legs scissor while walking
  const sw = Math.sin(phase) * 4;
  ctx.strokeStyle = opts.pants || '#33404f';
  ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2 + sw * 0.4, 5 + sw); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2 - sw * 0.4, 5 - sw); ctx.stroke();
  // torso and head
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, Math.PI * 2); ctx.fill();
  if (opts.badge) { ctx.fillStyle = '#ffd60a'; ctx.fillRect(1, -2, 3, 3); }
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(1.5, 0, 3.6, 0, Math.PI * 2); ctx.fill();
  if (opts.hat) {
    ctx.fillStyle = opts.hat;
    ctx.beginPath(); ctx.arc(1.5, 0, 4.4, Math.PI * 0.9, Math.PI * 1.9); ctx.fill();
  }
  if (opts.gun) {
    ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(13, 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawPed(ctx, ped, camX, camY) {
  const sx = ped.x - camX, sy = ped.y - camY;
  if (ped.state === 'dead') {
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(120,20,20,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(0, 0, 6.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(8, 2, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (ped.state === 'down') {
    ctx.save();
    ctx.translate(sx, sy); ctx.rotate(ped.angle + 0.8);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath(); ctx.arc(9, 0, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  drawFigure(ctx, sx, sy, ped.angle, ped.shirt, ped.skin, ped.phase);
}
