// missions.js — the story of Reyes and Alba Ferrer: six missions (steal,
// deliver, chase, escape, defend, the big goodbye) told as chains of steps,
// plus repeatable courier jobs once the story is done. Steps drive the HUD
// objective line and the world marker; finishing pays cash and saves.

import { sfx } from './audio.js';
import { floater, burst } from './effects.js';
import { makeCar } from './vehicles.js';
import { fireBullet } from './combat.js';
import { collideBuildings } from './city.js';
import { playerPos } from './player.js';

export const STORY = [
  {
    title: 'First Wheels',
    brief: 'Alba: "A Marina Coupe is parked by Plaza Central. Take it. Bring it to my shop — clean."',
    reward: 300,
    steps: [
      { type: 'stealCar', model: 3, at: 'plaza', label: 'Steal the Marina Coupe at Plaza Central' },
      { type: 'deliverCar', zone: 'garage', label: 'Deliver the coupe to Alba\'s Chop Shop' },
    ],
  },
  {
    title: 'Hot Cargo',
    brief: 'Alba: "A package waits at Marina Azul. The whole port will see you take it. Move fast."',
    reward: 450,
    steps: [
      { type: 'goto', zone: 'marina', label: 'Reach the package at Marina Azul', onFoot: false },
      { type: 'pickup', zone: 'marina', label: 'Grab the package', crime: 2 },
      { type: 'deliverCar', zone: 'safehouse', label: 'Drop the package at Casa Reyes', time: 170 },
    ],
  },
  {
    title: 'The Debt',
    brief: 'Alba: "Bruno Vane owes me. He\'s driving the north-east in a grey sedan. Stop him — hard."',
    reward: 600,
    steps: [
      { type: 'chase', label: 'Ram Bruno Vane\'s sedan until it stops' },
    ],
  },
  {
    title: 'Night Run',
    brief: 'Alba: "The prototype coupe at the marina is hot. Every cop in Solano will want it. Lose them, then bring it home."',
    reward: 800,
    steps: [
      { type: 'stealCar', model: 3, at: 'marina', label: 'Steal the prototype coupe at Marina Azul', crime: 3 },
      { type: 'loseHeat', label: 'Lose the heat (stay out of sight)' },
      { type: 'deliverCar', zone: 'garage', label: 'Bring the coupe to Alba\'s Chop Shop' },
    ],
  },
  {
    title: 'Rival Colors',
    brief: 'Alba: "Vantrek\'s crew is coming for my shop. Defend it, Reyes. All of them."',
    reward: 900,
    steps: [
      { type: 'goto', zone: 'garage', label: 'Get to Alba\'s Chop Shop' },
      { type: 'shootout', count: 5, zone: 'garage', label: 'Defend the shop — drop the Vantrek crew' },
    ],
  },
  {
    title: 'Solano Goodbye',
    brief: 'Alba: "Last job. The armored van at Clínica del Sol is ours. Take it to the marina and don\'t stop for anyone."',
    reward: 1500,
    steps: [
      { type: 'stealCar', model: 4, at: 'hospital', label: 'Steal the armored van at Clínica del Sol', crime: 4 },
      { type: 'deliverCar', zone: 'marina', label: 'Reach the Marina Azul dock', time: 240 },
    ],
  },
];

function zonePos(G, zone) {
  const z = G.city.zones[zone];
  return { x: z.x, y: z.y };
}

function spawnMissionCar(G, step) {
  let x, y;
  if (step.at === 'plaza') { const c = G.city.centres[2]; x = c + 90; y = c - 130; }
  else if (step.at === 'marina') { const z = G.city.zones.marina; x = z.x - 60; y = z.y - 30; }
  else if (step.at === 'hospital') { const z = G.city.zones.hospital; x = z.x + 84; y = z.y + 40; }
  else { const z = G.city.zones.garage; x = z.x; y = z.y; }
  const car = makeCar(step.model, step.model === 3 ? '#ffd166' : '#355070', x, y, Math.PI / 2);
  car.missionCar = true;
  if (step.model === 4) { car.hp = 260; car.maxHp = 260; } // the armored van
  G.cars.push(car);
  return car;
}

export function startStoryMission(G, index) {
  const def = STORY[index];
  if (!def) return false;
  G.mission = {
    def, index, step: 0, car: null, target: null, thugsLeft: 0,
    timer: null, startedAt: G.time, failed: false,
  };
  G.message = { text: def.title, sub: def.brief, t: 5.2 };
  sfx.mission();
  setupStep(G);
  return true;
}

export function startCourier(G) {
  const zones = ['marina', 'safehouse', 'hospital', 'gunshop'];
  const from = zones[Math.floor(G.rng() * zones.length)];
  let to = zones[Math.floor(G.rng() * zones.length)];
  if (to === from) to = 'garage';
  const a = zonePos(G, from), b = zonePos(G, to);
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  G.courier = { from, to, phase: 'pickup', timer: Math.round(dist / 9) + 40 };
  G.mission = {
    def: { title: 'Courier Run', reward: Math.round(90 + dist * 0.09) },
    index: -1, step: 0, courier: true, timer: G.courier.timer,
  };
  G.message = { text: 'Courier Run', sub: `Pick up at ${G.city.zones[from].label}, deliver to ${G.city.zones[to].label}.`, t: 4 };
  sfx.mission();
  setupStep(G);
}

function setupStep(G) {
  const m = G.mission;
  if (!m) return;
  const step = currentStep(G);
  m.timer = step && step.time ? step.time : (m.courier ? m.timer : null);
  if (!step) return;
  if (step.type === 'stealCar') {
    m.car = spawnMissionCar(G, step);
    G.marker = { x: m.car.x, y: m.car.y, color: '#ffd60a', label: 'Target car' };
    G.objective = step.label;
  } else if (step.type === 'chase') {
    // Bruno Vane cruises the north-east avenues in a grey sedan
    const car = makeCar(1, '#8a8f98', G.city.centres[4], G.city.centres[1], Math.PI / 2);
    car.driver = 'traffic';
    car.ai = { axis: 'v', centre: G.city.centres[4], dir: 1, target: G.city.centres[3], cruise: 150, panic: 0 };
    car.missionCar = true;
    car.hp = 90; car.maxHp = 90;
    m.target = car;
    G.cars.push(car);
    G.marker = { x: car.x, y: car.y, color: '#ff5a4c', label: 'Bruno Vane' };
    G.objective = step.label;
  } else if (step.type === 'shootout') {
    m.thugsLeft = step.count;
    for (let i = 0; i < step.count; i++) {
      const z = zonePos(G, step.zone);
      const a = (i / step.count) * Math.PI * 2;
      G.cops.push({
        state: 'foot', thug: true, car: null,
        x: z.x + Math.cos(a) * 190, y: z.y + Math.sin(a) * 150,
        angle: a + Math.PI, hp: 40, shootCd: 1 + i * 0.4, burst: 0, phase: 0,
      });
    }
    const z = zonePos(G, step.zone);
    G.marker = { x: z.x, y: z.y, color: '#ff5a4c', label: 'Defend' };
    G.objective = step.label + ` (${m.thugsLeft} left)`;
  } else {
    const z = step.zone ? zonePos(G, step.zone) : null;
    if (z) G.marker = { x: z.x, y: z.y, color: step.type === 'loseHeat' ? '#9be15d' : '#ffd60a', label: step.label };
    G.objective = step.label;
  }
}

export function currentStep(G) {
  const m = G.mission;
  if (!m) return null;
  if (m.courier) {
    return G.courier.phase === 'pickup'
      ? { type: 'goto', zone: G.courier.from, label: `Pick up the package at ${G.city.zones[G.courier.from].label}` }
      : { type: 'goto', zone: G.courier.to, label: `Deliver to ${G.city.zones[G.courier.to].label}` };
  }
  return m.def.steps[m.step];
}

function completeMission(G) {
  const m = G.mission;
  G.cash += m.def.reward;
  G.stats.missionsDone += 1;
  if (!m.courier) {
    G.missionIndex = m.index + 1;
    if (m.index === 2 && G.player.weapons.smg.locked) {
      G.player.weapons.smg.locked = false;
      G.player.weapons.smg.ammo = 160;
      G.message = { text: 'Mission Complete', sub: `+$${m.def.reward} — Alba left you a Micro SMG (press 3).`, t: 5 };
    } else if (m.index === STORY.length - 1) {
      G.message = { text: 'STORY COMPLETE', sub: `+$${m.def.reward} — Reyes owns Port Solano now. Courier runs at the shop keep the cash coming.`, t: 7 };
      G.mode = 'complete';
    } else {
      G.message = { text: 'Mission Complete', sub: `+$${m.def.reward} from Alba.`, t: 4.5 };
    }
  } else {
    G.message = { text: 'Delivered', sub: `+$${m.def.reward} courier pay.`, t: 3.5 };
  }
  sfx.cash();
  burst(G, playerPos(G).x, playerPos(G).y, 26, '#ffd60a', 170, 0.8, 3.5);
  G.mission = null; G.courier = null;
  G.marker = null;
  if (G.onSave) G.onSave();
}

export function failMission(G, reason) {
  if (!G.mission) return;
  G.message = { text: 'Mission Failed', sub: reason + ' — head back to Alba\'s Chop Shop to try again.', t: 5 };
  sfx.fail();
  // clean up mission props
  if (G.mission.car) G.mission.car.missionCar = false;
  if (G.mission.target) G.mission.target.missionCar = false;
  G.cops = G.cops.filter(c => !c.thug);
  G.mission = null; G.courier = null;
  G.marker = null; G.objective = null;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  // idle: point the player at the next job
  if (!m) {
    if (G.mode === 'playing' && !G.shot) {
      const z = G.city.zones.garage;
      G.marker = { x: z.x, y: z.y, color: '#ffb340', label: G.missionIndex < STORY.length ? 'Next job: Alba\'s Chop Shop' : 'Courier jobs: Alba\'s Chop Shop' };
      G.objective = G.missionIndex < STORY.length
        ? `Story: "${STORY[G.missionIndex].title}" — see Alba at her Chop Shop`
        : 'Free roam — courier jobs at Alba\'s, postcards to find, heat to outrun';
    }
    return;
  }
  const step = currentStep(G);
  if (!step) { completeMission(G); return; }
  // step timer
  if (m.timer !== null && m.timer !== undefined) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'Out of time.'); return; }
  }
  const pp = playerPos(G);
  // thugs (shootout enemies) act here, not in police.js
  updateThugs(G, dt);
  switch (step.type) {
    case 'goto': {
      const z = zonePos(G, step.zone);
      G.marker = { x: z.x, y: z.y, color: '#ffd60a', label: step.label };
      G.objective = step.label;
      if (Math.hypot(pp.x - z.x, pp.y - z.y) < 64) advance(G);
      break;
    }
    case 'pickup': {
      const z = zonePos(G, step.zone);
      if (Math.hypot(pp.x - z.x, pp.y - z.y) < 52 && !G.player.car) {
        if (step.crime && G.onCrime) G.onCrime(step.crime, pp.x, pp.y);
        floater(G, pp.x, pp.y - 26, 'Package taken!', '#ffd60a');
        sfx.pickup();
        advance(G);
      }
      break;
    }
    case 'stealCar': {
      if (!m.car) break;
      G.marker = { x: m.car.x, y: m.car.y, color: '#ffd60a', label: 'Target car' };
      G.objective = step.label;
      if (m.car.wrecked) { failMission(G, 'The target car was wrecked.'); break; }
      if (G.player.car === m.car) {
        if (step.crime && G.onCrime) G.onCrime(step.crime, pp.x, pp.y);
        advance(G);
      }
      break;
    }
    case 'deliverCar': {
      const z = zonePos(G, step.zone);
      G.marker = { x: z.x, y: z.y, color: '#ffd60a', label: step.label };
      G.objective = step.label + (m.timer ? ` — ${Math.ceil(m.timer)}s` : '');
      // with a mission car you must arrive in that car; without one (the
      // package run) arriving on foot or in any car counts
      const arrived = !m.car || G.player.car === m.car;
      if (Math.hypot(pp.x - z.x, pp.y - z.y) < 78 && arrived) advance(G);
      break;
    }
    case 'chase': {
      const t = m.target;
      if (!t) break;
      G.marker = { x: t.x, y: t.y, color: '#ff5a4c', label: 'Bruno Vane' };
      G.objective = step.label + ` — his car: ${Math.max(0, Math.ceil(t.hp / t.maxHp * 100))}%`;
      // Bruno flees the player
      if (t.ai) {
        const d = Math.hypot(t.x - pp.x, t.y - pp.y);
        t.ai.panic = d < 320 ? 2 : Math.max(0, t.ai.panic - dt);
      }
      if (t.wrecked) advance(G);
      break;
    }
    case 'loseHeat': {
      G.objective = step.label + (G.wanted > 0 ? ` — ${'★'.repeat(G.wanted)}${G.seenByPolice ? ' (in sight!)' : ' (hidden — hold on)'}` : '');
      G.marker = null;
      if (G.wanted === 0) advance(G);
      break;
    }
    case 'shootout': {
      const left = G.cops.filter(c => c.thug && c.state !== 'dead').length;
      m.thugsLeft = left;
      G.objective = step.label.replace(/\(\d+ left\)/, '') + ` (${left} left)`;
      const z = zonePos(G, step.zone);
      G.marker = { x: z.x, y: z.y, color: '#ff5a4c', label: 'Defend' };
      if (left === 0) advance(G);
      break;
    }
  }
}

function advance(G) {
  const m = G.mission;
  if (m.courier) {
    if (G.courier.phase === 'pickup') {
      G.courier.phase = 'deliver';
      sfx.pickup();
      setupStep(G);
      return;
    }
    completeMission(G);
    return;
  }
  m.step += 1;
  if (m.step >= m.def.steps.length) completeMission(G);
  else setupStep(G);
}

// Thugs are stored in G.cops with thug:true so combat and drawing treat them
// as people; their brains live here: advance on the player, keep 120 units,
// fire bursts. They never arrest anyone.
function updateThugs(G, dt) {
  const pp = playerPos(G);
  for (const thug of G.cops) {
    if (!thug.thug || thug.state === 'dead') continue;
    const dx = pp.x - thug.x, dy = pp.y - thug.y;
    const dist = Math.hypot(dx, dy);
    thug.angle = Math.atan2(dy, dx);
    if (dist > 132) {
      thug.x += (dx / dist) * 172 * dt;
      thug.y += (dy / dist) * 172 * dt;
      thug.phase += dt * 10;
      collideBuildings(thug, 10);
    }
    thug.shootCd -= dt;
    if (dist < 290 && thug.shootCd <= 0) {
      fireBullet(G, thug.x, thug.y, thug.angle, 'cop', 5.5, 0.08);
      sfx.shot();
      thug.burst += 1;
      thug.shootCd = thug.burst >= 3 ? 1 + Math.random() * 0.5 : 0.19;
      if (thug.burst >= 3) thug.burst = 0;
    }
  }
}
