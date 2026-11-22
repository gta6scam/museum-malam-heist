// Adegan screenshot deterministik (?shot=start|play|climax|end).
// Setiap adegan memainkan aturan asli dari state segar dengan seed tetap:
// start = latar judul, play = 14 detik autopilot, climax = momen mid-heist
// (loot sudah diambil + alarm naik + penjaga dekat), end = autopilot sampai WIN.
import { STEP, SHOT_SEED } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './world.js';
import { Autopilot } from './autopilot.js';

class PilotInput {
  constructor() {
    this.move = { x: 0, z: 0, sneaking: false };
    this.pressE = false;
  }

  set(decision) {
    this.move = { x: decision.x, z: decision.z, sneaking: decision.sneaking };
    this.pressE = decision.pressE;
  }

  moveVector() {
    return this.move;
  }

  wasPressed(key) {
    if (key === 'e') return this.pressE;
    return false;
  }

  endFrame() {}
}

function runAutopilot(world, seconds, stopWhen) {
  const pilot = new Autopilot(world);
  const input = new PilotInput();
  const steps = Math.floor(seconds / STEP);
  // Keputusan arah dihitung ulang tiap 5 langkah (0,08 dtk) — cukup responsif
  // dan jauh lebih murah daripada menilai 9 arah tiap langkah.
  let decision = { x: 0, z: 0, sneaking: false, pressE: false };
  for (let i = 0; i < steps; i += 1) {
    if (world.screen !== SCREEN_PLAY) break;
    if (i % 5 === 0) decision = pilot.decide();
    // Tekan E diperiksa tiap langkah agar loot tak terlewat di antara keputusan.
    const near = world.loot.nearestLoot(world.player.x, world.player.z);
    decision.pressE = near !== null && near.dist < 1.9;
    input.set(decision);
    world.step(STEP, input);
    if (stopWhen && stopWhen(world)) break;
  }
  return world.snapshot();
}

export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    world.startGame();
    runAutopilot(world, 14);
    return { screen: SCREEN_PLAY, snapshot: world.snapshot() };
  }
  if (name === 'climax') {
    world.startGame();
    // Maju sampai momen tegang: sudah mencuri 1 artefak, alarm naik,
    // dan ada penjaga dalam jarak 9 unit — atau 25 detik, mana dulu.
    // (Autopilot menang ~29 detik, jadi cap harus di bawah itu agar frame
    // tetap mid-heist, bukan layar kemenangan.)
    const snap = runAutopilot(world, 25, (w) => {
      if (w.loot.count < 1 || w.alarm < 15) return false;
      return w.squad.all.some((g) => Math.hypot(g.x - w.player.x, g.z - w.player.z) < 9);
    });
    return { screen: SCREEN_PLAY, snapshot: snap };
  }
  if (name === 'end') {
    world.startGame();
    const snap = runAutopilot(world, 420);
    return { screen: world.screen, snapshot: snap };
  }
  // start: latar judul hidup 5 detik (penjaga berpatroli di balik layar judul).
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, new PilotInput());
  world.hud.show(SCREEN_TITLE);
  return { screen: SCREEN_TITLE, snapshot: world.snapshot() };
}
