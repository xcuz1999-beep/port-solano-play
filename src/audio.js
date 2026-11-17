// audio.js — all sound is synthesized with WebAudio: engine hum, two-tone
// sirens, gunshots, impacts, pickups and UI clicks. No audio files, so the
// game stays fully offline. Sounds start on the first user gesture.

import { G } from './state.js';

let ctx = null;
let engineOsc = null, engineGain = null;
let sirenOsc = null, sirenGain = null, sirenTimer = 0;

export function initAudio() {
  if (ctx) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    engineOsc.connect(lp).connect(engineGain).connect(ctx.destination);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenGain = ctx.createGain();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain).connect(ctx.destination);
    sirenOsc.start();
  } catch { ctx = null; }
}

function blip(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  if (!ctx || G.muted) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
  g.gain.setValueAtTime(vol, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start(); o.stop(ctx.currentTime + dur);
}

function noise(dur, vol = 0.2, freq = 1200) {
  if (!ctx || G.muted) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start();
}

export const sfx = {
  click() { blip(660, 0.06, 'square', 0.08); },
  pickup() { blip(880, 0.09, 'square', 0.1); setTimeout(() => blip(1320, 0.12, 'square', 0.1), 60); },
  cash() { blip(1040, 0.07, 'triangle', 0.14); setTimeout(() => blip(1560, 0.1, 'triangle', 0.12), 55); },
  shot() { noise(0.09, 0.25, 2600); blip(160, 0.06, 'square', 0.1, -90); },
  dryFire() { blip(300, 0.04, 'square', 0.07); },
  hit() { noise(0.06, 0.16, 700); },
  punch() { noise(0.08, 0.2, 500); blip(90, 0.07, 'sine', 0.16, -40); },
  crash(strength = 1) { noise(0.18, Math.min(0.4, 0.12 + strength * 0.2), 500); blip(70, 0.16, 'sine', 0.2, -30); },
  door() { blip(220, 0.05, 'square', 0.09); setTimeout(() => blip(180, 0.05, 'square', 0.08), 70); },
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.13), i * 90)); },
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.12), i * 100)); },
  wanted() { blip(1175, 0.1, 'square', 0.1); setTimeout(() => blip(1175, 0.1, 'square', 0.1), 140); },
};

// Called every frame: engine pitch follows the player's car speed, the siren
// wails while police are near and the player is wanted.
export function updateAudio(dt, speedRatio, sirenNear) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const eg = G.muted ? 0 : (G.player && G.player.car ? 0.05 + Math.abs(speedRatio) * 0.05 : 0);
  engineGain.gain.setTargetAtTime(eg, t, 0.08);
  if (engineOsc) engineOsc.frequency.setTargetAtTime(52 + Math.abs(speedRatio) * 130, t, 0.06);
  sirenTimer += dt;
  const sg = G.muted ? 0 : (sirenNear && G.wanted > 0 ? 0.028 : 0);
  sirenGain.gain.setTargetAtTime(sg, t, 0.1);
  if (sirenOsc) sirenOsc.frequency.setTargetAtTime(700 + Math.sin(sirenTimer * 5.2) * 190, t, 0.03);
}
