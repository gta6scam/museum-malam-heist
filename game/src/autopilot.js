// Autopilot: memainkan aturan asli dari state segar — tanpa override.
// Dua lapis: (1) A* di grid 1 unit untuk rute statis memutari dinding/etalase
// (steering lokal saja buta terhadap halangan — pernah parkir menabrak bangku);
// (2) steering lokal 9 arah menuju simpul jalur berikutnya, menimbang bahaya
// kerucut penjaga/kamera yang bergerak. Bila semua arah berbahaya, ia menunggu
// sampai kerucut menyapu pergi; bila macet 4 detik, mode DASH. Menekan E saat
// dekat loot. Saat dikejar, LARI (bukan mengendap — mengendap lebih lambat
// dari anjing yang mengejar).
import { LOOT_DEFS, EXIT_DEF, DETECTION, OBSTACLES, ROOM } from './config.js';
import { lineBlocked, pointInBox } from './level.js';

const DIRECTIONS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

const GRID = 1.0;
const GRID_MIN_X = -21;
const GRID_MAX_X = 21;
const GRID_MIN_Z = -13;
const GRID_MAX_Z = 13;
const WALK_MARGIN = 0.7;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Apakah titik (x, z) bisa dipijak pencuri (di luar semua penghalang + margin)?
export function walkableAt(x, z) {
  if (Math.abs(x) > ROOM.width / 2 - 0.7 || Math.abs(z) > ROOM.depth / 2 - 0.7) return false;
  for (const box of OBSTACLES) {
    if (x >= box.minX - WALK_MARGIN && x <= box.maxX + WALK_MARGIN &&
        z >= box.minZ - WALK_MARGIN && z <= box.maxZ + WALK_MARGIN) return false;
  }
  return true;
}

function cellKey(cx, cz) {
  return `${cx},${cz}`;
}

// A* 8 arah di grid 1 unit; kembalikan daftar simpul [x, z] (tengah sel).
// `dangerFn(x, z)` memberi biaya tambahan per sel (kerucut penjaga/kamera
// saat ini) — jalur strategis memutar menghindari cone, bukan menembusnya.
// Heuristik oktil tetap admissible karena biaya bahaya >= 0.
export function findPath(fromX, fromZ, toX, toZ, dangerFn = null) {
  const sx = Math.round(fromX);
  const sz = Math.round(fromZ);
  const tx = Math.round(toX);
  const tz = Math.round(toZ);
  const startKey = cellKey(sx, sz);
  const goalKey = cellKey(tx, tz);
  const open = [{ x: sx, z: sz, g: 0, f: 0, parent: null }];
  const cameFrom = new Map();
  const costSoFar = new Map();
  cameFrom.set(startKey, null);
  costSoFar.set(startKey, 0);
  const heuristic = (x, z) => {
    const dx = Math.abs(x - tx);
    const dz = Math.abs(z - tz);
    return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
  };
  let goal = null;
  let guard = 0;
  while (open.length > 0 && guard < 6000) {
    guard += 1;
    let bestIdx = 0;
    for (let i = 1; i < open.length; i += 1) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];
    const currentKey = cellKey(current.x, current.z);
    if (currentKey === goalKey) {
      goal = current;
      break;
    }
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dz === 0) continue;
        const nx = current.x + dx;
        const nz = current.z + dz;
        if (nx < GRID_MIN_X || nx > GRID_MAX_X || nz < GRID_MIN_Z || nz > GRID_MAX_Z) continue;
        if (!walkableAt(nx, nz)) continue;
        // Jangan memotong sudut dinding secara diagonal.
        if (dx !== 0 && dz !== 0 && (!walkableAt(current.x + dx, current.z) || !walkableAt(current.x, current.z + dz))) continue;
        const stepCost = dx !== 0 && dz !== 0 ? 1.4142 : 1;
        const extra = dangerFn ? dangerFn(nx, nz) : 0;
        const newCost = costSoFar.get(currentKey) + stepCost + extra;
        const nKey = cellKey(nx, nz);
        if (!costSoFar.has(nKey) || newCost < costSoFar.get(nKey)) {
          costSoFar.set(nKey, newCost);
          cameFrom.set(nKey, currentKey);
          open.push({ x: nx, z: nz, g: newCost, f: newCost + heuristic(nx, nz), parent: currentKey });
        }
      }
    }
  }
  if (!goal && !cameFrom.has(goalKey)) return [[toX, toZ]];
  // Rekonstruksi jalur dari peta orang-tua.
  const path = [];
  let key = goal ? cellKey(goal.x, goal.z) : goalKey;
  // Bila goal tak tercapai persis, pakai sel terdekat yang tercatat.
  if (!cameFrom.has(key)) {
    let bestKey = startKey;
    let bestH = Infinity;
    for (const k of cameFrom.keys()) {
      const [kx, kz] = k.split(',').map(Number);
      const h = heuristic(kx, kz);
      if (h < bestH) {
        bestH = h;
        bestKey = k;
      }
    }
    key = bestKey;
  }
  while (key !== null && key !== startKey) {
    const [kx, kz] = key.split(',').map(Number);
    path.unshift([kx, kz]);
    key = cameFrom.get(key);
  }
  // Perhalus: buang simpul yang terlihat langsung dari simpul sebelumnya.
  const smooth = [];
  let anchor = [fromX, fromZ];
  for (let i = 0; i < path.length; i += 1) {
    const next = path[i + 1];
    if (!next || lineBlocked(anchor[0], anchor[1], next[0], next[1])) {
      smooth.push(path[i]);
      anchor = path[i];
    }
  }
  if (smooth.length === 0) smooth.push([toX, toZ]);
  return smooth;
}

export class Autopilot {
  constructor(world) {
    this.world = world;
    this.waitTimer = 0;
    this.lastX = null;
    this.lastZ = null;
    this.stillTime = 0;
    this.dashUntil = -1;
    this.path = [];
    this.pathKey = '';
    this.replanAt = -1;
  }

  // Biaya bahaya per sel untuk A*: kerucut penjaga/kamera SAAT INI
  // (tanpa uji line-of-sight — murah, cukup sebagai heuristik rute).
  // Penjaga siaga jauh lebih mahal: rutenya menjauh darinya.
  cellDanger(x, z) {
    let cost = 0;
    const { squad, cctv } = this.world;
    for (const guard of squad.all) {
      const dx = x - guard.x;
      const dz = z - guard.z;
      const dist = Math.hypot(dx, dz);
      if (dist > guard.range) continue;
      const targetAngle = Math.atan2(dx, -dz);
      if (Math.abs(angleDiff(targetAngle, guard.angle)) <= guard.halfAngle) {
        cost += guard.state === 'alert' ? 30 : 12;
      }
    }
    for (const cam of cctv.cameras) {
      const dx = x - cam.x;
      const dz = z - cam.z;
      const dist = Math.hypot(dx, dz);
      if (dist > cam.def.range) continue;
      const targetAngle = Math.atan2(dx, -dz);
      if (Math.abs(angleDiff(targetAngle, cam.angle)) <= cam.def.halfAngle) cost += 6;
    }
    return cost;
  }

  // Bahaya di titik (x, z) dalam 0,4 detik ke depan: kerucut penjaga & kamera.
  // Bobot disetel dari BIAYA WAKTU nyata: menyeberang kerucut 0,25 dtk hanya
  // menaikkan alarm ~10 dan butuh >0,5 dtk tatap untuk membuat penjaga curiga
  // — jadi bahaya harus jauh di bawah progress (150), kalau tidak autopilot
  // memilih diam selamanya di kantong aman. Penjaga yang MENGEJAR jauh lebih
  // berbahaya daripada yang berpatroli; jarak dekat hanya menakutkan bila
  // penjaga menghadap ke arahmu.
  dangerAt(x, z, ahead = 0.4) {
    let danger = 0;
    const { squad, cctv } = this.world;
    for (const guard of squad.all) {
      // Prediksi posisi penjaga: ia berjalan ke arah hadapnya.
      const speed = guard.state === 'alert' ? DETECTION.chaseSpeed : guard.speed;
      const gx = guard.x + Math.sin(guard.angle) * speed * ahead;
      const gz = guard.z - Math.cos(guard.angle) * speed * ahead;
      const dx = x - gx;
      const dz = z - gz;
      const dist = Math.hypot(dx, dz);
      if (dist > guard.range + 1.5) continue;
      const targetAngle = Math.atan2(dx, -dz);
      const inCone = Math.abs(angleDiff(targetAngle, guard.angle)) <= guard.halfAngle + 0.12;
      if (inCone && !lineBlocked(gx, gz, x, z)) {
        danger += guard.state === 'alert' ? 180 : 90;
        danger += Math.max(0, (guard.range - dist)) * 4;
      }
      // Dekat penjaga hanya berbahaya bila ia menghadap ke arahmu,
      // atau sangat dekat (hampir bersentuhan).
      if (dist < 2.0) danger += 100;
      else if (dist < 3.5 && inCone) danger += 40;
    }
    for (const cam of cctv.cameras) {
      const dx = x - cam.x;
      const dz = z - cam.z;
      const dist = Math.hypot(dx, dz);
      if (dist > cam.def.range + 1) continue;
      const targetAngle = Math.atan2(dx, -dz);
      if (Math.abs(angleDiff(targetAngle, cam.angle)) <= cam.def.halfAngle + 0.1 &&
          !lineBlocked(cam.x, cam.z, x, z)) {
        danger += 70;
        danger += Math.max(0, (cam.def.range - dist)) * 3;
      }
    }
    // Sorot panggung: berdiri di bawahnya membuatmu lebih mudah terlihat.
    if (this.world.playerInSpotlightAt(x, z)) danger += 30;
    return danger;
  }

  // Target sekarang: loot terdekat yang belum diambil, lalu EXIT.
  currentTarget() {
    const { loot, player } = this.world;
    if (!loot.allTaken) {
      let best = null;
      let bestD = Infinity;
      for (const def of LOOT_DEFS) {
        if (loot.taken.has(def.id)) continue;
        const d = Math.hypot(def.x - player.x, def.z - player.z);
        if (d < bestD) {
          bestD = d;
          best = def;
        }
      }
      return { x: best.x, z: best.z, isExit: false, key: `loot:${best.id}` };
    }
    return { x: EXIT_DEF.x, z: EXIT_DEF.z, isExit: true, key: 'exit' };
  }

  // Simpul jalur berikutnya (hitung ulang bila target berubah / jalur habis /
  // sudah 4 detik — kerucut bergerak, rute harus segar).
  nextNode(target) {
    const key = `${target.key}:${this.world.strikes}`;
    if (key !== this.pathKey || this.path.length === 0 || this.world.time > this.replanAt) {
      this.path = findPath(this.world.player.x, this.world.player.z, target.x, target.z,
        (x, z) => this.cellDanger(x, z));
      this.pathKey = key;
      this.replanAt = this.world.time + 4;
    }
    // Buang simpul yang sudah dicapai.
    while (this.path.length > 1) {
      const [nx, nz] = this.path[0];
      if (Math.hypot(nx - this.world.player.x, nz - this.world.player.z) < 1.1) {
        this.path.shift();
      } else break;
    }
    return this.path[0] || [target.x, target.z];
  }

  // Satu langkah autopilot: kembalikan input {x, z, sneaking} + tekan E bila perlu.
  decide() {
    const { player, loot } = this.world;
    const target = this.currentTarget();
    const near = loot.nearestLoot(player.x, player.z);
    const pressE = near !== null && near.dist < 1.9;

    // Macet? Bila posisi nyaris tak bergerak 4 detik, mode DASH 2,5 detik:
    // bobot bahaya dipangkas tajam — lebih baik menyeberang kerucut sebentar
    // daripada diam di tempat sampai waktu habis. Ditambah rasa tidak sabar:
    // makin lama diam, makin negatif bonus menunggu.
    if (this.lastX !== null) {
      const moved = Math.hypot(player.x - this.lastX, player.z - this.lastZ);
      this.stillTime = moved < 0.05 ? this.stillTime + 1 / 12 : 0;
      if (this.stillTime > 4 && this.world.time > this.dashUntil) {
        this.dashUntil = this.world.time + 2.5;
        this.stillTime = 0;
      }
    }
    this.lastX = player.x;
    this.lastZ = player.z;
    const dangerScale = this.world.time < this.dashUntil ? 0.15 : 1;
    const waitBonus = 10 - Math.min(40, this.stillTime * 4);

    // Bila alarm sedang sangat tinggi, mundur ke zona gelap terdekat sejenak.
    let goal = this.nextNode(target);
    if (this.world.alarm > 70) {
      goal = [-19, 10.5];
      if (Math.hypot(player.x + 19, player.z - 10.5) < 1.5) goal = this.nextNode(target);
    }

    const speed = 6.4;
    const dt = 1 / 60;
    let bestScore = -Infinity;
    let bestDir = DIRECTIONS[0];
    for (const [dx, dz] of DIRECTIONS) {
      const len = Math.hypot(dx, dz) || 1;
      const nx = player.x + (dx / len) * speed * dt * 14;
      const nz = player.z + (dz / len) * speed * dt * 14;
      const distNow = Math.hypot(goal[0] - player.x, goal[1] - player.z);
      const distNext = Math.hypot(goal[0] - nx, goal[1] - nz);
      const progress = (distNow - distNext) * 100;
      // Probe yang menabrak dinding/etalase dihukum berat: jangan menekan tembok.
      const blocked = !walkableAt(nx, nz);
      const danger = this.dangerAt(nx, nz) * dangerScale + (blocked ? 500 : 0);
      const score = progress - danger + (dx === 0 && dz === 0 ? waitBonus : 0);
      if (score > bestScore) {
        bestScore = score;
        bestDir = [dx, dz];
      }
    }
    const len = Math.hypot(bestDir[0], bestDir[1]) || 1;
    // Mengendap hanya saat tidak ada yang mengejar: mengendap (3,4) lebih
    // lambat dari anjing (4,6) dan penjaga siaga (3,9) — saat dikejar, LARI.
    const anyAlert = this.world.squad.all.some((g) => g.state === 'alert');
    const sneaking = !anyAlert && this.dangerAt(player.x, player.z, 0) > 80;
    return {
      x: bestDir[0] / len,
      z: bestDir[1] / len,
      sneaking,
      pressE,
    };
  }
}
