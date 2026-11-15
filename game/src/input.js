// EMBER DRIFT — input.js
// Keyboard (arrows / WASD to move, Space to shoot, P or Esc to pause, M to mute,
// Enter to start or restart) plus mouse (the skiff follows the pointer, click to shoot).

export class InputState {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseX = null;
    this.mouseY = null;
    this.mouseDown = false;
    this.mouseActive = false;
    this.pressed = new Set();
    this.canvas = canvas;
    this.onPause = null;
    this.onConfirm = null;
    this.onMute = null;
    this.attachListeners();
  }

  attachListeners() {
    window.addEventListener('keydown', (event) => {
      const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '];
      if (gameKeys.includes(event.key)) event.preventDefault();
      if (!event.repeat) this.pressed.add(event.key.toLowerCase());
      this.keys.add(event.key.toLowerCase());
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') {
        if (this.onPause) this.onPause();
      }
      if (event.key === 'Enter' && this.onConfirm) this.onConfirm();
      if ((event.key === 'm' || event.key === 'M') && this.onMute) this.onMute();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.key.toLowerCase());
    });
    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      this.mouseY = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      this.mouseActive = true;
    });
    this.canvas.addEventListener('mousedown', (event) => {
      if (event.button === 0) this.mouseDown = true;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  consumePressed(key) {
    const found = this.pressed.has(key);
    if (found) this.pressed.delete(key);
    return found;
  }

  clearPressed() {
    this.pressed.clear();
  }

  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) x -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) x += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) y -= 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) y += 1;
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  isShooting() {
    return this.keys.has(' ') || this.mouseDown;
  }
}
