// Dunia game: state machine TITLE -> PLAY -> WIN / LOSE, meter alarm,
// strike ketahuan, skor + grade, dan semua aturan heist yang dimainkan
// autopilot maupun manusia — satu-satunya sumber kebenaran aturan.
import { LOOT_DEFS, EXIT_DEF, DETECTION, TOOLS, SCORING, gradeFor, SPOTLIGHT_DEFS, SHOT_SEED } from './config.js';
import { inDarkZone } from './level.js';
import { STATE_ALERT } from './guards.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WIN = 'win';
export const SCREEN_LOSE = 'lose';

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export class World {
  constructor(deps) {
    this.level = deps.level;
    this.player = deps.player;
    this.squad = deps.squad;
    this.cctv = deps.cctv;
    this.loot = deps.loot;
    this.sound = deps.sound;
    this.hud = deps.hud;
    this.screen = SCREEN_TITLE;
    this.time = 0;
    this.elapsed = 0;
    this.alarm = 0;
    this.strikes = 0;
    this.score = 0;
    this.decoysLeft = TOOLS.decoyCount;
    this.best = 0;
    this.winStats = null;
    this.loseStats = null;
    this.lastCaughtAt = -10;
    this.spotBoost = false;
    this.reset();
  }

  reset() {
    this.screen = SCREEN_TITLE;
    this.time = 0;
    this.elapsed = 0;
    this.alarm = 0;
    this.strikes = 0;
    this.score = 0;
    this.decoysLeft = TOOLS.decoyCount;
    this.winStats = null;
    this.loseStats = null;
    this.lastCaughtAt = -10;
    this.player.reset();
    this.squad.reset();
    this.cctv.reset();
    this.loot.reset(this.level);
  }

  startGame() {
    this.reset();
    this.screen = SCREEN_PLAY;
    this.sound.ensure();
    this.hud.show(SCREEN_PLAY);
    this.hud.banner('MISI: curi 3 artefak, lalu kabur lewat EXIT selatan!', 3600);
  }

  // Posisi sorot panggung di lantai pada waktu `t` (rumus sama dengan level.js).
  spotCenters(t) {
    return SPOTLIGHT_DEFS.map((def) => {
      const angle = def.baseAngle + Math.sin(t * def.speed) * def.sweep;
      return {
        x: def.x + Math.sin(angle) * 6.5,
        z: def.z + Math.cos(angle) * 6.5 * 0.6,
        radius: def.radius,
      };
    });
  }

  playerInSpotlight() {
    return this.playerInSpotlightAt(this.player.x, this.player.z);
  }

  playerInSpotlightAt(x, z) {
    const centers = this.spotCenters(this.time);
    for (const c of centers) {
      if (Math.hypot(x - c.x, z - c.z) < c.radius) return true;
    }
    return false;
  }

  step(dt, input) {
    this.time += dt;
    this.level.update(this.time);
    if (this.screen !== SCREEN_PLAY) {
      // Di layar judul pun dunia hidup sedikit: penjaga berpatroli di latar.
      if (this.screen === SCREEN_TITLE) {
        this.squad.step(dt, this.player, false);
        this.cctv.step(dt, this.player);
      }
      return;
    }
    this.elapsed += dt;

    // Gerakan pemain.
    const move = input.moveVector();
    this.player.step(dt, move, this.sound);
    if (this.player.moving) this.sound.ensure();

    // Alat: koin pengalih (Q).
    if (input.wasPressed('q') && this.decoysLeft > 0) {
      const point = this.loot.throwDecoy(this.player.x, this.player.z, this.player.angle);
      this.decoysLeft -= 1;
      this.sound.decoy();
      for (const guard of this.squad.all) {
        const d = Math.hypot(guard.x - point.x, guard.z - point.z);
        if (d < TOOLS.decoyLureRadius) guard.lure(point.x, point.z, TOOLS.decoyInvestigateSeconds);
      }
      this.hud.banner('Koin pengalih dilempar — penjaga memeriksa bunyinya!');
    }

    // Ambil loot (E).
    if (input.wasPressed('e')) {
      const got = this.loot.tryPickup(this.player.x, this.player.z);
      if (got) {
        this.score += got.points;
        this.level.setLootTaken(got.id);
        this.sound.pickup();
        this.hud.banner(`${got.name} dicuri! (${this.loot.count}/3)`);
        if (this.loot.allTaken) {
          this.loot.exitOpen = true;
          this.level.setExitOpen(true);
          this.sound.exitOpen();
          this.hud.banner('SEMUA ARTEFAK DIDAPAT — EXIT TERBUKA! KABUR!', 4000);
        }
      }
    }

    this.spotBoost = this.playerInSpotlight();
    this.squad.step(dt, this.player, this.spotBoost);
    this.cctv.step(dt, this.player);
    this.loot.step(dt);

    // Meter alarm: naik saat terlihat penjaga/kamera, turun saat sembunyi.
    const seenByGuard = this.squad.anySeesPlayer();
    const seenByCamera = this.cctv.anySeesPlayer();
    if (seenByGuard || seenByCamera) {
      let rise = seenByGuard ? DETECTION.alarmRisePerSecond : 0;
      if (seenByCamera) rise += DETECTION.cameraAlarmRisePerSecond;
      if (this.spotBoost) rise *= 1.4;
      if (this.player.sneaking) rise *= 0.6;
      this.alarm = Math.min(DETECTION.alarmCatchAt, this.alarm + rise * dt);
      if (this.alarm > 60 && this.alarm - rise * dt <= 60) this.sound.alarmSting();
    } else {
      const fall = inDarkZone(this.player.x, this.player.z)
        ? DETECTION.alarmFallDarkPerSecond
        : DETECTION.alarmFallPerSecond;
      this.alarm = Math.max(0, this.alarm - fall * dt);
    }

    // Ketahuan: alarm penuh, atau penjaga siaga menyentuh pencuri.
    let caught = this.alarm >= DETECTION.alarmCatchAt;
    if (!caught) {
      for (const guard of this.squad.all) {
        if (guard.state === STATE_ALERT &&
            Math.hypot(guard.x - this.player.x, guard.z - this.player.z) < DETECTION.catchRadius) {
          caught = true;
          break;
        }
      }
    }
    if (caught && this.time - this.lastCaughtAt > 1.5) this.onCaught();

    // Menang: semua loot + masuk zona EXIT.
    if (this.loot.allTaken && this.loot.nearExit(this.player.x, this.player.z)) {
      this.onWin();
      return;
    }

    this.updateHud(dt);
  }

  onCaught() {
    this.lastCaughtAt = this.time;
    this.strikes += 1;
    this.sound.caught();
    if (this.strikes >= DETECTION.strikesToLose) {
      this.screen = SCREEN_LOSE;
      this.loseStats = { lootCount: this.loot.count, timeText: formatTime(this.elapsed) };
      this.sound.lose();
      this.hud.show(SCREEN_LOSE);
      this.hud.showLose(this.loseStats);
      return;
    }
    this.alarm = 35;
    this.player.reset();
    this.squad.reset();
    this.hud.banner(`KETAHUAN! Strike ${this.strikes}/3 — kembali ke pintu masuk!`, 3200);
  }

  onWin() {
    this.screen = SCREEN_WIN;
    const timeBonus = Math.max(0, Math.round(300 - this.elapsed)) * SCORING.timeBonusPerSecond;
    this.score += SCORING.winBonus + timeBonus - this.strikes * SCORING.strikePenalty;
    const grade = gradeFor(this.elapsed, this.strikes);
    this.winStats = {
      grade,
      score: this.score,
      timeText: formatTime(this.elapsed),
      strikes: this.strikes,
      message: grade === 'S'
        ? 'Pencurian sempurna — tak satu pun penjaga sadar!'
        : grade === 'A'
          ? 'Pencurian bersih — museum tak tahu apa yang hilang.'
          : grade === 'B'
            ? 'Berhasil kabur, tapi alarm sempat meraung.'
            : 'Kabur di ujung tanduk — lain kali lebih rapi!',
    };
    if (this.score > this.best) this.best = this.score;
    this.sound.win();
    this.hud.show(SCREEN_WIN);
    this.hud.showWin(this.winStats);
  }

  updateHud(dt) {
    const near = this.loot.nearestLoot(this.player.x, this.player.z);
    this.hud.update(dt, {
      lootCount: this.loot.count,
      elapsed: this.elapsed,
      decoys: this.decoysLeft,
      strikes: this.strikes,
      alarm: this.alarm,
      nearLoot: near && near.dist < 2.1 ? near.loot.name : null,
      nearExit: this.loot.nearExit(this.player.x, this.player.z),
      exitOpen: this.loot.exitOpen,
      guards: this.squad.all,
      cameras: this.cctv.cameras,
      takenLoot: this.loot.taken,
      playerX: this.player.x,
      playerZ: this.player.z,
    });
  }

  // Snapshot ringkas untuk autopilot & screenshot.
  snapshot() {
    return {
      screen: this.screen,
      elapsed: this.elapsed,
      alarm: this.alarm,
      strikes: this.strikes,
      lootCount: this.loot.count,
      score: this.score,
      winStats: this.winStats,
      loseStats: this.loseStats,
    };
  }
}
