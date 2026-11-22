// Museum Malam: Mahkota Firaun — bootstrap: rakit renderer, level, dunia,
// lalu loop game (fixed-step) atau adegan screenshot deterministik (?shot=).
import { Renderer3D } from './render.js';
import { Level } from './level.js';
import { Thief } from './player.js';
import { GuardSquad } from './guards.js';
import { CctvSystem } from './cameras.js';
import { LootSystem } from './loot.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { World, SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN, SCREEN_LOSE } from './world.js';
import { stageShot } from './shots.js';
import { STEP } from './config.js';

const canvas = document.getElementById('game');
const renderer = new Renderer3D(canvas);
const level = new Level(renderer.scene);
const player = new Thief(renderer.scene);
const squad = new GuardSquad(renderer.scene);
const cctv = new CctvSystem(renderer.scene);
const loot = new LootSystem(renderer.scene);
const sound = new SoundBank();
const hud = new Hud();
const world = new World({ level, player, squad, cctv, loot, sound, hud });
const input = new Input();

hud.setTitleStats(world.best);
hud.show(SCREEN_TITLE);

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

// Mode screenshot: jalankan adegan secara sinkron lalu render satu frame,
// plus render ulang di 3 frame rAF berikutnya — frame yang dirender saat
// modul dievaluasi (sebelum paint pertama) tidak selalu sampai ke compositor
// headless, sedangkan frame rAF ter-presentasi seperti mode interaktif.
if (shot) {
  const staged = stageShot(shot, world);
  renderer.render();
  // Render kontinu beberapa frame: compositor headless hanya mengambil frame
  // WebGL yang di-presentasi berulang (render sekali saat load tidak sampai
  // ke screenshot — terbukti di mode interaktif yang me-render tiap frame).
  let extraFrames = 30;
  const reRender = () => {
    renderer.render();
    extraFrames -= 1;
    if (extraFrames > 0) requestAnimationFrame(reRender);
  };
  requestAnimationFrame(reRender);
  window.__shot = { name: shot, screen: staged.screen, snapshot: staged.snapshot };
  window.__shotDone = true;
} else {
  // Tombol layar.
  const bind = (id, fn) => {
    const node = document.getElementById(id);
    if (node) node.addEventListener('click', fn);
  };
  bind('btn-start', () => world.startGame());
  bind('btn-again-win', () => world.startGame());
  bind('btn-again-lose', () => world.startGame());

  let paused = false;
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (input.wasPressed('m')) {
      sound.setMuted(!sound.muted);
      const node = document.getElementById('hud-mute');
      if (node) node.textContent = sound.muted ? 'Suara: MATI (M)' : 'Suara: HIDUP (M)';
    }
    if (input.wasPressed('p') && world.screen === SCREEN_PLAY) paused = !paused;
    if ((input.wasPressed('Enter') || input.wasPressed('r'))) {
      if (world.screen === SCREEN_TITLE) world.startGame();
      else if (world.screen === SCREEN_WIN || world.screen === SCREEN_LOSE) world.startGame();
    }
    if (!paused) {
      acc += dt;
      while (acc >= STEP) {
        world.step(STEP, input);
        acc -= STEP;
      }
    }
    if (world.screen === SCREEN_PLAY && paused) {
      hud.banner('JEDA — tekan P untuk lanjut', 500);
    }
    input.endFrame();
    renderer.render();
  }
  requestAnimationFrame(frame);
}

// Untuk debugging / playtest otomatis di console.
window.__game = { world, renderer };
