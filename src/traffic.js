// traffic.js — civilian cars that drive the road network on the correct side,
// slow for the car ahead, turn at intersections, panic when the shooting
// starts; plus the parked cars lining the streets, waiting to be stolen.

import { ROAD_W, BEACH_Y } from './config.js';
import { makeCar, CAR_MODELS, coastCar } from './vehicles.js';
import { randomRoadPoint } from './city.js';
import { range, pick } from './random.js';

function laneOffset(axis, dir) {
  // right-hand traffic: southbound keeps west, northbound east,
  // eastbound keeps south, westbound north.
  return dir > 0 ? (axis === 'v' ? -26 : 26) : (axis === 'v' ? 26 : -26);
}

function headingOf(axis, dir) {
  return axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
}

function newBrain(rng, city, car) {
  const axis = rng() < 0.5 ? 'v' : 'h';
  const centre = pick(rng, city.centres);
  const dir = rng() < 0.5 ? 1 : -1;
  if (axis === 'v') { car.x = centre + laneOffset(axis, dir); car.angle = headingOf(axis, dir); }
  else { car.y = centre + laneOffset(axis, dir); car.angle = headingOf(axis, dir); }
  return { axis, centre, dir, target: pickTarget(rng, city, axis, car, dir), cruise: range(rng, 95, 165), panic: 0 };
}

function pickTarget(rng, city, axis, car, dir) {
  const pos = axis === 'v' ? car.y : car.x;
  const ahead = city.centres.filter(c => (c - pos) * dir > 60);
  if (!ahead.length) return pos + dir * 500;
  return pick(rng, ahead);
}

export function spawnTraffic(G, count) {
  const rng = G.rng;
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(rng, G.player, 500);
    const mi = Math.floor(rng() * CAR_MODELS.length);
    const car = makeCar(mi, pick(rng, CAR_MODELS[mi].colors), p.x, p.y, 0);
    car.driver = 'traffic';
    car.ai = newBrain(rng, G.city, car);
    if (G.cars.some(c => Math.hypot(c.x - car.x, c.y - car.y) < 70)) continue;
    G.cars.push(car);
  }
}

export function spawnParked(G, count) {
  const rng = G.rng;
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const centre = pick(rng, G.city.centres);
    const side = rng() < 0.5 ? -1 : 1;
    const along = 90 + rng() * (BEACH_Y - 200);
    const off = side * (ROAD_W / 2 - 15);
    const x = vertical ? centre + off : along;
    const y = vertical ? along : centre + off;
    if (G.cars.some(c => Math.hypot(c.x - x, c.y - y) < 56)) continue;
    const mi = Math.floor(rng() * CAR_MODELS.length);
    const car = makeCar(mi, pick(rng, CAR_MODELS[mi].colors), x, y, vertical ? Math.PI / 2 : 0);
    if (rng() < 0.25) car.locked = true; // some parked cars are locked: breaking in takes a moment and makes noise
    G.cars.push(car);
  }
}

export function updateTraffic(G, dt) {
  const city = G.city;
  for (const car of G.cars) {
    if (car.driver === 'traffic' && !car.wrecked) {
      const ai = car.ai;
      if (ai.panic > 0) ai.panic -= dt;
      const speedTarget = ai.panic > 0 ? 250 : ai.cruise;
      // slow for a car ahead in the same lane
      let gap = Infinity;
      const hx = Math.cos(car.angle), hy = Math.sin(car.angle);
      for (const o of G.cars) {
        if (o === car) continue;
        const dx = o.x - car.x, dy = o.y - car.y;
        const ahead = dx * hx + dy * hy;
        const side = Math.abs(dx * -hy + dy * hx);
        if (ahead > 0 && ahead < gap && side < 20) gap = ahead;
      }
      let speed = car.trafficSpeed || 0;
      const want = gap < 58 ? 0 : speedTarget;
      speed += Math.max(-260 * dt, Math.min(120 * dt, want - speed));
      car.trafficSpeed = speed;
      // advance along the axis, ease across to the lane line
      if (ai.axis === 'v') {
        car.y += ai.dir * speed * dt;
        const ideal = ai.centre + laneOffset('v', ai.dir);
        car.x += Math.max(-130 * dt, Math.min(130 * dt, ideal - car.x));
        if ((car.y - ai.target) * ai.dir >= 0) decideAtIntersection(G, car);
      } else {
        car.x += ai.dir * speed * dt;
        const ideal = ai.centre + laneOffset('h', ai.dir);
        car.y += Math.max(-130 * dt, Math.min(130 * dt, ideal - car.y));
        if ((car.x - ai.target) * ai.dir >= 0) decideAtIntersection(G, car);
      }
      const targetAngle = headingOf(ai.axis, ai.dir);
      let da = targetAngle - car.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      car.angle += da * Math.min(1, 6 * dt);
      car.vx = Math.cos(car.angle) * speed; car.vy = Math.sin(car.angle) * speed;
    } else if (car.driver !== 'player' && car.driver !== 'police') {
      coastCar(car, dt);
    }
  }
  // keep the streets populated: replace cars that were stolen or wrecked
  const live = G.cars.filter(c => c.driver === 'traffic').length;
  if (live < 13 && Math.random() < dt * 0.7) spawnTraffic(G, 1);
}

function decideAtIntersection(G, car) {
  const ai = car.ai;
  const rng = G.rng;
  const here = ai.axis === 'v' ? car.y : car.x;
  // the crossing road we just reached
  const crossing = G.city.centres.reduce((best, c) => Math.abs(c - here) < Math.abs(best - here) ? c : best, G.city.centres[0]);
  if (rng() < 0.45) {
    // turn onto the crossing road
    const oldCentre = ai.centre;
    ai.axis = ai.axis === 'v' ? 'h' : 'v';
    ai.centre = crossing;
    ai.dir = rng() < 0.5 ? 1 : -1;
    if (ai.axis === 'v') car.x = oldCentre; else car.y = oldCentre;
    ai.target = pickTarget(rng, G.city, ai.axis, car, ai.dir);
  } else {
    ai.target = pickTarget(rng, G.city, ai.axis, car, ai.dir);
    // reached the end of the road: turn around
    if (Math.abs(ai.target - here) < 80) { ai.dir *= -1; ai.target = pickTarget(rng, G.city, ai.axis, car, ai.dir); }
  }
}
