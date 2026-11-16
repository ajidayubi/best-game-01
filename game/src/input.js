// Keyboard and mouse state for Ember Drift. The game reads this once per
// fixed step: held keys for movement, edge-triggered presses for menus, and
// the mouse position in canvas coordinates for steering and clicking.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouseDown = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      this.mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
  }

  // Consume edge-triggered presses after each step so a single press acts once.
  endStep() {
    this.pressed.clear();
    this.mouseClicked = false;
  }

  held(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  axisX() {
    let x = 0;
    if (this.held('ArrowLeft') || this.held('KeyA')) x -= 1;
    if (this.held('ArrowRight') || this.held('KeyD')) x += 1;
    return x;
  }

  axisY() {
    let y = 0;
    if (this.held('ArrowUp') || this.held('KeyW')) y -= 1;
    if (this.held('ArrowDown') || this.held('KeyS')) y += 1;
    return y;
  }

  firing() {
    return this.held('Space') || this.mouseDown;
  }

  // Steering target for mouse players: null when the mouse never moved.
  mouseTarget() {
    if (this.mouseX === 0 && this.mouseY === 0) return null;
    return { x: this.mouseX, y: this.mouseY };
  }
}

// Deterministic stand-in for the real input, used by the screenshot scenes:
// a pure function of the tick, so the same seed always flies the same path.
export function scriptedInput(tick) {
  const t = tick / 60;
  const angle = t * 0.9;
  const ax = Math.cos(angle) * 0.8;
  const ay = Math.sin(angle * 0.7) * 0.6;
  return {
    axisX: () => ax,
    axisY: () => ay,
    firing: () => true,
    mouseTarget: () => null,
    wasPressed: () => false,
    endStep: () => {},
  };
}
