// Level museum 3D: lantai marmer, karpet merah, dinding, pilar, etalase kaca,
// pedestal loot, pintu EXIT, dan lampu sorot panggung yang menyapu.
// Juga: tabrakan lingkaran-vs-AABB dan uji line-of-sight antar dua titik.
import * as THREE from 'three';
import { ROOM, OBSTACLES, DARK_ZONES, LOOT_DEFS, EXIT_DEF, SPOTLIGHT_DEFS } from './config.js';

export function pointInBox(x, z, box) {
  return x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ;
}

// Geser lingkaran (x, z, radius) keluar dari semua AABB + dinding ruangan.
// Mengembalikan posisi baru {x, z}.
export function resolveCircle(x, z, radius) {
  const halfW = ROOM.width / 2 - 0.7;
  const halfD = ROOM.depth / 2 - 0.7;
  x = Math.max(-halfW, Math.min(halfW, x));
  z = Math.max(-halfD, Math.min(halfD, z));
  for (const box of OBSTACLES) {
    const cx = Math.max(box.minX, Math.min(x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.000001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // Tepat di tengah kotak: dorong ke sisi terdekat.
        const pushL = x - box.minX + radius;
        const pushR = box.maxX - x + radius;
        const pushU = z - box.minZ + radius;
        const pushD = box.maxZ - z + radius;
        const m = Math.min(pushL, pushR, pushU, pushD);
        if (m === pushL) x = box.minX - radius;
        else if (m === pushR) x = box.maxX + radius;
        else if (m === pushU) z = box.minZ - radius;
        else z = box.maxZ + radius;
      }
    }
  }
  return { x, z };
}

// Apakah segmen (x1,z1)-(x2,z2) terhalang kotak penghalang? (sampel tiap 0.4 unit)
export function lineBlocked(x1, z1, x2, z2) {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(1, Math.ceil(dist / 0.4));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const z = z1 + (z2 - z1) * t;
    for (const box of OBSTACLES) {
      if (pointInBox(x, z, box)) return true;
    }
  }
  return false;
}

export function inDarkZone(x, z) {
  return DARK_ZONES.some((zone) => pointInBox(x, z, zone));
}

function makeMarbleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  for (let ty = 0; ty < 4; ty += 1) {
    for (let tx = 0; tx < 4; tx += 1) {
      const light = (tx + ty) % 2 === 0;
      g.fillStyle = light ? '#cfc8bd' : '#b8b0a2';
      g.fillRect(tx * 64, ty * 64, 64, 64);
      g.strokeStyle = 'rgba(90,80,70,0.35)';
      g.strokeRect(tx * 64 + 0.5, ty * 64 + 0.5, 63, 63);
    }
  }
  g.strokeStyle = 'rgba(120,110,100,0.25)';
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 26; i += 1) {
    g.beginPath();
    const x = rand() * 256;
    const y = rand() * 256;
    g.moveTo(x, y);
    g.bezierCurveTo(x + 30, y + 8, x + 60, y - 6, x + 90, y + 14);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCarpetTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = '#8e1420';
  g.fillRect(0, 0, 128, 256);
  g.fillStyle = '#c9a227';
  g.fillRect(0, 0, 6, 256);
  g.fillRect(122, 0, 6, 256);
  g.fillStyle = 'rgba(201,162,39,0.55)';
  for (let y = 12; y < 256; y += 32) {
    g.beginPath();
    g.moveTo(64, y);
    g.lineTo(78, y + 9);
    g.lineTo(64, y + 18);
    g.lineTo(50, y + 9);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Level {
  constructor(scene) {
    this.scene = scene;
    this.spotMeshes = [];
    this.exitDoor = null;
    this.exitGlow = null;
    this.build();
  }

  build() {
    const { width, depth, wallHeight } = ROOM;
    // Lantai marmer.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshStandardMaterial({ map: makeMarbleTexture(), roughness: 0.55, metalness: 0.08 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Karpet merah di lorong tengah (utara-selatan).
    const carpet = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, depth - 2),
      new THREE.MeshStandardMaterial({ map: makeCarpetTexture(), roughness: 0.95 }),
    );
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.02, 0);
    carpet.receiveShadow = true;
    this.scene.add(carpet);

    // Dinding keliling (marmer gelap + lis emas).
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3348, roughness: 0.8 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.7 });
    const mkWall = (w, d, x, z) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight, d), wallMat);
      wall.position.set(x, wallHeight / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w === 1 ? 1.1 : w, 0.18, d === 1 ? 1.1 : d), trimMat);
      trim.position.set(x, 1.05, z);
      this.scene.add(trim);
    };
    mkWall(width + 2, 1, 0, -depth / 2 - 0.5);
    mkWall(width + 2, 1, 0, depth / 2 + 0.5);
    mkWall(1, depth + 2, -width / 2 - 0.5, 0);
    mkWall(1, depth + 2, width / 2 + 0.5, 0);

    // Plakat "RUANG FIRAUN" di dinding utara.
    this.addPlaque('RUANG FIRAUN', 0, 2.6, -depth / 2 + 0.15);

    // Zona gelap: karpet abu gelap di empat sudut (visual penanda tempat sembunyi).
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1a26, roughness: 1 });
    for (const zone of DARK_ZONES) {
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(zone.maxX - zone.minX, zone.maxZ - zone.minZ), darkMat);
      rug.rotation.x = -Math.PI / 2;
      rug.position.set((zone.minX + zone.maxX) / 2, 0.015, (zone.minZ + zone.maxZ) / 2);
      rug.receiveShadow = true;
      this.scene.add(rug);
    }

    // Penghalang: etalase kaca, pilar, dinding rendah, bangku.
    for (const box of OBSTACLES) {
      const w = box.maxX - box.minX;
      const d = box.maxZ - box.minZ;
      const cx = (box.minX + box.maxX) / 2;
      const cz = (box.minZ + box.maxZ) / 2;
      if (box.kind === 'case') this.addGlassCase(cx, cz, w, d, box.h);
      else if (box.kind === 'pillar') this.addPillar(cx, cz, box.h);
      else if (box.kind === 'wall') this.addLowWall(cx, cz, w, d, box.h);
      else this.addBench(cx, cz, w, d, box.h);
    }

    // Pedestal + artefak loot.
    this.lootMeshes = new Map();
    for (const loot of LOOT_DEFS) {
      const pedestal = new THREE.Mesh(
        new THREE.BoxGeometry(1.5, 1.15, 1.5),
        new THREE.MeshStandardMaterial({ color: 0x8f8578, roughness: 0.5 }),
      );
      pedestal.position.set(loot.x, 0.575, loot.z);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      this.scene.add(pedestal);
      const top = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.12, 1.7),
        new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.8 }),
      );
      top.position.set(loot.x, 1.2, loot.z);
      this.scene.add(top);
      const mesh = this.makeLootMesh(loot);
      mesh.position.set(loot.x, 1.75, loot.z);
      this.scene.add(mesh);
      const glow = new THREE.PointLight(loot.color, 14, 7, 1.8);
      glow.position.set(loot.x, 2.4, loot.z);
      this.scene.add(glow);
      this.lootMeshes.set(loot.id, { mesh, glow });
    }

    // Pintu EXIT di selatan.
    const door = new THREE.Group();
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(EXIT_DEF.width + 0.8, 3.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.6 }),
    );
    frame.position.y = 1.7;
    door.add(frame);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(EXIT_DEF.width, 3.0, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.4, metalness: 0.6 }),
    );
    panel.position.y = 1.5;
    panel.position.z = 0.2;
    door.add(panel);
    this.exitGlow = new THREE.PointLight(0x22ff88, 0, 9, 1.6);
    this.exitGlow.position.set(0, 2.2, 0.8);
    door.add(this.exitGlow);
    door.position.set(EXIT_DEF.x, 0, EXIT_DEF.z + 0.4);
    this.scene.add(door);
    this.exitDoor = panel;
    this.addPlaque('EXIT', 0, 3.9, EXIT_DEF.z - 0.4, 0x22ff88);

    // Lampu sorot panggung: tiang + kerucut cahaya menyapu.
    for (const def of SPOTLIGHT_DEFS) {
      const rig = new THREE.Group();
      rig.position.set(def.x, 5.0, def.z);
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 0.5, 12),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.7 }),
      );
      rig.add(head);
      const light = new THREE.SpotLight(0xffe9a8, 220, 26, 0.42, 0.45, 1.4);
      light.position.set(0, 0, 0);
      light.castShadow = true;
      light.shadow.mapSize.set(256, 256);
      const target = new THREE.Object3D();
      target.position.set(0, -5, 0);
      rig.add(target);
      light.target = target;
      rig.add(light);
      const coneGeo = new THREE.ConeGeometry(def.radius, 5.2, 24, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffe9a8, transparent: true, opacity: 0.07,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = -2.6;
      rig.add(cone);
      this.scene.add(rig);
      this.spotMeshes.push({ def, rig, target, cone, light });
    }
  }

  addPlaque(text, x, y, z, color = 0xc9a227) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const g = canvas.getContext('2d');
    g.fillStyle = '#14101c';
    g.fillRect(0, 0, 512, 96);
    g.strokeStyle = '#c9a227';
    g.lineWidth = 6;
    g.strokeRect(4, 4, 504, 88);
    g.fillStyle = color === 0x22ff88 ? '#7dffb0' : '#e8c85a';
    g.font = 'bold 44px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 1.0),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    plaque.position.set(x, y, z);
    this.scene.add(plaque);
    return plaque;
  }

  addGlassCase(cx, cz, w, d, h) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.5, d),
      new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.5 }),
    );
    base.position.set(cx, 0.25, cz);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.2, h - 0.5, d - 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x9fd8ff, transparent: true, opacity: 0.22,
        roughness: 0.08, metalness: 0.1,
      }),
    );
    glass.position.set(cx, 0.5 + (h - 0.5) / 2, cz);
    this.scene.add(glass);
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.12, d),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.8 }),
    );
    lid.position.set(cx, h + 0.06, cz);
    this.scene.add(lid);
    // Artefak kecil di dalam etalase (vas + koin) — dekorasi, bukan loot.
    const vase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.42, 0.9, 10),
      new THREE.MeshStandardMaterial({ color: 0x7a5a2a, roughness: 0.5 }),
    );
    vase.position.set(cx, 0.95, cz);
    vase.castShadow = true;
    this.scene.add(vase);
  }

  addPillar(cx, cz, h) {
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.72, h, 14),
      new THREE.MeshStandardMaterial({ color: 0xd8d0c2, roughness: 0.45 }),
    );
    shaft.position.set(cx, h / 2, cz);
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    this.scene.add(shaft);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.3, 1.7),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.6 }),
    );
    cap.position.set(cx, h + 0.15, cz);
    this.scene.add(cap);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.3, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x8f8578, roughness: 0.5 }),
    );
    base.position.set(cx, 0.15, cz);
    this.scene.add(base);
  }

  addLowWall(cx, cz, w, d, h) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x5a4a6a, roughness: 0.7 }),
    );
    wall.position.set(cx, h / 2, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.1, 0.14, d + 0.1),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 0.7 }),
    );
    trim.position.set(cx, h + 0.07, cz);
    this.scene.add(trim);
  }

  addBench(cx, cz, w, d, h) {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x6a1a1a, roughness: 0.9 }),
    );
    bench.position.set(cx, h / 2, cz);
    bench.castShadow = true;
    bench.receiveShadow = true;
    this.scene.add(bench);
  }

  makeLootMesh(loot) {
    const mat = new THREE.MeshStandardMaterial({
      color: loot.color, roughness: 0.2, metalness: 0.9,
      emissive: loot.color, emissiveIntensity: 0.35,
    });
    const group = new THREE.Group();
    if (loot.kind === 'crown') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.35, 12, 1, true), mat);
      group.add(band);
      for (let i = 0; i < 5; i += 1) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.45, 6), mat);
        const a = (i / 5) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.55, 0.38, Math.sin(a) * 0.55);
        group.add(spike);
      }
      const jewel = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 0.8, roughness: 0.1 }),
      );
      jewel.position.set(0, 0.1, 0.58);
      group.add(jewel);
    } else if (loot.kind === 'mask') {
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.95, 0.3), mat);
      group.add(face);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
      for (const sx of [-0.18, 0.18]) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), eyeMat);
        eye.position.set(sx, 0.15, 0.17);
        group.add(eye);
      }
      const ears = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), mat);
      ears.position.set(0.28, 0.68, 0);
      ears.rotation.z = -0.4;
      group.add(ears);
      const ears2 = ears.clone();
      ears2.position.x = -0.28;
      ears2.rotation.z = 0.4;
      group.add(ears2);
    } else {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.22), new THREE.MeshStandardMaterial({
        color: 0x8a7a5a, roughness: 0.85, emissive: loot.color, emissiveIntensity: 0.12,
      }));
      group.add(slab);
      const glyph = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.7, 0.06),
        new THREE.MeshStandardMaterial({ color: loot.color, emissive: loot.color, emissiveIntensity: 0.6 }),
      );
      glyph.position.z = 0.13;
      group.add(glyph);
    }
    return group;
  }

  // Sorot panggung menyapu + animasi loot mengambang.
  update(time) {
    for (const spot of this.spotMeshes) {
      const angle = spot.def.baseAngle + Math.sin(time * spot.def.speed) * spot.def.sweep;
      const radius = 6.5;
      spot.target.position.set(Math.sin(angle) * radius, -5, Math.cos(angle) * radius * 0.6);
      spot.rig.rotation.y = angle;
      spot.cone.rotation.z = Math.sin(angle) * 0.35;
      spot.cone.rotation.x = Math.cos(angle) * 0.2;
    }
    for (const { mesh } of this.lootMeshes.values()) {
      mesh.rotation.y = time * 0.9;
      mesh.position.y = 1.75 + Math.sin(time * 2 + mesh.position.x) * 0.12;
    }
  }

  setLootTaken(id) {
    const entry = this.lootMeshes.get(id);
    if (entry) {
      entry.mesh.visible = false;
      entry.glow.intensity = 0;
    }
  }

  setExitOpen(open) {
    if (this.exitDoor) {
      this.exitDoor.material.color.set(open ? 0x22ff88 : 0x4a4f55);
      this.exitDoor.material.emissive = new THREE.Color(open ? 0x22ff88 : 0x000000);
      this.exitDoor.material.emissiveIntensity = open ? 0.7 : 0;
    }
    if (this.exitGlow) this.exitGlow.intensity = open ? 26 : 0;
  }
}
