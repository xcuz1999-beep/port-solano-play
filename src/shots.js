// shots.js — deterministic scenes for the maker's screenshots, reached with
// ?shot=<name>&seed=1. Each scene arranges the real game world — traffic,
// police, missions, HUD and all — into the moment the screenshot should
// catch. Nothing here is drawn that the game itself does not draw.

import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';

export function setupShot(G, name) {
  const city = G.city;
  const plaza = city.centres[2];
  G.dayT = 0.36; // golden morning light for every shot
  if (name === 'start') {
    // the title screen floats over the living city at Plaza Central
    G.mode = 'title';
    G.camera.x = plaza - 640; G.camera.y = plaza - 400;
    G.player.x = plaza + 60; G.player.y = plaza + 120;
    return;
  }
  G.mode = 'playing';
  if (name === 'cover') {
    // on foot at the plaza: traffic rolling past, pedestrians, the next job
    // waiting on the HUD and the minimap
    G.player.x = plaza - 60; G.player.y = plaza + 92;
    G.player.angle = -0.9;
    G.camera.x = G.player.x - 492; G.camera.y = G.player.y - 308;
    for (let i = 0; i < 5; i++) {
      const ped = makePed(G.rng, plaza - 170 + i * 80, plaza + 66 + (i % 3) * 30);
      G.peds.push(ped);
    }
    const trafficSpecs = [
      { axis: 'h', centre: plaza, dir: 1, at: plaza - 330, cruise: 130 },
      { axis: 'h', centre: plaza, dir: -1, at: plaza + 390, cruise: 115 },
      { axis: 'v', centre: plaza, dir: 1, at: plaza - 260, cruise: 125 },
    ];
    for (const spec of trafficSpecs) {
      const mi = 1 + Math.floor(G.rng() * 3);
      const car = spec.axis === 'h'
        ? makeCar(mi, '#4a6fa5', spec.at, spec.centre + (spec.dir > 0 ? 26 : -26), spec.dir > 0 ? 0 : Math.PI)
        : makeCar(mi, '#d94f30', spec.centre - 26, spec.at, Math.PI / 2);
      car.driver = 'traffic';
      car.ai = { axis: spec.axis, centre: spec.centre, dir: spec.dir, target: spec.centre + spec.dir * 800, cruise: spec.cruise, panic: 0 };
      G.cars.push(car);
    }
    G.cash = 450;
    G.objective = 'Story: "First Wheels" — see Alba at her Chop Shop';
    G.marker = { x: city.zones.garage.x, y: city.zones.garage.y, color: '#ffb340', label: 'Next job: Alba\'s Chop Shop' };
    return;
  }
  if (name === 'chase') {
    // three stars, mid-pursuit on the central avenue, mission car ahead
    const roadX = city.centres[3];
    const car = makeCar(3, '#ffd166', roadX - 26, plaza + 260, -Math.PI / 2);
    car.driver = 'player'; car.missionCar = true;
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x; G.player.y = car.y;
    car.vy = -210; car.speed = -210;
    G.wanted = 3;
    const copPositions = [[roadX + 26, plaza + 430], [roadX - 26, plaza + 560], [city.centres[2], plaza + 300]];
    for (const [cx, cy] of copPositions) {
      const copCar = makeCar(1, '#23272e', cx, cy, -Math.PI / 2);
      copCar.police = true; copCar.driver = 'police'; copCar.hp = 120; copCar.maxHp = 120;
      G.cars.push(copCar);
      G.cops.push({ state: 'car', car: copCar, x: cx, y: cy, angle: -Math.PI / 2, hp: 46, shootCd: 2, burst: 0, phase: 0 });
    }
    for (let i = 0; i < 10; i++) G.skids.push({ x: roadX - 20 + (i % 2) * 12, y: plaza + 300 + i * 16, a: 0.5 });
    G.objective = 'Bring the coupe to Alba\'s Chop Shop';
    G.marker = { x: city.zones.garage.x, y: city.zones.garage.y, color: '#ffd60a', label: 'Alba\'s Chop Shop' };
    G.cash = 1450;
    G.camera.x = car.x - 640; G.camera.y = car.y - 430;
    return;
  }
  if (name === 'combat') {
    // the Rival Colors shootout at the chop shop, mid-firefight: two Vantrek
    // gunners closing in, one already down, a patrol car arriving
    const z = city.zones.garage;
    G.player.x = z.x - 120; G.player.y = z.y + 120;
    G.player.angle = -2.2;
    G.player.weapon = 'smg';
    G.player.weapons.smg.locked = false;
    G.player.weapons.smg.ammo = 87;
    const thugSpots = [[-215, -18, 'foot'], [-168, 44, 'foot'], [-248, 66, 'dead']];
    for (const [ox, oy, st] of thugSpots) {
      G.cops.push({
        state: st, thug: true, car: null,
        x: z.x + ox, y: z.y + oy,
        angle: 0.5, hp: st === 'down' ? 12 : 40, shootCd: 99, burst: 0, phase: 1, downT: 99,
      });
    }
    // a patrol car parked up on the avenue, lights rolling (no brain: it stays)
    const copCar = makeCar(1, '#23272e', z.x + 26, z.y - 148, Math.PI / 2);
    copCar.police = true; copCar.driver = 'police'; copCar.hp = 120; copCar.maxHp = 120;
    G.cars.push(copCar);
    G.wanted = 2;
    G.objective = 'Defend the shop — drop the Vantrek crew (3 left)';
    G.marker = { x: z.x, y: z.y, color: '#ff5a4c', label: 'Defend' };
    G.cash = 2900;
    G.camera.x = G.player.x - 492; G.camera.y = G.player.y - 308;
    return;
  }
  if (name === 'drive') {
    // cruising the beachfront avenue at the wheel, the sea in frame below
    const roadY = city.centres[4];
    const car = makeCar(1, '#4a6fa5', 620, roadY + 26, 0);
    car.driver = 'player';
    G.cars.push(car);
    G.player.car = car;
    G.player.x = car.x; G.player.y = car.y;
    car.vx = 190; car.speed = 190;
    G.camBias = { x: 0, y: 150 }; // look south: sand and palms join the frame
    const other = makeCar(0, '#e8b13c', 1240, roadY - 26, Math.PI);
    other.driver = 'traffic';
    other.ai = { axis: 'h', centre: roadY, dir: -1, target: 300, cruise: 120, panic: 0 };
    G.cars.push(other);
    for (let i = 0; i < 4; i++) {
      const ped = makePed(G.rng, 760 + i * 130, 3140 + (i % 2) * 46);
      G.peds.push(ped);
    }
    G.cash = 875;
    G.camera.x = car.x - 492; G.camera.y = car.y - 60;
    return;
  }
}
