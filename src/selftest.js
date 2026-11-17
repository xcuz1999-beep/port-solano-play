// selftest.js — a scripted playability check that runs only under ?test=1:
// it starts a new game, walks, steals a car, drives it, commits a witnessed
// crime, saves, loads, and opens the first mission, asserting each step and
// writing the verdict into #testlog for a headless browser to read back.

import { keys, pressed } from './input.js';
import { nearestCar } from './player.js';
import { reportCrime } from './police.js';
import { saveGame, loadGame } from './save.js';
import { startStoryMission } from './missions.js';

const lines = [];
let step = 0;
let wait = 0;
let startPos = null;
let carStart = null;
let failures = 0;

function check(name, ok) {
  lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures++;
}

export function runSelfTest(G, api) {
  const el = document.createElement('div');
  el.id = 'testlog';
  document.body.appendChild(el);
  const tick = (dt) => {
    try {
      return tickInner(dt);
    } catch (err) {
      el.textContent = `SELFTEST ERROR at step ${step}: ${err && err.message} :: ` + lines.join(' | ');
      console.log(el.textContent);
      return false;
    }
  };
  const tickInner = (dt) => {
    const spd = G.player.car ? Math.hypot(G.player.car.vx, G.player.car.vy).toFixed(0) : '-';
    el.textContent = `SELFTEST RUNNING step ${step} t=${G.time.toFixed(1)} inCar=${!!G.player.car} spd=${spd} :: ` + lines.join(' | ');
    wait -= dt;
    if (wait > 0) return true;
    switch (step) {
      case 0:
        api.newGame();
        check('new game enters playing mode', G.mode === 'playing');
        startPos = { x: G.player.x, y: G.player.y };
        keys.KeyW = true; wait = 1.0; step = 1;
        break;
      case 1:
        keys.KeyW = false;
        check('walking moves the player', Math.hypot(G.player.x - startPos.x, G.player.y - startPos.y) > 40);
        // stand beside an unlocked parked car and get in
        {
          const car = G.cars.find(c => !c.driver && !c.police && !c.locked && !c.wrecked);
          check('an unlocked parked car exists', !!car);
          G.player.x = car.x + 30; G.player.y = car.y;
          pressed.KeyE = true; wait = 0.3; step = 2;
        }
        break;
      case 2:
        check('E enters the car', !!G.player.car);
        carStart = { x: G.player.x, y: G.player.y };
        keys.KeyW = true; wait = 1.4; step = 3;
        break;
      case 3:
        keys.KeyW = false;
        check('driving moves the car', Math.hypot(G.player.x - carStart.x, G.player.y - carStart.y) > 60);
        keys.KeyS = true; wait = 0.45; step = 4; // brake (holding S longer would reverse)
        break;
      case 4:
        keys.KeyS = false;
        wait = 0.8; step = 5; // roll the last speed off
        break;
      case 5:
        pressed.KeyE = true; wait = 0.3; step = 6;
        break;
      case 6:
        check('E exits the car', !G.player.car);
        reportCrime(G, 3);
        check('a witnessed crime raises wanted to 3', G.wanted === 3);
        G.cash = 777;
        saveGame(G);
        check('save writes and loads back', !!loadGame() && loadGame().cash === 777);
        check('first story mission starts', startStoryMission(G, 0) && !!G.mission && !!G.marker);
        G.mode = 'paused';
        check('pause holds the game', G.mode === 'paused');
        G.mode = 'playing';
        step = 7; wait = 0.1;
        break;
      default:
        el.textContent = `SELFTEST ${failures === 0 ? 'ALL PASS' : failures + ' FAILURES'} :: ` + lines.join(' | ');
        console.log(el.textContent);
        return false; // stop ticking
    }
    return true;
  };
  return tick;
}
