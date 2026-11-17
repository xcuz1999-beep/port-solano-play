// effects.js — the juice: particle bursts (sparks, dust, confetti, smoke),
// skid marks left on the asphalt, and floating text popups (+$250, WASTED…).

export function burst(G, x, y, n, color, speed = 140, life = 0.55, size = 3) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.9);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      t: 0, life: life * (0.6 + Math.random() * 0.7),
      color, size: size * (0.6 + Math.random() * 0.8),
    });
  }
  if (G.particles.length > 420) G.particles.splice(0, G.particles.length - 420);
}

export function floater(G, x, y, text, color = '#ffd60a') {
  G.floaters.push({ x, y, text, color, t: 0 });
  if (G.floaters.length > 12) G.floaters.shift();
}

export function updateEffects(G, dt) {
  for (const p of G.particles) {
    p.t += dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.max(0, 1 - 3.2 * dt); p.vy *= Math.max(0, 1 - 3.2 * dt);
  }
  G.particles = G.particles.filter(p => p.t < p.life);
  for (const f of G.floaters) { f.t += dt; f.y -= 34 * dt; }
  G.floaters = G.floaters.filter(f => f.t < 1.4);
  for (const s of G.skids) s.a -= dt * 0.012;
  G.skids = G.skids.filter(s => s.a > 0.03);
}

export function drawEffects(ctx, G, camX, camY) {
  // skid marks under everything mobile
  ctx.fillStyle = '#26262a';
  for (const s of G.skids) {
    ctx.globalAlpha = Math.min(0.55, s.a);
    ctx.fillRect(s.x - camX - 2.5, s.y - camY - 2.5, 5, 5);
  }
  ctx.globalAlpha = 1;
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camX - p.size / 2, p.y - camY - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.4);
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 3;
    const sx = f.x - camX, sy = f.y - camY;
    ctx.strokeText(f.text, sx, sy);
    ctx.fillText(f.text, sx, sy);
  }
  ctx.globalAlpha = 1;
}
