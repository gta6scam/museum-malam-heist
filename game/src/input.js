// Input keyboard + mouse: WASD/panah bergerak, Shift mengendap,
// E ambil loot, Q lempar pengalih, M mute, R/Enter mulai & ulang, P jeda.
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.onKey = this.onKey.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouse = this.onMouse.bind(this);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouse);
  }

  onKey(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) this.pressed.add(key);
    this.keys.add(key);
  }

  onKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    this.keys.delete(key);
  }

  onMouse(event) {
    this.mouseX = event.clientX;
    this.mouseY = event.clientY;
  }

  down(key) {
    return this.keys.has(key);
  }

  // Sekali tekan sejak frame terakhir (dipanggil tiap step lalu dibersihkan).
  wasPressed(key) {
    return this.pressed.has(key);
  }

  endFrame() {
    this.pressed.clear();
  }

  moveVector() {
    let x = 0;
    let z = 0;
    if (this.down('a') || this.down('ArrowLeft')) x -= 1;
    if (this.down('d') || this.down('ArrowRight')) x += 1;
    if (this.down('w') || this.down('ArrowUp')) z -= 1;
    if (this.down('s') || this.down('ArrowDown')) z += 1;
    const len = Math.hypot(x, z);
    if (len > 0) {
      x /= len;
      z /= len;
    }
    return { x, z, sneaking: this.down('Shift') };
  }
}
