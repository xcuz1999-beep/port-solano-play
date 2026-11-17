// input.js — keyboard and mouse state. The game reads `keys` (held), `pressed`
// (edge-triggered, cleared each frame by main) and the mouse aim point.

export const keys = {};
export const pressed = {};
export const mouse = { x: 0, y: 0, down: false, clicked: false };

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { mouse.down = true; mouse.clicked = true; });
  addEventListener('mouseup', () => { mouse.down = false; });
}

export function endFrameInput() {
  for (const k in pressed) pressed[k] = false;
  mouse.clicked = false;
}

// Movement axes shared by walking and driving: x from A/D or arrows, y from W/S.
export function moveAxis() {
  const x = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const y = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  return { x, y };
}
