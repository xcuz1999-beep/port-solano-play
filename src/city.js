// city.js — builds Port Solano: a grid of avenues and streets over a coastal
// square, city blocks filled with buildings, palm trees and lamps, plus the
// named zones the story uses (Alba's chop shop, the clinic, the marina, the
// safehouse, the gun shop). Also draws the ground layer and answers the
// spatial questions every other system asks (roads, collisions, lanes).

import { WORLD, ROAD_W, PITCH, ROAD_OFF, WATER_Y, BEACH_Y, COLORS } from './config.js';
import { pick, range, rangeInt } from './random.js';

export function roadCentres() {
  const c = [];
  for (let i = 0; i < 6; i++) c.push(ROAD_OFF + i * PITCH);
  return c;
}

export function buildCity(rng) {
  const centres = roadCentres();
  const buildings = [];
  const palms = [];
  const lamps = [];
  const roofSets = [COLORS.roofA, COLORS.roofB, COLORS.roofC, COLORS.roofD];
  // Blocks sit between roads. Each block is cut into a 2x2 lot grid and most
  // lots get a building, so the city reads dense; the odd lot is a car park
  // or a pocket park instead. Downtown blocks (near the centre) build taller.
  const carParks = [];
  for (let bx = 0; bx < 5; bx++) {
    for (let by = 0; by < 5; by++) {
      const x0 = ROAD_OFF + bx * PITCH + ROAD_W / 2 + 16;
      const y0 = ROAD_OFF + by * PITCH + ROAD_W / 2 + 16;
      const size = PITCH - ROAD_W - 32;
      const lot = size / 2;
      const downtown = Math.abs(bx - 2) + Math.abs(by - 2) <= 2;
      for (let lx = 0; lx < 2; lx++) {
        for (let ly = 0; ly < 2; ly++) {
          const roll = rng();
          const px = x0 + lx * lot, py = y0 + ly * lot;
          if (roll < 0.10) { // pocket park: palms, no building
            palms.push({ x: px + lot * 0.3, y: py + lot * 0.4 });
            palms.push({ x: px + lot * 0.7, y: py + lot * 0.65 });
            continue;
          }
          if (roll < 0.20) { // car park slab
            carParks.push({ x: px + 8, y: py + 8, w: lot - 16, h: lot - 16 });
            continue;
          }
          const inset = range(rng, 8, 20);
          buildings.push({
            x: px + inset, y: py + inset,
            w: lot - inset * 2, h: lot - inset * 2 - range(rng, 0, 26),
            color: pick(rng, pick(rng, roofSets)),
            floors: rangeInt(rng, downtown ? 5 : 2, downtown ? 12 : 7),
            bx, by,
          });
        }
      }
      // palms on the block corners, lamps along the streets
      if (rng() < 0.8) palms.push({ x: x0 - 8, y: y0 - 8 });
      if (rng() < 0.6) palms.push({ x: x0 + size + 8, y: y0 + size + 8 });
      lamps.push({ x: x0 - 12, y: y0 + size / 2 });
      lamps.push({ x: x0 + size / 2, y: y0 - 12 });
    }
  }
  // the beach is lined with palms
  for (let x = 90; x < WORLD - 60; x += range(rng, 120, 220)) palms.push({ x, y: BEACH_Y + range(rng, 26, 90), beach: true });

  const zones = {
    garage: { x: ROAD_OFF + 4 * PITCH, y: ROAD_OFF + 0 * PITCH, label: "Alba's Chop Shop", color: '#ffb340' },
    hospital: { x: ROAD_OFF + 0 * PITCH, y: ROAD_OFF + 2 * PITCH, label: 'Clínica del Sol', color: '#ff6b6b' },
    marina: { x: WORLD - 330, y: WATER_Y - 130, label: 'Marina Azul', color: '#4dd0e1' },
    safehouse: { x: ROAD_OFF + 0 * PITCH, y: ROAD_OFF + 4 * PITCH, label: 'Casa Reyes', color: '#9be15d' },
    gunshop: { x: ROAD_OFF + 3 * PITCH, y: ROAD_OFF + 2 * PITCH, label: 'Armería Solano', color: '#e0e0e0' },
  };
  // Postcards: scenic spots to find in free roam (beach, marina, plaza corners...)
  const postcards = [
    { x: 240, y: BEACH_Y + 60, name: 'Playa Serena at dawn' },
    { x: zones.marina.x, y: zones.marina.y, name: 'Marina Azul' },
    { x: ROAD_OFF + 2 * PITCH, y: ROAD_OFF + 2 * PITCH, name: 'Plaza Central' },
    { x: WORLD - 200, y: 220, name: 'Mirador Heights' },
    { x: 200, y: 200, name: 'Old Town corner' },
    { x: ROAD_OFF + 5 * PITCH, y: BEACH_Y + 40, name: 'The boardwalk end' },
    { x: ROAD_OFF + 1 * PITCH, y: ROAD_OFF + 3 * PITCH, name: 'Calle Flores market' },
    { x: ROAD_OFF + 4 * PITCH, y: ROAD_OFF + 4 * PITCH, name: 'Palm Court' },
  ];
  return { centres, buildings, palms, lamps, zones, postcards, carParks };
}

export function isOnRoad(x, y) {
  if (y > BEACH_Y + 40) return false;
  for (const c of roadCentres()) {
    if (Math.abs(x - c) < ROAD_W / 2 || Math.abs(y - c) < ROAD_W / 2) return true;
  }
  return false;
}

export function isWater(x, y) { return y > WATER_Y; }
export function isBeach(x, y) { return y > BEACH_Y && y <= WATER_Y; }

// Push a circle (entity) out of every building it overlaps; returns true on hit.
export function collideBuildings(e, radius) {
  let hit = false;
  const city = collideBuildings.city;
  if (!city) return false;
  for (const b of city.buildings) {
    if (e.x < b.x - radius || e.x > b.x + b.w + radius || e.y < b.y - radius || e.y > b.y + b.h + radius) continue;
    const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
    let dx = e.x - nx, dy = e.y - ny;
    let d = Math.hypot(dx, dy);
    if (d < radius) {
      if (d === 0) { dx = 0; dy = -1; d = 1; }
      e.x = nx + (dx / d) * radius;
      e.y = ny + (dy / d) * radius;
      hit = true;
    }
  }
  // keep everything inside the world and out of the sea (except at the marina dock)
  e.x = Math.max(radius, Math.min(WORLD - radius, e.x));
  e.y = Math.max(radius, Math.min(WATER_Y - 6, e.y));
  return hit;
}

// A random point on a random road, away from the given point if asked.
export function randomRoadPoint(rng, awayFrom = null, minDist = 0) {
  const centres = roadCentres();
  for (let tries = 0; tries < 12; tries++) {
    const vertical = rng() < 0.5;
    const c = centres[Math.floor(rng() * centres.length)];
    const along = 80 + rng() * (BEACH_Y - 160);
    const p = vertical ? { x: c, y: along } : { x: along, y: c };
    if (!awayFrom || Math.hypot(p.x - awayFrom.x, p.y - awayFrom.y) >= minDist) return p;
  }
  return { x: centres[2], y: centres[2] };
}

// ---- drawing ------------------------------------------------------------

export function drawGround(ctx, city, camX, camY, w, h) {
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(0, 0, w, h);
  const x0 = camX, y0 = camY, x1 = camX + w, y1 = camY + h;
  // beach and sea
  if (y1 > BEACH_Y) {
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(0, Math.max(0, BEACH_Y - y0), w, Math.min(h, WATER_Y - y0) - Math.max(0, BEACH_Y - y0));
    ctx.fillStyle = COLORS.water;
    const wy = Math.max(0, WATER_Y - y0);
    ctx.fillRect(0, wy, w, h - wy);
    ctx.fillStyle = COLORS.waterDeep;
    for (let y = WATER_Y + 60; y < y1 + 60; y += 130) ctx.fillRect(0, y - y0, w, 26);
  }
  // marina dock planks
  const m = city.zones.marina;
  ctx.fillStyle = '#9a7b52';
  ctx.fillRect(m.x - 130 - x0, WATER_Y - 26 - y0, 300, 20);
  ctx.fillRect(m.x + 20 - x0, WATER_Y - 110 - y0, 22, 100);
  // sidewalks: a pale slab under each road, then the asphalt on top
  ctx.fillStyle = COLORS.sidewalk;
  for (const c of city.centres) {
    if (c + ROAD_W / 2 + 12 > x0 && c - ROAD_W / 2 - 12 < x1) ctx.fillRect(c - ROAD_W / 2 - 12 - x0, 0, ROAD_W + 24, Math.min(h, BEACH_Y + 46 - y0));
    if (c + ROAD_W / 2 + 12 > y0 && c - ROAD_W / 2 - 12 < Math.min(y1, BEACH_Y + 60)) ctx.fillRect(0, c - ROAD_W / 2 - 12 - y0, w, ROAD_W + 24);
  }
  ctx.fillStyle = COLORS.road;
  for (const c of city.centres) {
    if (c + ROAD_W / 2 > x0 && c - ROAD_W / 2 < x1) ctx.fillRect(c - ROAD_W / 2 - x0, 0, ROAD_W, Math.min(h, BEACH_Y + 46 - y0));
    if (c + ROAD_W / 2 > y0 && c - ROAD_W / 2 < Math.min(y1, BEACH_Y + 60)) ctx.fillRect(0, c - ROAD_W / 2 - y0, w, ROAD_W);
  }
  // lane dashes
  ctx.fillStyle = COLORS.roadLine;
  for (const c of city.centres) {
    for (let y = 20; y < BEACH_Y; y += 64) {
      if (y > y0 - 40 && y < y1 + 40 && c > x0 - 60 && c < x1 + 60) ctx.fillRect(c - 2 - x0, y - y0, 4, 30);
    }
    for (let x = 20; x < WORLD; x += 64) {
      if (x > x0 - 40 && x < x1 + 40 && c > y0 - 60 && c < Math.min(y1, BEACH_Y) + 60) ctx.fillRect(x - x0, c - 2 - y0, 30, 4);
    }
  }
  // crosswalks at intersections
  ctx.fillStyle = COLORS.crosswalk;
  for (const cx of city.centres) for (const cy of city.centres) {
    if (cx < x0 - 90 || cx > x1 + 90 || cy < y0 - 90 || cy > y1 + 90) continue;
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx - ROAD_W / 2 - x0, cy + i * 18 - 5 - y0, 14, 10);
      ctx.fillRect(cx + ROAD_W / 2 - 14 - x0, cy + i * 18 - 5 - y0, 14, 10);
      ctx.fillRect(cx + i * 18 - 5 - x0, cy - ROAD_W / 2 - y0, 10, 14);
      ctx.fillRect(cx + i * 18 - 5 - x0, cy + ROAD_W / 2 - 14 - y0, 10, 14);
    }
  }
  // car parks: asphalt slabs with painted bays
  for (const cp of city.carParks || []) {
    if (cp.x + cp.w < x0 || cp.x > x1 || cp.y + cp.h < y0 || cp.y > y1) continue;
    ctx.fillStyle = '#4a4f57';
    ctx.fillRect(cp.x - x0, cp.y - y0, cp.w, cp.h);
    ctx.strokeStyle = 'rgba(232,227,200,0.5)';
    ctx.lineWidth = 2;
    for (let bx = cp.x + 16; bx < cp.x + cp.w - 8; bx += 34) {
      ctx.beginPath(); ctx.moveTo(bx - x0, cp.y + 8 - y0); ctx.lineTo(bx - x0, cp.y + 30 - y0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - x0, cp.y + cp.h - 30 - y0); ctx.lineTo(bx - x0, cp.y + cp.h - 8 - y0); ctx.stroke();
    }
  }
  // plaza at the city centre intersection
  ctx.fillStyle = COLORS.plaza;
  const pc = city.centres[2];
  ctx.fillRect(pc - 44 - x0, pc - 44 - y0, 88, 88);
  ctx.fillStyle = '#7fb3c8';
  ctx.beginPath(); ctx.arc(pc - x0, pc - y0, 20, 0, Math.PI * 2); ctx.fill();
}

export function drawBuildings(ctx, city, camX, camY, w, h, shadowDx, shadowDy) {
  const x1 = camX + w, y1 = camY + h;
  for (const b of city.buildings) {
    if (b.x + b.w < camX - 60 || b.x > x1 + 60 || b.y + b.h < camY - 60 || b.y > y1 + 60) continue;
    const sx = b.x - camX, sy = b.y - camY;
    // drop shadow, then the raised roof (offset grows with floors: a 2.5D lift)
    ctx.fillStyle = 'rgba(30,30,40,0.30)';
    ctx.fillRect(sx + shadowDx, sy + shadowDy, b.w, b.h);
    const lift = 3 + b.floors * 1.6;
    ctx.fillStyle = b.color;
    ctx.fillRect(sx - lift * 0.4, sy - lift, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillRect(sx - lift * 0.4, sy - lift, b.w, 7);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(sx - lift * 0.4, sy - lift + b.h - 7, b.w, 7);
    // rooftop details: a water tank / AC box on taller blocks
    if (b.floors >= 5) {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(sx + b.w * 0.18, sy - lift + b.h * 0.2, 20, 14);
      ctx.fillRect(sx + b.w * 0.62, sy - lift + b.h * 0.6, 14, 11);
    }
  }
  // palms and lamps
  for (const p of city.palms) {
    if (p.x < camX - 40 || p.x > x1 + 40 || p.y < camY - 40 || p.y > y1 + 40) continue;
    const sx = p.x - camX, sy = p.y - camY;
    ctx.fillStyle = 'rgba(30,30,40,0.25)';
    ctx.beginPath(); ctx.ellipse(sx + 5, sy + 6, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.palmTrunk; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(sx, sy + 5); ctx.lineTo(sx + 2, sy - 4); ctx.stroke();
    ctx.strokeStyle = COLORS.palm; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.moveTo(sx + 2, sy - 5);
      ctx.quadraticCurveTo(sx + 2 + Math.cos(a) * 11, sy - 8 + Math.sin(a) * 6, sx + 2 + Math.cos(a) * 17, sy - 2 + Math.sin(a) * 11);
      ctx.stroke();
    }
  }
  for (const l of city.lamps) {
    if (l.x < camX - 20 || l.x > x1 + 20 || l.y < camY - 20 || l.y > y1 + 20) continue;
    ctx.fillStyle = '#5a5f66';
    ctx.fillRect(l.x - camX - 2, l.y - camY - 2, 4, 4);
  }
}
