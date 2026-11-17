// hud.js — everything drawn over the world: the live minimap (streets, water,
// blips for the player, police, traffic and the objective), health, cash,
// wanted stars, weapon and ammo, the objective line, centre banners, and the
// title / pause / busted / wasted screens.

import { WORLD, WATER_Y, BEACH_Y, ZOOM } from './config.js';
import { playerPos } from './player.js';
import { STORY } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawMinimap(ctx, G, x, y, size) {
  const s = size / WORLD;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 10);
  ctx.clip();
  ctx.fillStyle = '#79b657';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#ecd29a';
  ctx.fillRect(x, y + BEACH_Y * s, size, (WATER_Y - BEACH_Y) * s);
  ctx.fillStyle = '#1d6f8e';
  ctx.fillRect(x, y + WATER_Y * s, size, size - WATER_Y * s);
  // roads
  ctx.fillStyle = '#3c4148';
  for (const c of G.city.centres) {
    ctx.fillRect(x + c * s - 2, y, 4, size);
    ctx.fillRect(x, y + c * s - 2, size, 4);
  }
  // zones
  for (const z of Object.values(G.city.zones)) dot(ctx, x + z.x * s, y + z.y * s, 2.6, z.color);
  // traffic (faint) and police (flashing)
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const car of G.cars) {
    if (car.driver === 'traffic') dot(ctx, x + car.x * s, y + car.y * s, 1.8, 'rgba(255,255,255,0.55)');
  }
  const flash = Math.floor(G.time * 3) % 2 === 0;
  for (const cop of G.cops) {
    if (cop.state === 'dead') continue;
    const cx = cop.state === 'car' ? cop.car.x : cop.x;
    const cy = cop.state === 'car' ? cop.car.y : cop.y;
    dot(ctx, x + cx * s, y + cy * s, 3, flash ? '#ff3b30' : '#3a7bff');
  }
  // objective marker
  if (G.marker) {
    const mx = x + G.marker.x * s, my = y + G.marker.y * s;
    ctx.strokeStyle = G.marker.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 5 + Math.sin(G.time * 5) * 1.4, 0, Math.PI * 2); ctx.stroke();
    dot(ctx, mx, my, 2.4, G.marker.color);
  }
  // player arrow
  const pp = playerPos(G);
  const px = x + pp.x * s, py = y + pp.y * s;
  ctx.translate(px, py);
  ctx.rotate(G.player.angle + Math.PI / 2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4.4, 5); ctx.lineTo(0, 2.4); ctx.lineTo(-4.4, 5);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // frame
  ctx.strokeStyle = 'rgba(10,14,20,0.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(x, y, size, size, 10); ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

export function drawHUD(ctx, G, w, h) {
  const p = G.player;
  drawMinimap(ctx, G, 14, 14, 176);
  // health bar under the minimap
  bar(ctx, 14, 198, 176, 13, p.hp / 100, '#e63946', 'HP');
  if (p.car) bar(ctx, 14, 215, 176, 9, Math.max(0, p.car.hp / p.car.maxHp), '#ffb340', 'CAR');
  // weapon + ammo
  ctx.font = `600 14px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4;
  const wname = p.weapons[p.weapon].name;
  const ammo = p.weapons[p.weapon].ammo !== undefined ? ` · ${p.weapons[p.weapon].ammo}` : '';
  ctx.fillText(p.car ? (p.car.police ? 'PATROL CAR' : p.car.modelName) : `${wname}${ammo}`, 14, 240);
  if (p.reloadCd > 0) ctx.fillText('reloading…', 14, 258);
  ctx.shadowBlur = 0;
  // wanted stars + cash, top right
  ctx.textAlign = 'right';
  ctx.font = '26px ' + FONT;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted ? (Math.floor(G.time * 2) % 2 ? '#ff5a4c' : '#ffd60a') : 'rgba(255,255,255,0.35)';
  ctx.fillText(stars, w - 16, 36);
  ctx.font = `700 22px ${FONT}`;
  ctx.fillStyle = '#9be15d';
  ctx.fillText('$' + G.cash.toLocaleString('en-US'), w - 16, 64);
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(clockText(G.dayT) + (G.wanted > 0 && !G.seenByPolice ? ' · LAY LOW…' : ''), w - 16, 84);
  // objective line, bottom centre
  if (G.objective) {
    ctx.font = `600 16px ${FONT}`;
    ctx.textAlign = 'center';
    const dist = G.marker ? Math.round(Math.hypot(G.marker.x - playerPos(G).x, G.marker.y - playerPos(G).y) / 10) : null;
    const text = G.objective + (dist !== null ? `  ·  ${dist}m` : '');
    const tw = ctx.measureText(text).width + 28;
    ctx.fillStyle = 'rgba(10,14,20,0.62)';
    ctx.beginPath(); ctx.roundRect(w / 2 - tw / 2, h - 46, tw, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.fillText(text, w / 2, h - 26);
  }
  // speed, bottom right while driving
  if (p.car) {
    ctx.font = `700 24px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', w - 16, h - 20);
  }
  // busted meter
  if (G.bustedMeter > 0.02) {
    ctx.textAlign = 'center';
    ctx.font = `800 20px ${FONT}`;
    ctx.fillStyle = '#ff5a4c';
    ctx.fillText('BUSTED?', w / 2, 108);
    bar(ctx, w / 2 - 110, 116, 220, 10, G.bustedMeter, '#ff5a4c');
  }
  // centre banner (mission titles, story beats)
  if (G.message && G.message.t > 0) {
    const a = Math.min(1, G.message.t / 0.8);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8;
    ctx.fillText(G.message.text, w / 2, 150);
    if (G.message.sub) {
      ctx.font = `500 16px ${FONT}`;
      ctx.fillStyle = '#ffe9a3';
      wrapText(ctx, G.message.sub, w / 2, 178, w * 0.62, 21);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function bar(ctx, x, y, w, h, ratio, color, label) {
  ctx.fillStyle = 'rgba(10,14,20,0.62)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 4); ctx.fill();
  ctx.fillStyle = color;
  if (ratio > 0.01) { ctx.beginPath(); ctx.roundRect(x + 1.5, y + 1.5, (w - 3) * Math.max(0, Math.min(1, ratio)), h - 3, 3); ctx.fill(); }
  if (label) {
    ctx.font = '700 9px ' + FONT; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(label, x + 5, y + h - 3.5);
  }
}

function clockText(dayT) {
  const mins = Math.floor(dayT * 24 * 60);
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function wrapText(ctx, text, cx, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '', yy = y;
  for (const word of words) {
    if (ctx.measureText(line + word).width > maxW && line) {
      ctx.fillText(line, cx, yy); yy += lineH; line = '';
    }
    line += word + ' ';
  }
  if (line) ctx.fillText(line, cx, yy);
  return yy;
}

// In-world objective marker: a bouncing diamond + light pillar + label.
export function drawMarker(ctx, G, camX, camY) {
  if (!G.marker) return;
  const sx = G.marker.x - camX, sy = G.marker.y - camY;
  const bob = Math.sin(G.time * 4) * 5;
  ctx.fillStyle = G.marker.color;
  ctx.globalAlpha = 0.16;
  ctx.fillRect(sx - 3, sy - 190, 6, 190);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(sx, sy - 34 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
  ctx.font = '700 12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4;
  ctx.fillText(G.marker.label || '', sx, sy - 56 + bob);
  ctx.shadowBlur = 0;
  // ground ring
  ctx.strokeStyle = G.marker.color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(sx, sy, 20 + Math.sin(G.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
}

// Off-screen direction arrow for the marker.
export function drawMarkerArrow(ctx, G, w, h) {
  if (!G.marker) return;
  const pp = playerPos(G);
  const sx = (G.marker.x - G.camera.x) * ZOOM, sy = (G.marker.y - G.camera.y) * ZOOM;
  if (sx > -20 && sx < w + 20 && sy > -20 && sy < h + 20) return;
  const cx = w / 2, cy = h / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(a) * (w / 2 - 54), ey = cy + Math.sin(a) * (h / 2 - 54);
  ctx.save();
  ctx.translate(ex, ey); ctx.rotate(a);
  ctx.fillStyle = G.marker.color;
  ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-9, -8); ctx.lineTo(-9, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- screens ------------------------------------------------------------

function panel(ctx, w, h, title, lines, boxes, items) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a';
  ctx.font = `800 44px ${FONT}`;
  ctx.fillText(title, w / 2, h * 0.30);
  ctx.font = `500 16px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  let y = h * 0.30 + 38;
  for (const line of lines) { ctx.fillText(line, w / 2, y); y += 23; }
  boxes.length = 0;
  let by = y + 16;
  for (const item of items) {
    const bw = 300, bh = 42;
    const bx = w / 2 - bw / 2;
    ctx.fillStyle = 'rgba(255,214,10,0.14)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill();
    ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(item.label, w / 2, by + 27);
    boxes.push({ x: bx, y: by, w: bw, h: bh, action: item.action });
    by += 56;
  }
  return boxes;
}

export function drawTitle(ctx, G, w, h, hasSave, boxes) {
  // the live city is already drawn behind; add a warm gradient and the wordmark
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(20,10,40,0.45)');
  grad.addColorStop(0.55, 'rgba(20,10,40,0.12)');
  grad.addColorStop(1, 'rgba(20,10,40,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = `900 76px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(255,110,60,0.85)'; ctx.shadowBlur = 26;
  ctx.fillText('PORT SOLANO', w / 2, h * 0.30);
  ctx.shadowBlur = 0;
  ctx.font = `600 19px ${FONT}`;
  ctx.fillStyle = '#ffe9a3';
  ctx.fillText('An open-world crime story — steal it, drive it, outrun it.', w / 2, h * 0.30 + 36);
  const items = [{ label: '▶  New Game', action: 'new' }];
  if (hasSave) items.push({ label: '↻  Continue', action: 'continue' });
  items.push({ label: 'How to Play', action: 'help' });
  items.push({ label: G.muted ? 'Sound: Off' : 'Sound: On', action: 'mute' });
  boxes.length = 0;
  let by = h * 0.30 + 76;
  for (const item of items) {
    const bw = 280, bh = 42, bx = w / 2 - bw / 2;
    ctx.fillStyle = 'rgba(10,14,24,0.66)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.fill();
    ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 9); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 17px ${FONT}`;
    ctx.fillText(item.label, w / 2, by + 27);
    boxes.push({ x: bx, y: by, w: bw, h: bh, action: item.action });
    by += 54;
  }
  ctx.font = `500 13px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('WASD drive · E enter car · mouse aim & shoot · Shift run · Space handbrake · P pause', w / 2, h - 26);
}

export function drawHelp(ctx, G, w, h, boxes) {
  panel(ctx, w, h, 'HOW TO PLAY', [
    'You are Reyes, a wheelman new in Port Solano. Alba Ferrer runs the chop shop —',
    'her yellow marker is your next job. Six jobs tell the whole story.',
    '',
    'WASD / arrows — walk and drive        E — enter / exit a car (hold E at a locked car)',
    'Mouse — aim, click / hold — shoot     1 / 2 / 3 — fists, pistol, SMG      R — reload',
    'Shift — run      Space — handbrake      P or Esc — pause      M — mute',
    '',
    'Crimes raise your wanted stars. Police hunt by sight: break line of distance,',
    'ditch the car, and lay low until the heat fades. Get cornered and you are BUSTED;',
    'get shot down and you wake at Clínica del Sol, poorer. Buy ammo at Armería Solano (E).',
    'Casa Reyes (E) saves your game and patches you up. Find all 8 postcards in free roam.',
  ], boxes, [{ label: '← Back', action: 'back' }]);
}

export function drawPause(ctx, G, w, h, boxes) {
  panel(ctx, w, h, 'PAUSED', [
    `Cash $${G.cash.toLocaleString('en-US')} · Missions done ${G.stats.missionsDone} · Cars stolen ${G.stats.stolen}`,
    `Postcards ${G.postcards.length}/8 · Story: ${G.missionIndex >= STORY.length ? 'complete' : STORY[G.missionIndex].title}`,
  ], boxes, [
    { label: 'Resume', action: 'resume' },
    { label: 'Save Game', action: 'save' },
    { label: 'How to Play', action: 'help' },
    { label: 'Quit to Title', action: 'title' },
  ]);
}

export function drawEndScreen(ctx, G, w, h, boxes) {
  const title = G.mode === 'busted' ? 'BUSTED' : G.mode === 'wasted' ? 'WASTED' : 'STORY COMPLETE';
  const lines = G.mode === 'busted'
    ? ['The Port Solano PD walks you to a cell.', 'You pay $150 in fines and walk out at the Clínica.']
    : G.mode === 'wasted'
      ? ['You wake up at Clínica del Sol.', 'The bill is $120. The city keeps spinning.']
      : ['Reyes and Alba own the Port Solano night.', 'Free roam continues — courier jobs and postcards remain.'];
  panel(ctx, w, h, title, lines, boxes, [{ label: G.mode === 'complete' ? 'Keep Roaming' : 'Back on the Street', action: 'respawn' }]);
}
