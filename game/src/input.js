// Keyboard and mouse state for the game.
// The world reads plain fields (moveX, moveY, aimX, aimY, firing) once per step, so the
// screenshot autopilot in shots.js can drive the exact same interface with fake input.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    moveX: 0,
    moveY: 0,
    aimX: 640,
    aimY: 300,
    mouseDown: false,
    pressed: new Set(), // keys that went down since the last step (edge triggers)
    clicked: null, // field coordinates of the latest click, consumed by main.js
    muted: false,
  };

  /** Convert a mouse event to logical field coordinates using the canvas letterbox. */
  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 800);
    const shownWidth = 1280 * scale;
    const shownHeight = 800 * scale;
    const x = (event.clientX - rect.left - (rect.width - shownWidth) / 2) / scale;
    const y = (event.clientY - rect.top - (rect.height - shownHeight) / 2) / scale;
    return { x: Math.max(0, Math.min(1280, x)), y: Math.max(0, Math.min(800, y)) };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const point = toField(event);
    input.aimX = point.x;
    input.aimY = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toField(event);
    input.aimX = point.x;
    input.aimY = point.y;
    input.mouseDown = true;
    input.clicked = point;
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    const point = toField(touch);
    input.aimX = point.x;
    input.aimY = point.y;
    input.mouseDown = true;
    input.clicked = point;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    const touch = event.touches[0];
    const point = toField(touch);
    input.aimX = point.x;
    input.aimY = point.y;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', () => {
    input.mouseDown = false;
  });

  /** Refresh the held-direction axes from the key set. Call once per frame. */
  input.poll = function poll() {
    const left = input.keys.has('KeyA') || input.keys.has('ArrowLeft');
    const right = input.keys.has('KeyD') || input.keys.has('ArrowRight');
    const up = input.keys.has('KeyW') || input.keys.has('ArrowUp');
    const down = input.keys.has('KeyS') || input.keys.has('ArrowDown');
    input.moveX = (right ? 1 : 0) - (left ? 1 : 0);
    input.moveY = (down ? 1 : 0) - (up ? 1 : 0);
  };

  /** Whether the player is holding fire: mouse button, or Space as a keyboard fallback. */
  input.firing = function firing() {
    return input.mouseDown || input.keys.has('Space');
  };

  /** Take (and clear) an edge-triggered key press, e.g. 'Enter', 'KeyR', 'KeyP'. */
  input.takePress = function takePress(code) {
    if (!input.pressed.has(code)) return false;
    input.pressed.delete(code);
    return true;
  };

  input.clearPresses = function clearPresses() {
    input.pressed.clear();
  };

  return input;
}
