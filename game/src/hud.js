// HUD DOM: loot, waktu, meter alarm, strike, pengalih, status penjaga,
// banner peringatan, minimap 2D, dan layar TITLE / WIN / LOSE.
// Semua teks Bahasa Indonesia; HUD ringkas di tepi agar scene 3D mengisi frame.
import { LOOT_DEFS, EXIT_DEF, ROOM, OBSTACLES, DARK_ZONES } from './config.js';
import { STATE_ALERT, STATE_SUSPICIOUS } from './guards.js';

function el(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor() {
    this.minimap = el('minimap');
    this.mm = this.minimap ? this.minimap.getContext('2d') : null;
    this.bannerTimer = 0;
    this.lastGuardStatus = '';
  }

  show(screen) {
    for (const name of ['title', 'win', 'lose']) {
      const node = el(`screen-${name}`);
      if (node) node.style.display = name === screen ? 'flex' : 'none';
    }
    const hud = el('hud');
    if (hud) hud.style.display = screen === 'play' ? 'block' : 'none';
  }

  setTitleStats(best) {
    const node = el('title-best');
    if (node) node.textContent = best ? `Rekor: ${best} poin` : 'Belum ada rekor — jadilah pencuri pertama!';
  }

  banner(text, ms = 2600) {
    const node = el('banner');
    if (!node) return;
    node.textContent = text;
    node.style.display = 'block';
    this.bannerTimer = ms;
  }

  update(dt, state) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt * 1000;
      if (this.bannerTimer <= 0) {
        const node = el('banner');
        if (node) node.style.display = 'none';
      }
    }
    const lootNode = el('hud-loot');
    if (lootNode) lootNode.textContent = `${state.lootCount}/3 Artefak`;
    const timeNode = el('hud-time');
    if (timeNode) {
      const total = Math.floor(state.elapsed);
      const mm = String(Math.floor(total / 60)).padStart(2, '0');
      const ss = String(total % 60).padStart(2, '0');
      timeNode.textContent = `${mm}:${ss}`;
    }
    const decoyNode = el('hud-decoy');
    if (decoyNode) decoyNode.textContent = `Koin: ${state.decoys}`;
    const strikeNode = el('hud-strike');
    if (strikeNode) strikeNode.textContent = `Ketahuan: ${'●'.repeat(state.strikes)}${'○'.repeat(3 - state.strikes)}`;
    const alarmFill = el('alarm-fill');
    if (alarmFill) {
      alarmFill.style.width = `${Math.round(state.alarm)}%`;
      alarmFill.style.background = state.alarm > 70 ? '#ff2a2a' : state.alarm > 35 ? '#ffb020' : '#2dff7a';
    }
    const alarmLabel = el('alarm-label');
    if (alarmLabel) {
      alarmLabel.textContent = state.alarm > 70 ? 'TERLIHAT!' : state.alarm > 35 ? 'CURIGA…' : 'AMAN';
    }
    const hint = el('hud-hint');
    if (hint) {
      if (state.nearLoot) hint.textContent = `Tekan E — ambil ${state.nearLoot}`;
      else if (state.exitOpen && state.nearExit) hint.textContent = 'KABUR! Masuk pintu EXIT hijau!';
      else if (state.exitOpen) hint.textContent = 'EXIT TERBUKA — kabur ke pintu selatan!';
      else hint.textContent = 'WASD gerak · Shift mengendap · E ambil · Q koin pengalih · M suara';
    }
    // Status penjaga: nama + tanda ! bila mengejar.
    const parts = [];
    for (const guard of state.guards) {
      const mark = guard.state === STATE_ALERT ? ' !' : guard.state === STATE_SUSPICIOUS ? ' ?' : '';
      parts.push(`${guard.name}${mark}`);
    }
    const status = parts.join(' · ');
    if (status !== this.lastGuardStatus) {
      this.lastGuardStatus = status;
      const node = el('hud-guards');
      if (node) node.textContent = status;
    }
    this.drawMinimap(state);
  }

  drawMinimap(state) {
    if (!this.mm) return;
    const g = this.mm;
    const W = this.minimap.width;
    const H = this.minimap.height;
    const sx = W / ROOM.width;
    const sz = H / ROOM.depth;
    const toX = (x) => (x + ROOM.width / 2) * sx;
    const toZ = (z) => (z + ROOM.depth / 2) * sz;
    g.fillStyle = '#0d0d18';
    g.fillRect(0, 0, W, H);
    // Zona gelap.
    g.fillStyle = '#232338';
    for (const zone of DARK_ZONES) {
      g.fillRect(toX(zone.minX), toZ(zone.minZ), (zone.maxX - zone.minX) * sx, (zone.maxZ - zone.minZ) * sz);
    }
    // Penghalang.
    g.fillStyle = '#5a5470';
    for (const box of OBSTACLES) {
      g.fillRect(toX(box.minX), toZ(box.minZ), (box.maxX - box.minX) * sx, (box.maxZ - box.minZ) * sz);
    }
    // EXIT.
    g.fillStyle = state.exitOpen ? '#2dff7a' : '#3a6a4a';
    g.fillRect(toX(EXIT_DEF.x - 2.2), toZ(EXIT_DEF.z - 1), 4.4 * sx, 2 * sz);
    // Loot.
    for (const loot of LOOT_DEFS) {
      if (state.takenLoot.has(loot.id)) continue;
      g.fillStyle = '#ffd700';
      g.beginPath();
      g.arc(toX(loot.x), toZ(loot.z), 4, 0, Math.PI * 2);
      g.fill();
    }
    // Kamera CCTV.
    g.fillStyle = '#ff5566';
    for (const cam of state.cameras) {
      g.beginPath();
      g.arc(toX(cam.x), toZ(cam.z), 3, 0, Math.PI * 2);
      g.fill();
    }
    // Penjaga + anjing: segitiga merah mengarah ke hadap.
    for (const guard of state.guards) {
      g.fillStyle = guard.state === STATE_ALERT ? '#ff2a2a' : '#ff8c1a';
      const px = toX(guard.x);
      const pz = toZ(guard.z);
      const a = guard.angle;
      g.beginPath();
      g.moveTo(px + Math.sin(a) * 6, pz - Math.cos(a) * 6);
      g.lineTo(px + Math.sin(a + 2.5) * 5, pz - Math.cos(a + 2.5) * 5);
      g.lineTo(px + Math.sin(a - 2.5) * 5, pz - Math.cos(a - 2.5) * 5);
      g.closePath();
      g.fill();
    }
    // Pemain: titik hijau terang + cincin.
    g.fillStyle = '#2dff7a';
    g.beginPath();
    g.arc(toX(state.playerX), toZ(state.playerZ), 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2dff7a';
    g.beginPath();
    g.arc(toX(state.playerX), toZ(state.playerZ), 8, 0, Math.PI * 2);
    g.stroke();
    // Bingkai.
    g.strokeStyle = '#c9a227';
    g.lineWidth = 2;
    g.strokeRect(1, 1, W - 2, H - 2);
  }

  showWin(stats) {
    const grade = el('win-grade');
    if (grade) grade.textContent = `GRADE ${stats.grade}`;
    const lines = el('win-stats');
    if (lines) {
      lines.innerHTML = `Waktu: <b>${stats.timeText}</b> · Ketahuan: <b>${stats.strikes}x</b> · Loot: <b>3/3</b><br>` +
        `Skor: <b>${stats.score}</b> poin · ${stats.message}`;
    }
  }

  showLose(stats) {
    const lines = el('lose-stats');
    if (lines) {
      lines.innerHTML = `Ketahuan 3 kali — alarm museum meraung, polisi sudah di jalan.<br>` +
        `Loot: <b>${stats.lootCount}/3</b> · Waktu bertahan: <b>${stats.timeText}</b>`;
    }
  }
}
