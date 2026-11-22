// Museum Malam: Mahkota Firaun — semua konstanta level, tuning deteksi, dan hadiah.
// Ruangan: aula museum 44 x 28 unit, sumbu X timur-barat, Z utara-selatan.
// Pintu masuk di selatan (z +), Ruang Firaun + mahkota di utara (z -).
export const ROOM = { width: 44, depth: 28, wallHeight: 5.2, wallThick: 1.0 };

export const PLAYER = {
  radius: 0.55,
  speed: 6.4,
  sneakSpeed: 3.4,
  startX: 0,
  startZ: 12.2,
  startAngle: Math.PI,
};

export const LOOT_DEFS = [
  { id: 'mahkota', name: 'Mahkota Firaun', x: 0, z: -10.6, color: 0xffc93c, kind: 'crown', points: 500 },
  { id: 'topeng', name: 'Topeng Emas Anubis', x: -15.5, z: -9.5, color: 0xffd700, kind: 'mask', points: 350 },
  { id: 'prasasti', name: 'Prasasti Batu Nil', x: 15.5, z: -9.5, color: 0x9fd8ff, kind: 'tablet', points: 350 },
];

export const EXIT_DEF = { x: 0, z: 12.6, width: 4.4 };

// Dinding pembatas ruangan (AABB: minX, minZ, maxX, maxZ). Dinding luar ditangani
// oleh batas ruangan; daftar ini hanya penghalang dalam yang menghalangi
// line-of-sight dan gerakan.
export const OBSTACLES = [
  // Etalase kaca besar di tengah aula (cover utama, membelah karpet merah).
  { minX: -6.4, minZ: -3.2, maxX: -2.4, maxZ: 0.4, kind: 'case', h: 2.2 },
  { minX: 2.4, minZ: -3.2, maxX: 6.4, maxZ: 0.4, kind: 'case', h: 2.2 },
  // Pilar marmer.
  { minX: -12.6, minZ: -4.6, maxX: -11.2, maxZ: -3.2, kind: 'pillar', h: 4.6 },
  { minX: 11.2, minZ: -4.6, maxX: 12.6, maxZ: -3.2, kind: 'pillar', h: 4.6 },
  { minX: -12.6, minZ: 3.4, maxX: -11.2, maxZ: 4.8, kind: 'pillar', h: 4.6 },
  { minX: 11.2, minZ: 3.4, maxX: 12.6, maxZ: 4.8, kind: 'pillar', h: 4.6 },
  // Etalase samping barat dan timur.
  { minX: -19.4, minZ: -6.4, maxX: -16.6, maxZ: -3.4, kind: 'case', h: 2.0 },
  { minX: 16.6, minZ: -6.4, maxX: 19.4, maxZ: -3.4, kind: 'case', h: 2.0 },
  { minX: -19.4, minZ: 4.2, maxX: -16.6, maxZ: 7.2, kind: 'case', h: 2.0 },
  { minX: 16.6, minZ: 4.2, maxX: 19.4, maxZ: 7.2, kind: 'case', h: 2.0 },
  // Dinding rendah Ruang Firaun (membingkai mahkota, celah di tengah).
  { minX: -7.0, minZ: -12.4, maxX: -1.6, maxZ: -11.4, kind: 'wall', h: 2.6 },
  { minX: 1.6, minZ: -12.4, maxX: 7.0, maxZ: -11.4, kind: 'wall', h: 2.6 },
  // Bangku marmer tengah selatan (cover dekat pintu masuk).
  { minX: -3.4, minZ: 7.6, maxX: 3.4, maxZ: 9.0, kind: 'bench', h: 1.1 },
];

// Zona gelap: alarm turun dua kali lebih cepat saat pencuri berdiri di sini.
export const DARK_ZONES = [
  { minX: -21, minZ: -12.5, maxX: -17.5, maxZ: -8.5 },
  { minX: 17.5, minZ: -12.5, maxX: 21, maxZ: -8.5 },
  { minX: -21, minZ: 8.5, maxX: -17.5, maxZ: 12.5 },
  { minX: 17.5, minZ: 8.5, maxX: 21, maxZ: 12.5 },
];

// Jalur patroli penjaga — semuanya di ruang terbuka, bebas halangan.
export const GUARD_DEFS = [
  {
    id: 'rudi', name: 'Satpam Rudi', color: 0x2b4c7e, x: -9, z: -7, speed: 2.3,
    waypoints: [[-9, -7], [-9, 6], [9, 6], [9, -7]],
  },
  {
    id: 'sari', name: 'Satpam Sari', color: 0x7e2b4c, x: 9, z: -7, speed: 2.1,
    waypoints: [[9, -7], [9, 6], [-9, 6], [-9, -7]],
  },
  {
    id: 'budi', name: 'Satpam Budi', color: 0x2b7e4c, x: -16, z: 0, speed: 2.5,
    waypoints: [[-16, 0], [-16, -9], [-5, -9], [-5, 0]],
  },
  {
    id: 'dewi', name: 'Satpam Dewi', color: 0x7e6a2b, x: 16, z: 0, speed: 2.5,
    waypoints: [[16, 0], [16, -9], [5, -9], [5, 0]],
  },
];

export const DOG_DEF = {
  id: 'rex', name: 'Anjing K-9 Rex', color: 0x4a3220, x: -15, z: 4, speed: 3.1,
  // Anjing menjaga sayap barat (jalur ke Topeng Emas) — BUKAN koridor masuk,
  // agar pencuri tidak terlihat sejak detik pertama di pintu masuk.
  waypoints: [[-18, 4], [-12, 4], [-12, -4], [-18, -4]],
};

// Kamera CCTV di dinding: posisi, arah awal (radian), rentang sapuan, kecepatan.
export const CAMERA_DEFS = [
  { id: 'cctv-utara', x: -20.5, z: -12.8, baseAngle: Math.PI / 2, sweep: 0.85, speed: 0.55, range: 13, halfAngle: 0.42 },
  { id: 'cctv-selatan', x: 20.5, z: 12.8, baseAngle: -Math.PI / 2, sweep: 0.85, speed: 0.45, range: 13, halfAngle: 0.42 },
];

// Lampu sorot panggung di atas Ruang Firaun + satu di tengah aula.
export const SPOTLIGHT_DEFS = [
  { x: 0, z: -9.5, baseAngle: 0, sweep: 1.1, speed: 0.5, radius: 4.2 },
  { x: 0, z: 2.5, baseAngle: Math.PI, sweep: 1.3, speed: 0.38, radius: 3.6 },
];

export const DETECTION = {
  guardRange: 11.5,
  guardHalfAngle: 0.48,
  dogRange: 8.5,
  dogHalfAngle: 0.62,
  // Detik penglihatan terus-menerus sebelum penjaga masuk mode siaga penuh.
  suspectTime: 0.55,
  alertTime: 1.15,
  alarmRisePerSecond: 42,
  cameraAlarmRisePerSecond: 55,
  alarmFallPerSecond: 14,
  alarmFallDarkPerSecond: 30,
  alarmCatchAt: 100,
  chaseSpeed: 3.9,
  dogChaseSpeed: 4.6,
  searchSeconds: 3.5,
  catchRadius: 1.05,
  strikesToLose: 3,
};

export const TOOLS = {
  decoyCount: 3,
  decoyRange: 4.5,
  decoyLureRadius: 9,
  decoyInvestigateSeconds: 4.5,
};

export const SCORING = {
  lootPoints: 0, // poin loot diambil dari LOOT_DEFS
  winBonus: 400,
  strikePenalty: 150,
  timeBonusPerSecond: 2,
};

// Grade dari waktu total dan jumlah ketahuan (statistik asli, tidak dipaksa).
export function gradeFor(seconds, strikes) {
  if (strikes === 0 && seconds <= 150) return 'S';
  if (strikes <= 1 && seconds <= 210) return 'A';
  if (strikes <= 2 && seconds <= 280) return 'B';
  return 'C';
}

export const SHOT_SEED = 20261122;
export const STEP = 1 / 60;
